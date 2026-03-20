# ТЗ: Бот для поиска работы на HH.ru — Расширенные статусы + Заметки

**Целевой репозиторий:** https://github.com/moviesm33333/job_finder_ai
**Репозиторий-референс (JobSync):** https://github.com/moviesm33333/jobsync
**Дата:** 2026-03-20

---

## Контекст проекта

**job_finder_ai** — бот для автоматизации поиска работы на HH.ru.

- **Стек:** Python (Flask) + vanilla JS + SQLite
- **Авторизация HH.ru:** эмуляция браузера (Selenium/Playwright), НЕ OAuth, НЕ API-токен
- **Резюме:** хранится на HH.ru, бот получает его оттуда через браузерную сессию
- **Архитектура:** однопользовательское приложение (без системы регистрации/логина)

---

## Что внедряем

| # | Фича | Описание |
|---|-------|----------|
| 1 | Расширенные статусы | Воронка после отклика: `interview` → `offer` → `accepted` / `rejected` |
| 2 | Заметки к вакансиям | Текстовые заметки с CRUD: результаты собесов, контакты HR, условия |

---

## Модуль 1: Расширенные статусы вакансий

### 1.1. Текущее состояние

Предполагаемые статусы сейчас: `new`, `manual`, `auto`, `applied`, `snoozed`, `trash`.
**Проблема:** после `applied` — чёрная дыра. Непонятно, что дальше с вакансией.

### 1.2. Новые статусы

| Статус | Значение | Когда ставится | Цвет |
|--------|----------|----------------|------|
| `interview` | Приглашён на собеседование | Пришёл ответ от компании, назначена встреча | `#22C55E` (зелёный) |
| `offer` | Получен оффер | Компания прислала предложение о работе | `#3B82F6` (синий) |
| `rejected` | Отказ | Компания отказала ИЛИ кандидат сам отказался | `#EF4444` (красный) |
| `accepted` | Принято | Кандидат принял оффер, выходит на работу | `#EAB308` (золотой) |

### 1.3. Граф переходов статусов

```
new ──→ applied ──→ interview ──→ offer ──→ accepted
  │         │           │           │
  │         │           │           └──→ rejected (отказался от оффера)
  │         │           │
  │         │           └──→ rejected (не прошёл собес)
  │         │
  │         └──→ rejected (отказ без собеса)
  │
  └──→ snoozed
  └──→ trash
```

**Правила автоматики:**
- Переход в `interview` → автоматически `applied=True`, `applied_date=now()` (если ещё не applied)
- Переход в `offer` → автоматически `applied=True` (если ещё не applied)
- Из `accepted` и `rejected` обратные переходы запрещены (только через ручной сброс)
- Из `trash` в любой статус — разрешено (восстановление)

### 1.4. Сценарии использования

**Сценарий A: Полная воронка**
1. Бот нашёл вакансию → статус `new`
2. Бот автоматически откликнулся → `applied`
3. Пользователь получил приглашение на собес → вручную ставит `interview`
4. Прошёл собес, получил оффер → вручную ставит `offer`
5. Принял оффер → `accepted`

**Сценарий B: Быстрый отказ**
1. Бот откликнулся → `applied`
2. Пришёл отказ → пользователь ставит `rejected`

**Сценарий C: Пропуск этапов**
1. Вакансия в статусе `new`
2. Пользователь сразу ставит `interview` (откликался вручную на HH, мимо бота)
3. Система автоматически выставляет `applied=True`

**Сценарий D: Множественные собесы**
1. Статус `interview` — был первый собес
2. Пользователь добавляет заметку: "Первый собес — техническое интервью, прошёл"
3. Статус остаётся `interview` — ждёт второй раунд
4. Добавляет заметку: "Финальный собес с CTO"
5. Переход в `offer` или `rejected`

### 1.5. Задачи реализации

#### Backend

**Задача 1.5.1: Миграция БД**
```python
# Расширить допустимые значения поля status в таблице vacancies
VACANCY_STATUSES = [
    'new', 'manual', 'auto', 'applied', 'snoozed', 'trash',
    'interview', 'offer', 'rejected', 'accepted'  # НОВЫЕ
]
```
**Проверка:** `SELECT DISTINCT status FROM vacancies;` → новые статусы принимаются без ошибок

