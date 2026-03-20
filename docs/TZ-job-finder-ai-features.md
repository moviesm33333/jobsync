# ТЗ: Расширенные статусы + Заметки для HH Job Hunter

**Целевой репозиторий:** https://github.com/moviesm33333/job_finder
**Репозиторий-референс:** https://github.com/moviesm33333/jobsync
**Дата:** 2026-03-20

---

## Реальная архитектура job_finder (изучено по коду)

| Что | Реальность |
|-----|-----------|
| **Фреймворк** | **FastAPI** (НЕ Flask) |
| **ORM** | SQLAlchemy async + aiosqlite |
| **БД** | SQLite (`data/hh_hunter.db`) |
| **Frontend** | Один файл `static/index.html` (vanilla JS) |
| **Браузер** | Playwright (антидетект, stealth mode) — только для логина и откликов |
| **Поиск вакансий** | Публичный API `api.hh.ru` (httpx, без браузера) |
| **AI** | NeuroAPI (OpenAI-совместимый прокси) — 4 модели по задачам |
| **Auth HH.ru** | Playwright: email/телефон → OTP → сохранение cookies в `hh_session.json` |
| **Архитектура** | Однопользовательское приложение |

### Текущие статусы вакансий

Определены в `hh_automation/database.py:48`:
```python
status = Column(Text, default="new", index=True)  # new/manual/auto/applied/snoozed/trash
```

### Текущие табы фронтенда (`static/index.html`)

| Таб | Статусы | Что показывает |
|-----|---------|---------------|
| Ручная очередь | `manual` | Карточки с AI-саммари, письмом, кнопками |
| Авто-очередь | `auto` | Компактные карточки, кнопка "Отправить все отклики" |
| Настройки | — | Keywords, резюме, AI-модели, расписание |
| История | `applied`, `snoozed`, `trash` | Фильтры-кнопки, компактные карточки |

### Текущий API смены статуса

`PATCH /api/vacancies/{vacancy_db_id}` в `server.py:1055-1068`:
```python
class VacancyPatch(BaseModel):
    status: Optional[str] = None
    cover_letter: Optional[str] = None
    snoozed_until: Optional[datetime] = None
    chosen_resume_id: Optional[int] = None
```
Просто `setattr` без какой-либо логики — любой статус принимается.

### Текущий флоу бота (полный цикл)

```
1. Парсер (parser.py → search.py):
   search_vacancies() → API hh.ru → список VacancyData
   → дедупликация по vacancy_id (batch SELECT)
   → fetch_vacancy_description() (параллельно, semaphore=10)
   → _is_manual() → salary >= threshold ИЛИ keyword в описании
   → сохранение: status="manual" или "auto"

2. AI-обработка (ai.py) — ещё НЕ интегрирована в парсер:
   → choose_resume() → score_relevance() → generate_summary() → generate_cover_letter()

3. Автоотклик (apply.py):
   → browser_manager.get_page_ctx(use_session=True)
   → 4 стратегии отклика (ссылка/dropdown/кнопка/post-apply)
   → проверка капчи, проверка "уже откликались"
   → status="applied" при успехе
```

---

## Фича 1: Расширенные статусы вакансий

### Что добавляем

| Статус | Значение | Цвет CSS-переменная |
|--------|----------|---------------------|
| `interview` | Приглашён на собеседование | `#22C55E` (var(--green)) |
| `offer` | Получен оффер | `#3B82F6` (var(--blue)) |
| `rejected` | Отказ (любая сторона) | `#EF4444` (var(--red)) |
| `accepted` | Принял оффер | `#EAB308` (var(--orange)) |

### Граф переходов

```
        ┌──→ snoozed (отложить)
        │
new ──→ manual ──→ applied ──→ interview ──→ offer ──→ accepted
  │                    │           │           │
  └──→ auto ──→ applied│           └──→ rejected
                       └──→ rejected
        │
        └──→ trash
```

Из `trash` → можно восстановить в `manual` или `auto` (уже есть в коде).

### Автоматика при смене статуса

В текущем коде `PATCH /api/vacancies/{id}` — просто `setattr`. Добавляем логику:

```python
# В server.py, в patch_vacancy():
if patch.status in ('interview', 'offer', 'accepted'):
    # Автоотклик подразумевается — ставим applied-дату если нет
    if not vacancy.applied_date:
        vacancy.applied_date = datetime.utcnow()
```

**НО:** В текущей модели `Vacancy` нет поля `applied_date`. Нужно добавить.

### Задачи backend

**1.1. Добавить поля в модель Vacancy (`database.py`)**

