# ТЗ: Расширенные статусы и заметки к вакансиям

**Целевой репозиторий:** https://github.com/moviesm33333/job_finder_ai
**Репозиторий-референс:** https://github.com/moviesm33333/jobsync (JobSync)
**Дата:** 2026-03-19

---

## Общее описание

Перенос двух фич из JobSync в job_finder_ai:

1. **Расширенные статусы вакансий** — добавление статусов `interview`, `offer`, `rejected`, `accepted` для отслеживания воронки после отклика
2. **Заметки к вакансиям** — возможность добавлять, редактировать и удалять текстовые заметки к каждой вакансии

---

## Фича 1: Расширенные статусы вакансий

### Текущее состояние (job_finder_ai)

Предполагаемые существующие статусы: `new`, `manual`, `auto`, `applied`, `snoozed`, `trash`.
После статуса `applied` — нет дальнейшего трекинга.

### Что добавить

| Статус | Значение | Описание | Цвет (предложение) |
|--------|----------|----------|---------------------|
| `interview` | Приглашён на собеседование | Компания ответила, назначена встреча | Зелёный `#22C55E` |
| `offer` | Получен оффер | Компания сделала предложение | Синий `#3B82F6` |
| `rejected` | Отказ | Компания отказала или кандидат отказался | Красный `#EF4444` |
| `accepted` | Принято | Кандидат принял оффер и выходит на работу | Золотой `#EAB308` |

### Референс из JobSync

**Файл:** `src/lib/constants.ts:38-46`
```typescript
export const JOB_STATUSES = [
  { label: "Draft", value: "draft" },
  { label: "Applied", value: "applied" },
  { label: "Interview", value: "interview" },
  { label: "Offer", value: "offer" },
  { label: "Rejected", value: "rejected" },
  { label: "Expired", value: "expired" },
  { label: "Archived", value: "archived" },
] as const;
```

**Файл:** `src/actions/job.actions.ts:391-433` — Логика смены статуса:
```typescript
export const updateJobStatus = async (jobId: string, status: JobStatus) => {
  const dataToUpdate = () => {
    switch (status.value) {
      case "applied":
        return { statusId: status.id, applied: true, appliedDate: new Date() };
      case "interview":
        return { statusId: status.id, applied: true }; // interview подразумевает applied
      default:
        return { statusId: status.id };
    }
  };
  // ...
};
```

**Ключевой паттерн:** при переходе в `interview` автоматически выставляется `applied: true`. Это важно — если пользователь пропустил этап отклика, система сама пометит.

**Файл:** `src/components/myjobs/MyJobsTable.tsx:128-140` — Рендеринг бейджей:
```tsx
<Badge className={cn(
  "w-[70px] justify-center",
  job.Status?.value === "applied" && "bg-cyan-500",
  job.Status?.value === "interview" && "bg-green-500"
)}>
  {job.Status?.label}
</Badge>
```

### Задачи для реализации

#### Backend (Python/Flask/SQLAlchemy)

1. **Миграция БД** — добавить новые значения в enum/список допустимых статусов
   ```python
   # В модели Vacancy (или как называется) расширить допустимые статусы:
   VACANCY_STATUSES = [
       'new', 'manual', 'auto', 'applied', 'snoozed', 'trash',
       'interview', 'offer', 'rejected', 'accepted'  # НОВЫЕ
   ]
   ```

2. **API-эндпоинт** — обновить `PATCH /api/vacancy/<id>/status` (или аналог), чтобы принимал новые статусы

3. **Бизнес-логика** — при переходе в `interview` автоматически ставить `applied=True` и `applied_date` если они пусты (паттерн из JobSync)

4. **Валидация переходов** (опционально) — разрешённые переходы:
   ```
   applied → interview → offer → accepted
                      ↘ rejected
              interview → rejected
   ```

#### Frontend (vanilla JS)

5. **Кнопки смены статуса** — в карточке вакансии добавить dropdown или набор кнопок для смены статуса (после `applied`):
   - «Интервью» / «Оффер» / «Отказ» / «Принято»

6. **Цветовые бейджи** — отображать статус цветным бейджем:
   ```css
   .status-interview { background: #22C55E; color: white; }
   .status-offer     { background: #3B82F6; color: white; }
   .status-rejected  { background: #EF4444; color: white; }
   .status-accepted  { background: #EAB308; color: white; }
   ```

7. **Фильтр по статусам** — добавить новые статусы в фильтры списка вакансий

8. **Счётчики** — на главной показывать количество вакансий в каждом статусе (мини-воронка)

---

## Фича 2: Заметки к вакансиям

### Описание

Возможность прикреплять к вакансии текстовые заметки: результаты собеседований, впечатления, контакты HR, условия оффера и т.д.

### Референс из JobSync

**Схема БД:** `prisma/schema.prisma:415-427`
```prisma
model Note {
  id        String   @id @default(uuid())
  jobId     String
  job       Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  content   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([jobId])
  @@index([userId])
}
```

**CRUD-операции:** `src/actions/note.actions.ts`
- `getNotesByJobId(jobId)` — получить все заметки вакансии, отсортированные по дате (desc)
- `addNote({ jobId, content })` — создать заметку
- `updateNote({ id, jobId, content })` — обновить заметку
- `deleteNote(noteId)` — удалить заметку