**Задача 1.5.2: API-эндпоинт смены статуса**
```
PATCH /api/vacancy/<vacancy_id>/status
Body: { "status": "interview" }
Response: { "ok": true, "vacancy": { ... } }
```

Логика (адаптация из JobSync `src/actions/job.actions.ts:391-433`):
```python
def update_vacancy_status(vacancy_id, new_status):
    vacancy = Vacancy.query.get_or_404(vacancy_id)

    if new_status in ('interview', 'offer', 'accepted'):
        if not vacancy.applied:
            vacancy.applied = True
            vacancy.applied_date = datetime.utcnow()

    if new_status in ('accepted', 'rejected'):
        # Запрет обратного перехода
        if vacancy.status in ('accepted', 'rejected') and new_status != vacancy.status:
            # Разрешить только через явный сброс
            pass

    vacancy.status = new_status
    vacancy.status_changed_at = datetime.utcnow()  # НОВОЕ поле
    db.session.commit()
```

**Проверка:** `curl -X PATCH .../api/vacancy/1/status -d '{"status":"interview"}'` → статус изменён, applied=True

**Задача 1.5.3: Новое поле `status_changed_at`**
```sql
ALTER TABLE vacancies ADD COLUMN status_changed_at DATETIME;
```
Нужно для отслеживания: когда именно пришёл на собес, когда получил оффер и т.д.

**Проверка:** после смены статуса поле заполняется

#### Frontend

**Задача 1.5.4: Dropdown смены статуса в карточке вакансии**
- В карточке вакансии (детальный вид) — dropdown с доступными статусами
- Доступные статусы зависят от текущего (граф переходов)
- При выборе — AJAX-запрос на PATCH
- Бейдж с цветом текущего статуса

**Задача 1.5.5: Бейджи в списке вакансий**
```css
.status-badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; color: white; }
.status-new       { background: #6B7280; }
.status-applied   { background: #06B6D4; }
.status-interview { background: #22C55E; }
.status-offer     { background: #3B82F6; }
.status-rejected  { background: #EF4444; }
.status-accepted  { background: #EAB308; }
.status-snoozed   { background: #A855F7; }
.status-trash     { background: #374151; }
```

**Проверка:** в списке вакансий видны цветные бейджи, клик на бейдж открывает dropdown

**Задача 1.5.6: Фильтр по новым статусам**
- Добавить `interview`, `offer`, `rejected`, `accepted` в фильтр
- Счётчик рядом с каждым фильтром: `Interview (3)`

**Задача 1.5.7: Мини-воронка на главной**
```
Найдено: 150 → Откликнулись: 42 → Собесы: 8 → Офферы: 2 → Принято: 1
```
Простая горизонтальная полоска с числами. Без графиков — просто числа в цветных блоках.

**Проверка:** на главной странице видна воронка с актуальными числами

---

## Модуль 2: Заметки к вакансиям

### 2.1. Описание

Прикрепление текстовых заметок к вакансии. Одна вакансия — много заметок. Порядок — от новых к старым.

**Зачем:**
- Записать впечатления после собеседования
- Сохранить контакты HR / рекрутера
- Зафиксировать условия оффера (зп, бонусы, дата выхода)
- Записать вопросы, которые задали на собесе
- Отметить red/green flags компании

### 2.2. Сценарии использования

**Сценарий A: Заметка после собеседования**
1. Пользователь открывает карточку вакансии
2. Нажимает "+ Заметка"
3. Пишет: "Собес 20.03 — техническое интервью, 1 час. Спрашивали про asyncio, SQLAlchemy, Docker. Дали тестовое на 3 дня."
4. Сохраняет
5. Видит заметку в списке с датой

**Сценарий B: Редактирование заметки**
1. Пользователь видит заметку с ошибкой
2. Нажимает "Редактировать"
3. Исправляет текст
4. Сохраняет → появляется пометка "(изменено)"

**Сценарий C: Множественные заметки**
1. Заметка 1: "Отклик отправлен, ответили через 2 дня"
2. Заметка 2: "Первый собес — HR скрининг. Зп 250-300к, удалёнка"
3. Заметка 3: "Техническое интервью — дали оффер 280к"
4. Все три видны в хронологическом порядке (новые сверху)