```python
# После строки 50 (snoozed_until):
applied_date = Column(DateTime, nullable=True)
status_changed_at = Column(DateTime, nullable=True)
```

Миграция (в `init_db` или отдельно):
```python
# В _migrate_model_columns или новая функция:
ALTER TABLE vacancies ADD COLUMN applied_date DATETIME;
ALTER TABLE vacancies ADD COLUMN status_changed_at DATETIME;
```

**1.2. Добавить бизнес-логику в `patch_vacancy` (`server.py:1055`)**

Сейчас:
```python
for field, value in patch.model_dump(exclude_none=True).items():
    setattr(vacancy, field, value)
```

Добавить ДО этого цикла:
```python
VALID_STATUSES = {'new', 'manual', 'auto', 'applied', 'snoozed', 'trash',
                  'interview', 'offer', 'rejected', 'accepted'}

if patch.status:
    if patch.status not in VALID_STATUSES:
        raise HTTPException(400, f"Недопустимый статус: {patch.status}")

    # Автоматика: interview/offer/accepted подразумевают applied
    if patch.status in ('interview', 'offer', 'accepted'):
        if not vacancy.applied_date:
            vacancy.applied_date = datetime.utcnow()

    vacancy.status_changed_at = datetime.utcnow()
```

**1.3. Добавить `applied_date` в VacancyOut и VacancyPatch (`server.py`)**

```python
class VacancyOut(BaseModel):
    # ... существующие поля ...
    applied_date: Optional[datetime] = None
    status_changed_at: Optional[datetime] = None
    notes_count: int = 0  # для фичи 2
```

**1.4. Новый эндпоинт — счётчики по статусам**

```python
@app.get("/api/vacancies/counts")
async def vacancy_counts(db: AsyncSession = Depends(get_session)):
    from sqlalchemy import func
    result = await db.execute(
        select(Vacancy.status, func.count()).group_by(Vacancy.status)
    )
    counts = {row[0]: row[1] for row in result.all()}
    return counts
```

Ответ: `{"new": 5, "manual": 12, "auto": 30, "applied": 42, "interview": 3, ...}`

### Задачи frontend (`static/index.html`)

**1.5. Новые фильтры в табе "История"**

Сейчас (`index.html:352-358`):
```html
<button class="filter-btn active" data-status="applied">Откликнулся</button>
<button class="filter-btn" data-status="snoozed">Отложенные</button>
<button class="filter-btn" data-status="trash">Мусор</button>
```

Добавить:
```html
<button class="filter-btn" data-status="interview">Собеседования</button>
<button class="filter-btn" data-status="offer">Офферы</button>
<button class="filter-btn" data-status="rejected">Отказы</button>
<button class="filter-btn" data-status="accepted">Принятые</button>
```

**1.6. Dropdown смены статуса в карточках**

В `renderHistoryCard()` (`index.html:771-789`) и `renderManualCard()` (`index.html:710-745`) — добавить `<select>` для смены статуса:

```javascript
function renderStatusSelect(vacancyId, currentStatus) {
  const statuses = [
    {value: 'manual', label: 'Ручная'},
    {value: 'auto', label: 'Авто'},
    {value: 'applied', label: 'Откликнулся'},
    {value: 'interview', label: 'Собеседование'},
    {value: 'offer', label: 'Оффер'},
    {value: 'rejected', label: 'Отказ'},
    {value: 'accepted', label: 'Принято'},
    {value: 'snoozed', label: 'Отложено'},
    {value: 'trash', label: 'Мусор'},
  ];
  const options = statuses.map(s =>
    `<option value="${s.value}" ${s.value === currentStatus ? 'selected' : ''}>${s.label}</option>`
  ).join('');
  return `<select class="status-select" onchange="patchVacancy(${vacancyId}, this.value)">${options}</select>`;
}
```

**1.7. Цветные бейджи статусов**

CSS (добавить в `<style>` в `index.html`):
```css
.status-select { padding:4px 8px; border-radius:6px; font-size:0.75rem; }
.badge-status-interview { background:#22c55e22; color:#22c55e; }
.badge-status-offer     { background:#3b82f622; color:#3b82f6; }
.badge-status-rejected  { background:#ef444422; color:#ef4444; }
.badge-status-accepted  { background:#eab30822; color:#eab308; }
```

**1.8. Воронка на главной (над табами)**