**Отслеживание редактирования:**
```typescript
// Определение "была ли заметка отредактирована" (разница > 1 сек между created и updated)
isEdited: note.updatedAt.getTime() - note.createdAt.getTime() > 1000
```

**UI-компоненты:**

1. **NotesSection** (`src/components/myjobs/NotesSection.tsx`) — сворачиваемый блок с бейджем-счётчиком и кнопкой "New Note"
2. **NoteCard** (`src/components/myjobs/NoteCard.tsx`) — карточка заметки с датой, меткой "(edited)", кнопками редактирования и удаления
3. **NoteDialog** (`src/components/myjobs/NoteDialog.tsx`) — модальное окно для создания/редактирования заметки с rich-text редактором

### Задачи для реализации

#### Backend (Python/Flask/SQLAlchemy)

1. **Новая таблица в БД:**
   ```python
   class VacancyNote(db.Model):
       __tablename__ = 'vacancy_notes'

       id = db.Column(db.Integer, primary_key=True, autoincrement=True)
       vacancy_id = db.Column(db.Integer, db.ForeignKey('vacancies.id', ondelete='CASCADE'), nullable=False, index=True)
       content = db.Column(db.Text, nullable=False)
       created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
       updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

       vacancy = db.relationship('Vacancy', backref=db.backref('notes', lazy='dynamic', cascade='all, delete-orphan'))
   ```

2. **Миграция** — создать таблицу `vacancy_notes` (Alembic или ручная миграция)

3. **API-эндпоинты:**
   ```
   GET    /api/vacancy/<vacancy_id>/notes          — список заметок
   POST   /api/vacancy/<vacancy_id>/notes          — создать заметку { content: "..." }
   PUT    /api/vacancy/<vacancy_id>/notes/<note_id> — обновить заметку { content: "..." }
   DELETE /api/vacancy/<vacancy_id>/notes/<note_id> — удалить заметку
   ```

4. **Формат ответа:**
   ```json
   {
     "id": 1,
     "vacancy_id": 42,
     "content": "Текст заметки",
     "created_at": "2026-03-19T10:30:00",
     "updated_at": "2026-03-19T10:30:00",
     "is_edited": false
   }
   ```

#### Frontend (vanilla JS)

5. **Секция заметок в карточке вакансии:**
   - Сворачиваемый блок "Заметки (N)" под описанием вакансии
   - Кнопка "+ Добавить заметку"
   - Список заметок в обратном хронологическом порядке

6. **Карточка заметки:**
   ```html
   <div class="note-card">
     <div class="note-header">
       <span class="note-date">19 мар 2026, 10:30</span>
       <span class="note-edited">(изменено)</span>
       <div class="note-actions">
         <button class="btn-edit" title="Редактировать">✏️</button>
         <button class="btn-delete" title="Удалить">🗑️</button>
       </div>
     </div>
     <div class="note-content">Текст заметки...</div>
   </div>
   ```

7. **Форма создания/редактирования:**
   - Модальное окно (или inline-форма)
   - Textarea для ввода текста (plain text — без rich-text, для простоты)
   - Кнопки "Сохранить" / "Отмена"

8. **Подтверждение удаления** — confirm-диалог перед удалением заметки

9. **Бейдж-счётчик** — показывать количество заметок в списке вакансий (как в JobSync — в колонке с названием вакансии)

---

## Приоритет и порядок реализации

### Этап 1: Backend (оба фичи одновременно)
1. Миграция БД — новые статусы + таблица `vacancy_notes`
2. API-эндпоинты для заметок
3. Обновление API статусов

### Этап 2: Frontend — Статусы
4. Бейджи со статусами
5. Dropdown смены статуса
6. Фильтры

### Этап 3: Frontend — Заметки
7. Секция заметок в карточке
8. Форма создания/редактирования
9. Удаление с подтверждением

### Этап 4: Полировка
10. Счётчики на главной
11. Бейдж количества заметок в списке

---

## Важные отличия от JobSync

| Аспект | JobSync | job_finder_ai |
|--------|---------|---------------|
| Стек | Next.js + React + Prisma | Flask + vanilla JS + SQLAlchemy |
| Rich text | TipTap editor | Простой textarea (достаточно) |
| Auth | NextAuth (multi-user) | Однопользовательский (без userId в заметках) |
| ID | UUID | Integer autoincrement |
| Статусы | В отдельной таблице JobStatus | Строковое поле в таблице вакансий |

**Примечание:** Если в job_finder_ai нет авторизации (однопользовательское приложение), поле `userId` в заметках не нужно. Это упрощает реализацию.

---

## Оценка трудозатрат

| Задача | Сложность | Ориентировочно |
|--------|-----------|----------------|
| Миграция БД | Низкая | 1 час |
| API заметок | Низкая | 2 часа |
| API статусов | Низкая | 1 час |
| Frontend статусов | Средняя | 3 часа |
| Frontend заметок | Средняя | 4 часа |
| Тестирование | Средняя | 2 часа |
| **Итого** | | **~13 часов** |