**Сценарий D: Удаление заметки**
1. Пользователь нажимает "Удалить" на заметке
2. Появляется подтверждение: "Удалить заметку?"
3. Подтверждает → заметка удалена
4. Отменяет → ничего не происходит

**Сценарий E: Удаление вакансии**
1. Пользователь удаляет вакансию из списка
2. Все заметки этой вакансии удаляются каскадно (ON DELETE CASCADE)

### 2.3. Задачи реализации

#### Backend

**Задача 2.3.1: Новая таблица `vacancy_notes`**

```sql
CREATE TABLE vacancy_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vacancy_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vacancy_id) REFERENCES vacancies(id) ON DELETE CASCADE
);
CREATE INDEX idx_vacancy_notes_vacancy_id ON vacancy_notes(vacancy_id);
```

SQLAlchemy-модель (адаптация из JobSync `prisma/schema.prisma:415-427`):
```python
class VacancyNote(db.Model):
    __tablename__ = 'vacancy_notes'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    vacancy_id = db.Column(
        db.Integer,
        db.ForeignKey('vacancies.id', ondelete='CASCADE'),
        nullable=False, index=True
    )
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow,
                           onupdate=datetime.utcnow, nullable=False)

    vacancy = db.relationship(
        'Vacancy',
        backref=db.backref('notes', lazy='dynamic', cascade='all, delete-orphan')
    )

    @property
    def is_edited(self):
        return (self.updated_at - self.created_at).total_seconds() > 1

    def to_dict(self):
        return {
            'id': self.id,
            'vacancy_id': self.vacancy_id,
            'content': self.content,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'is_edited': self.is_edited,
        }
```

**Проверка:** `python -c "from models import VacancyNote; print('OK')"` → без ошибок

**Задача 2.3.2: CRUD API-эндпоинты**

Адаптация логики из JobSync `src/actions/note.actions.ts`:

```
GET    /api/vacancy/<vacancy_id>/notes
       → { "notes": [ { id, content, created_at, updated_at, is_edited }, ... ] }
       → Сортировка: created_at DESC (новые сверху)

POST   /api/vacancy/<vacancy_id>/notes
       Body: { "content": "Текст заметки" }
       → 201 { "note": { id, content, ... } }
       → Валидация: content не пустой, vacancy_id существует

PUT    /api/vacancy/<vacancy_id>/notes/<note_id>
       Body: { "content": "Обновлённый текст" }
       → 200 { "note": { id, content, ..., is_edited: true } }
       → Валидация: note_id существует, принадлежит vacancy_id

DELETE /api/vacancy/<vacancy_id>/notes/<note_id>
       → 200 { "ok": true }
       → Валидация: note_id существует, принадлежит vacancy_id
```

**Проверка каждого эндпоинта:**
```bash
# Создать
curl -X POST .../api/vacancy/1/notes -d '{"content":"Тест"}' → 201
# Прочитать
curl .../api/vacancy/1/notes → список с одной заметкой
# Обновить
curl -X PUT .../api/vacancy/1/notes/1 -d '{"content":"Обновлено"}' → is_edited: true
# Удалить
curl -X DELETE .../api/vacancy/1/notes/1 → ok: true
# Проверить пустой список
curl .../api/vacancy/1/notes → пустой список
```

**Задача 2.3.3: Количество заметок в списке вакансий**
- При выдаче списка вакансий (GET /api/vacancies) добавить поле `notes_count`
- SQL: `SELECT COUNT(*) FROM vacancy_notes WHERE vacancy_id = ?`
- Или через JOIN/subquery при выдаче списка

**Проверка:** в JSON каждой вакансии есть `notes_count: N`

#### Frontend

**Задача 2.3.4: Секция заметок в карточке вакансии**

Референс: JobSync `src/components/myjobs/NotesSection.tsx`

```html
<!-- Встраивается в детальную карточку вакансии -->
<div class="notes-section">
  <div class="notes-header" onclick="toggleNotes()">
    <span>📝 Заметки</span>
    <span class="notes-count-badge">3</span>
    <span class="chevron">▼</span>
  </div>
  <div class="notes-list" id="notesList">
    <!-- Заметки подгружаются через AJAX -->
  </div>
  <button class="btn-add-note" onclick="openNoteForm()">+ Добавить заметку</button>
</div>
```