```html
<div class="funnel" id="funnel" style="display:none">
  <span class="funnel-item" style="color:var(--text2)">Найдено: <b id="fAll">0</b></span>
  <span class="funnel-arrow">→</span>
  <span class="funnel-item" style="color:var(--accent)">Отклики: <b id="fApplied">0</b></span>
  <span class="funnel-arrow">→</span>
  <span class="funnel-item" style="color:var(--green)">Собесы: <b id="fInterview">0</b></span>
  <span class="funnel-arrow">→</span>
  <span class="funnel-item" style="color:var(--blue)">Офферы: <b id="fOffer">0</b></span>
  <span class="funnel-arrow">→</span>
  <span class="funnel-item" style="color:var(--orange)">Принято: <b id="fAccepted">0</b></span>
</div>
```

JS:
```javascript
async function loadFunnel() {
  const counts = await api('/api/vacancies/counts');
  const all = Object.values(counts).reduce((a,b) => a+b, 0);
  document.getElementById('fAll').textContent = all;
  document.getElementById('fApplied').textContent = counts.applied || 0;
  document.getElementById('fInterview').textContent = counts.interview || 0;
  document.getElementById('fOffer').textContent = counts.offer || 0;
  document.getElementById('fAccepted').textContent = counts.accepted || 0;
  document.getElementById('funnel').style.display = '';
}
// Вызывать при инициализации и после смены статуса
```

---

## Фича 2: Заметки к вакансиям

### Задачи backend

**2.1. Новая модель `VacancyNote` (`database.py`)**

Добавить после класса `Resume`:

```python
class VacancyNote(Base):
    __tablename__ = "vacancy_notes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    vacancy_id = Column(Integer, ForeignKey("vacancies.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    vacancy = relationship("Vacancy", back_populates="notes")
```

И в модели `Vacancy` добавить:
```python
notes = relationship("VacancyNote", back_populates="vacancy", cascade="all, delete-orphan")
```

Таблица создастся автоматически через `Base.metadata.create_all` в `init_db()`.

**2.2. Pydantic-схемы (`server.py`)**

```python
class NoteOut(BaseModel):
    id: int
    vacancy_id: int
    content: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    is_edited: bool = False

    model_config = {"from_attributes": True}

class NoteCreate(BaseModel):
    content: str

class NoteUpdate(BaseModel):
    content: str
```

**2.3. CRUD-эндпоинты (`server.py`)**

```python
@app.get("/api/vacancies/{vacancy_id}/notes", response_model=list[NoteOut])
async def list_notes(vacancy_id: int, db: AsyncSession = Depends(get_session)):
    result = await db.execute(
        select(VacancyNote)
        .where(VacancyNote.vacancy_id == vacancy_id)
        .order_by(VacancyNote.created_at.desc())
    )
    notes = result.scalars().all()
    return [
        NoteOut(
            id=n.id, vacancy_id=n.vacancy_id, content=n.content,
            created_at=n.created_at, updated_at=n.updated_at,
            is_edited=(n.updated_at - n.created_at).total_seconds() > 1
                      if n.updated_at and n.created_at else False,
        )
        for n in notes
    ]

@app.post("/api/vacancies/{vacancy_id}/notes", response_model=NoteOut, status_code=201)
async def create_note(vacancy_id: int, body: NoteCreate, db: AsyncSession = Depends(get_session)):
    vacancy = await db.get(Vacancy, vacancy_id)
    if not vacancy:
        raise HTTPException(404, "Vacancy not found")
    if not body.content.strip():
        raise HTTPException(400, "Content cannot be empty")
    note = VacancyNote(vacancy_id=vacancy_id, content=body.content.strip())
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return NoteOut(id=note.id, vacancy_id=note.vacancy_id, content=note.content,
                   created_at=note.created_at, updated_at=note.updated_at, is_edited=False)

@app.put("/api/vacancies/{vacancy_id}/notes/{note_id}", response_model=NoteOut)
async def update_note(vacancy_id: int, note_id: int, body: NoteUpdate, db: AsyncSession = Depends(get_session)):
    note = await db.get(VacancyNote, note_id)
    if not note or note.vacancy_id != vacancy_id:
        raise HTTPException(404, "Note not found")
    if not body.content.strip():
        raise HTTPException(400, "Content cannot be empty")
    note.content = body.content.strip()
    note.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(note)
    return NoteOut(id=note.id, vacancy_id=note.vacancy_id, content=note.content,
                   created_at=note.created_at, updated_at=note.updated_at,
                   is_edited=(note.updated_at - note.created_at).total_seconds() > 1)

@app.delete("/api/vacancies/{vacancy_id}/notes/{note_id}", status_code=204)
async def delete_note(vacancy_id: int, note_id: int, db: AsyncSession = Depends(get_session)):
    note = await db.get(VacancyNote, note_id)
    if not note or note.vacancy_id != vacancy_id:
        raise HTTPException(404, "Note not found")
    await db.delete(note)
    await db.commit()
```