Поведение:
- Секция свёрнута по умолчанию, ЕСЛИ заметок 0
- Секция развёрнута, ЕСЛИ есть хотя бы 1 заметка
- Клик на заголовок — сворачивает/разворачивает
- Бейдж с количеством заметок

**Задача 2.3.5: Карточка заметки**

Референс: JobSync `src/components/myjobs/NoteCard.tsx`

```html
<div class="note-card">
  <div class="note-header">
    <span class="note-date">20 мар 2026, 14:30</span>
    <span class="note-edited" style="display:none">(изменено)</span>
    <div class="note-actions">
      <button class="btn-icon" onclick="editNote(noteId)" title="Редактировать">✏️</button>
      <button class="btn-icon btn-danger" onclick="confirmDeleteNote(noteId)" title="Удалить">🗑️</button>
    </div>
  </div>
  <div class="note-content">Текст заметки...</div>
</div>
```

Стили:
```css
.note-card {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 8px;
}
.note-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
}
.note-date { color: #6b7280; font-size: 13px; }
.note-edited { color: #9ca3af; font-size: 12px; margin-left: 8px; }
.note-content { font-size: 14px; line-height: 1.5; white-space: pre-wrap; }
```

**Задача 2.3.6: Форма создания/редактирования заметки**

Референс: JobSync `src/components/myjobs/NoteDialog.tsx`

```html
<!-- Модальное окно -->
<div class="modal" id="noteModal">
  <div class="modal-content">
    <h3 id="noteModalTitle">Добавить заметку</h3>
    <textarea id="noteContent" rows="6" placeholder="Введите текст заметки..."></textarea>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeNoteModal()">Отмена</button>
      <button class="btn-primary" onclick="saveNote()">Сохранить</button>
    </div>
  </div>
</div>
```

Логика JS:
```javascript
let editingNoteId = null;

function openNoteForm(noteId = null) {
    editingNoteId = noteId;
    if (noteId) {
        // Режим редактирования — заполнить textarea текущим текстом
        document.getElementById('noteModalTitle').textContent = 'Редактировать заметку';
        document.getElementById('noteContent').value = getCurrentNoteContent(noteId);
    } else {
        // Режим создания
        document.getElementById('noteModalTitle').textContent = 'Добавить заметку';
        document.getElementById('noteContent').value = '';
    }
    document.getElementById('noteModal').style.display = 'flex';
}

async function saveNote() {
    const content = document.getElementById('noteContent').value.trim();
    if (!content) { alert('Заметка не может быть пустой'); return; }

    if (editingNoteId) {
        await fetch(`/api/vacancy/${vacancyId}/notes/${editingNoteId}`, {
            method: 'PUT', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ content })
        });
    } else {
        await fetch(`/api/vacancy/${vacancyId}/notes`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ content })
        });
    }
    closeNoteModal();
    loadNotes(); // Перезагрузить список заметок
}

function confirmDeleteNote(noteId) {
    if (confirm('Удалить заметку?')) {
        deleteNote(noteId);
    }
}
```

**Проверка:** создать заметку → видна в списке → отредактировать → "(изменено)" → удалить → исчезла

**Задача 2.3.7: Бейдж количества заметок в списке вакансий**
- В таблице/списке вакансий рядом с названием показывать `(3)` если есть заметки
- Данные из поля `notes_count` в API

**Проверка:** в списке вакансий видно количество заметок у каждой

---

## Пошаговый план реализации с чекпоинтами

### Этап 1: Backend — Миграция БД
**Задачи:** 1.5.1, 1.5.3, 2.3.1
**Что делаем:**
- Добавляем новые статусы в список допустимых
- Добавляем поле `status_changed_at` в таблицу вакансий
- Создаём таблицу `vacancy_notes`

**Чекпоинт:**
```bash
# Приложение запускается без ошибок
python app.py
# Таблица создана
sqlite3 db.sqlite "SELECT * FROM vacancy_notes LIMIT 1;"
# Новые статусы принимаются
sqlite3 db.sqlite "UPDATE vacancies SET status='interview' WHERE id=1;"
```