**2.4. Поле `notes_count` в списке вакансий**

В `list_vacancies()` (`server.py:1031-1052`) — добавить подсчёт:

```python
from sqlalchemy import func

# После получения списка вакансий:
vacancy_ids = [v.id for v in vacancies]
if vacancy_ids:
    counts_result = await db.execute(
        select(VacancyNote.vacancy_id, func.count())
        .where(VacancyNote.vacancy_id.in_(vacancy_ids))
        .group_by(VacancyNote.vacancy_id)
    )
    notes_counts = dict(counts_result.all())
else:
    notes_counts = {}

# В цикле формирования out:
d.notes_count = notes_counts.get(v.id, 0)
```

### Задачи frontend (`static/index.html`)

**2.5. Секция заметок в карточке вакансии**

В `renderManualCard()` и `renderHistoryCard()` — добавить блок заметок перед `card-actions`:

```javascript
function renderNotesSection(vacancyId, notesCount) {
  return `
    <div class="notes-section" id="notes-section-${vacancyId}">
      <button class="toggle-desc" onclick="toggleNotes(${vacancyId})">
        📝 Заметки <span class="badge badge-none">${notesCount}</span>
      </button>
      <div class="notes-list" id="notes-list-${vacancyId}" style="display:none"></div>
      <div id="note-form-${vacancyId}" style="display:none; margin:8px 0;">
        <textarea id="note-text-${vacancyId}" rows="3" style="width:100%" placeholder="Текст заметки..."></textarea>
        <div style="display:flex;gap:8px;margin-top:6px">
          <button class="btn btn-primary btn-sm" onclick="saveNote(${vacancyId})">Сохранить</button>
          <button class="btn btn-outline btn-sm" onclick="cancelNote(${vacancyId})">Отмена</button>
        </div>
      </div>
      <button class="btn btn-outline btn-sm" onclick="openNoteForm(${vacancyId})" style="margin-top:4px" id="add-note-btn-${vacancyId}">+ Заметка</button>
    </div>`;
}
```

**2.6. JS-логика заметок**

```javascript
let editingNoteId = null;
let editingVacancyId = null;

async function toggleNotes(vacancyId) {
  const list = document.getElementById('notes-list-' + vacancyId);
  if (list.style.display === 'none') {
    list.style.display = '';
    await loadNotes(vacancyId);
  } else {
    list.style.display = 'none';
  }
}

async function loadNotes(vacancyId) {
  const notes = await api(`/api/vacancies/${vacancyId}/notes`);
  const list = document.getElementById('notes-list-' + vacancyId);
  if (!notes || notes.length === 0) {
    list.innerHTML = '<p style="color:var(--text2);font-size:0.8rem;padding:8px">Нет заметок</p>';
    return;
  }
  list.innerHTML = notes.map(n => `
    <div class="note-card" id="note-${n.id}" style="border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin:6px 0;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="color:var(--text2);font-size:0.75rem">
          ${new Date(n.created_at).toLocaleString('ru')}
          ${n.is_edited ? '<span style="color:var(--text2)">(изменено)</span>' : ''}
        </span>
        <span>
          <button class="btn-icon" onclick="editNote(${vacancyId},${n.id},'${esc(n.content).replace(/'/g,"\\'")}')">✎</button>
          <button class="btn-icon" onclick="confirmDeleteNote(${vacancyId},${n.id})">✕</button>
        </span>
      </div>
      <div style="font-size:0.85rem;white-space:pre-wrap">${esc(n.content)}</div>
    </div>
  `).join('');
}

function openNoteForm(vacancyId) {
  editingNoteId = null;
  editingVacancyId = vacancyId;
  document.getElementById('note-text-' + vacancyId).value = '';
  document.getElementById('note-form-' + vacancyId).style.display = '';
  document.getElementById('add-note-btn-' + vacancyId).style.display = 'none';
}

function cancelNote(vacancyId) {
  document.getElementById('note-form-' + vacancyId).style.display = 'none';
  document.getElementById('add-note-btn-' + vacancyId).style.display = '';
  editingNoteId = null;
}

function editNote(vacancyId, noteId, content) {
  editingNoteId = noteId;
  editingVacancyId = vacancyId;
  document.getElementById('note-text-' + vacancyId).value = content;
  document.getElementById('note-form-' + vacancyId).style.display = '';
  document.getElementById('add-note-btn-' + vacancyId).style.display = 'none';
}

async function saveNote(vacancyId) {
  const content = document.getElementById('note-text-' + vacancyId).value.trim();
  if (!content) return alert('Заметка не может быть пустой');

  if (editingNoteId) {
    await api(`/api/vacancies/${vacancyId}/notes/${editingNoteId}`, {
      method: 'PUT', body: { content }
    });
  } else {
    await api(`/api/vacancies/${vacancyId}/notes`, {
      method: 'POST', body: { content }
    });
  }
  cancelNote(vacancyId);
  await loadNotes(vacancyId);
}

async function confirmDeleteNote(vacancyId, noteId) {
  if (!confirm('Удалить заметку?')) return;
  await api(`/api/vacancies/${vacancyId}/notes/${noteId}`, { method: 'DELETE' });
  await loadNotes(vacancyId);
}
```