---

### Этап 2: Backend — API заметок
**Задачи:** 2.3.2, 2.3.3
**Что делаем:**
- 4 эндпоинта CRUD для заметок
- Поле `notes_count` в API списка вакансий

**Чекпоинт:**
```bash
# Полный цикл CRUD через curl
curl -X POST .../api/vacancy/1/notes -d '{"content":"test"}' → 201
curl .../api/vacancy/1/notes → [{...}]
curl -X PUT .../api/vacancy/1/notes/1 -d '{"content":"updated"}' → 200
curl -X DELETE .../api/vacancy/1/notes/1 → 200
```

---

### Этап 3: Backend — API статусов
**Задачи:** 1.5.2
**Что делаем:**
- Эндпоинт смены статуса с автоматикой (applied при interview)
- Валидация допустимых переходов

**Чекпоинт:**
```bash
# Смена статуса
curl -X PATCH .../api/vacancy/1/status -d '{"status":"interview"}' → 200
# Проверить что applied=True автоматически
curl .../api/vacancy/1 → applied: true, status: "interview"
```

---

### Этап 4: Frontend — Статусы
**Задачи:** 1.5.4, 1.5.5, 1.5.6
**Что делаем:**
- Цветные бейджи статусов
- Dropdown смены статуса
- Фильтр по статусам

**Чекпоинт:** открыть браузер → в списке вакансий цветные бейджи → клик → dropdown → сменить статус → бейдж обновился → фильтр работает

---

### Этап 5: Frontend — Заметки
**Задачи:** 2.3.4, 2.3.5, 2.3.6, 2.3.7
**Что делаем:**
- Секция заметок в карточке
- Карточки заметок
- Модалка создания/редактирования
- Удаление с подтверждением
- Бейдж количества в списке

**Чекпоинт:** открыть вакансию → добавить заметку → она появилась → отредактировать → "(изменено)" → удалить → подтвердить → исчезла → в списке вакансий виден бейдж с числом

---

### Этап 6: Воронка на главной
**Задачи:** 1.5.7
**Что делаем:**
- SQL-запрос подсчёта по статусам
- Горизонтальная полоска-воронка

**Чекпоинт:** на главной видна воронка `Найдено: N → Откликнулись: N → Собесы: N → Офферы: N`

---

## Референсы из JobSync (полный список файлов)

| Что | Файл в JobSync | Что взять |
|-----|----------------|-----------|
| Список статусов | `src/lib/constants.ts:38-46` | Названия и значения статусов |
| Логика смены статуса | `src/actions/job.actions.ts:391-433` | Паттерн автоматического applied при interview |
| Бейджи статусов | `src/components/myjobs/MyJobsTable.tsx:128-140` | Цвета и стили бейджей |
| Схема заметок | `prisma/schema.prisma:415-427` | Структура таблицы Note |
| CRUD заметок | `src/actions/note.actions.ts` (весь файл) | Логика всех операций, определение is_edited |
| Секция заметок | `src/components/myjobs/NotesSection.tsx` | Сворачиваемый блок, загрузка, состояния |
| Карточка заметки | `src/components/myjobs/NoteCard.tsx` | Отображение даты, "(edited)", кнопки |
| Форма заметки | `src/components/myjobs/NoteDialog.tsx` | Модалка создания/редактирования |
| Dropdown статуса | `src/components/myjobs/MyJobsTable.tsx:186-199` | Подменю смены статуса |

---

## Важные отличия: что НЕ копировать из JobSync

| Аспект | JobSync | job_finder_ai | Решение |
|--------|---------|---------------|---------|
| Rich text | TipTap editor | — | Простой `<textarea>`, plain text достаточно |
| userId в заметках | Есть (multi-user) | Нет (single-user) | Убрать поле userId |
| UUID | Используется | — | Integer autoincrement |
| Отдельная таблица статусов | `JobStatus` model | — | Строковое поле `status` в таблице вакансий |
| Валидация Zod | NoteFormSchema | — | Простая проверка `if not content: return 400` |
| React + server actions | Next.js | — | Vanilla JS + fetch API |