**2.7. Бейдж количества заметок в списке**

В `renderManualCard()` и `renderHistoryCard()` — добавить в `card-meta`:
```javascript
${v.notes_count > 0 ? `<span class="badge badge-none">📝 ${v.notes_count}</span>` : ''}
```

---

## Пошаговый план с чекпоинтами

### Этап 1: Миграция БД
**Файлы:** `hh_automation/database.py`
**Что:**
- Добавить поля `applied_date`, `status_changed_at` в `Vacancy`
- Добавить модель `VacancyNote`
- Добавить миграцию ALTER TABLE в `init_db()`

**Чекпоинт:**
```bash
# Запуск без ошибок
python -c "from hh_automation.database import init_db; import asyncio; asyncio.run(init_db())"
# Таблица создана
sqlite3 data/hh_hunter.db ".schema vacancy_notes"
# Новые колонки есть
sqlite3 data/hh_hunter.db "PRAGMA table_info(vacancies);" | grep applied_date
```

### Этап 2: Backend API
**Файлы:** `hh_automation/server.py`
**Что:**
- Pydantic-схемы `NoteOut`, `NoteCreate`, `NoteUpdate`
- 4 CRUD-эндпоинта для заметок
- Бизнес-логика смены статуса в `patch_vacancy`
- Эндпоинт `/api/vacancies/counts`
- Поле `notes_count` в `list_vacancies`

**Чекпоинт:**
```bash
# Запуск сервера
uvicorn hh_automation.server:app --port 8000
# CRUD заметок
curl -s -X POST localhost:8000/api/vacancies/1/notes -H 'Content-Type: application/json' -d '{"content":"тест"}'
curl -s localhost:8000/api/vacancies/1/notes
# Счётчики
curl -s localhost:8000/api/vacancies/counts
# Статус с автоматикой
curl -s -X PATCH localhost:8000/api/vacancies/1 -H 'Content-Type: application/json' -d '{"status":"interview"}'
```

### Этап 3: Frontend — Статусы
**Файлы:** `static/index.html`
**Что:**
- Новые фильтры-кнопки в табе "История"
- Dropdown смены статуса в карточках
- Цветные бейджи статусов
- Воронка над табами

**Чекпоинт:** открыть `localhost:8000` → видна воронка → в истории новые фильтры → dropdown работает

### Этап 4: Frontend — Заметки
**Файлы:** `static/index.html`
**Что:**
- Секция заметок в карточках (сворачиваемая)
- Inline-форма создания/редактирования
- Удаление с confirm
- Бейдж количества в списке

**Чекпоинт:** открыть вакансию → "+ Заметка" → написать → сохранить → видна → редактировать → "(изменено)" → удалить → подтвердить → исчезла

---

## Конкретные файлы для изменения

| Файл | Что менять |
|------|-----------|
| `hh_automation/database.py` | +поля `applied_date`, `status_changed_at` в Vacancy; +модель `VacancyNote`; +миграция в `init_db` |
| `hh_automation/server.py` | +схемы NoteOut/NoteCreate/NoteUpdate; +4 CRUD эндпоинта; +логика в patch_vacancy; +/api/vacancies/counts; +notes_count в list_vacancies |
| `static/index.html` | +CSS бейджей; +фильтры в истории; +dropdown статуса; +воронка; +секция заметок; +JS логика заметок |

Больше ничего менять не нужно. Парсер, AI, apply, browser, scheduler — не трогаем.

---

## Референсы из JobSync

| Что | Файл в JobSync | Что взять |
|-----|----------------|-----------|
| Автоматика applied при interview | `src/actions/job.actions.ts:391-433` | Паттерн |
| Схема заметок | `prisma/schema.prisma:415-427` | Структура |
| CRUD заметок | `src/actions/note.actions.ts` | Логика is_edited |
| Секция заметок UI | `src/components/myjobs/NotesSection.tsx` | Сворачивание, бейдж |
