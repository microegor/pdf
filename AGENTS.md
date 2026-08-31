# Требования к коммитам

Документ зафиксирован по реальной истории `git log --oneline` репозитория `pdf`.

## 1. Формат

Используется Conventional Commits без scope:

```
<type>: <краткое описание>
```

- `type` — один из разрешённых типов (см. ниже)
- двоеточие + пробел
- описание — на английском, с маленькой буквы, в императиве, без точки в конце
- заголовок <= 72 символов
- тело коммита (опционально) — отделено пустой строкой от заголовка

```bash
git log --oneline -5
# 3bf889a style: format App and UI components with prettier
# c0b2daf style: normalize quoting and formatting across reader module and tests
# 2de3456 refactor: replace bytesToHex with HexView in StreamView for raw and decoded data
# 125e87e feat: add HexView component with virtualized hex viewer and byte selection
# 3438d97 feat: refactor bytesToHex function for improved readability and performance
```

## 2. Типы

| type | когда использовать | пример из истории |
|------|-------------------|-------------------|
| `feat` | новая функциональность, компонент, проп | `feat: add DropZone component for file upload with drag-and-drop support` |
| `refactor` | рефактор без нового функционала, переименование | `refactor: rename type to kind and pdfType in PdfListItem; update related functions` |
| `style` | форматирование, prettier, кавычки, пробелы | `style: format App and UI components with prettier` |
| `fix` | исправление бага (в истории не встречался, но разрешён) | `fix: handle truncated XRef table` |
| `chore` | зависимости, конфиги | `feat: add pako dependency...` в истории идёт как `feat`, `chore` допустим |

> В истории `feat:` используется даже для `feat: refactor ...` — это считается нормой проекта. `style: formatting` тоже встречается (`66941ce`).

Scope `feat(scope):` в истории **не используется** — не добавлять `feat(reader):`.

## 3. Язык и стиль описания

- Только английский.
- Начинать с глагола: `add`, `implement`, `integrate`, `replace`, `normalize`, `refactor`, `rename`.
- Без `Add`/`Refactor` с большой буквы.
- Без точки в конце заголовка.

Хорошо:
```
feat: add filtering functionality for PDF objects in App component
feat: implement PdfValue component for rendering PDF object values; refactor DictionaryView and StreamView to use PdfValue
```

Плохо:
```
Feat: Add filtering.   # заглавная + точка
feat(reader): add ...  # scope
добавлен компонент     # русский
```

## 4. Тело коммита

Для крупных изменений добавлять буллет-список через пустую строку (как в `ffceaf5`):

```
feat: add PDF reader types and XRef parsing modules

- Introduced types for PDF objects, including PDFNull, PDFBoolean...
- Implemented XRef parsing functionality with support for both XRef tables and XRef streams.
- Added flate decompression utility using pako for handling compressed data.
- Created a unified index for XRef module exports.
```

## 5. Атомарность

Текущие изменения разбиваются на несколько коммитов по смыслу, а не одним большим. Правило из последних 4 коммитов:

- `feat: add HexView component...` — только новые файлы `src/components/HexView/*`
- `refactor: replace bytesToHex with HexView...` — только `src/components/Stream/*`
- `style: normalize quoting and formatting across reader module and tests` — только `src/reader/**`
- `style: format App and UI components with prettier` — только `src/App.tsx`, `src/components/**`, `style/App.css`

Не смешивать форматирование (`'` → `"` , prettier) с функциональными изменениями в одном коммите.

## 6. Merge-коммиты

Формат GitHub по умолчанию сохраняется:

```
Merge pull request #4 from microegor/feat/trea
```

Не переписывать вручную.

## 7. Технические требования

- `core.autocrlf` даёт варнинг `LF will be replaced by CRLF` — игнорировать, коммитить с `LF`.
- Форматтер — `oxfmt` (`.oxfmtrc.json`), кавычки — двойные `"` (см. `style: normalize quoting...`).
- Каждый коммит должен собираться: `pnpm build` / `vitest` без ошибок.

## 8. Шаблон для агента

```bash
git add <логическая группа файлов>
git commit -m "feat: add HexView component with virtualized hex viewer and byte selection"
git add <следующая группа>
git commit -m "refactor: replace bytesToHex with HexView in StreamView for raw and decoded data"
git add src/reader/** src/reader/__tests__/**
git commit -m "style: normalize quoting and formatting across reader module and tests"
git add src/App.tsx src/components/** style/**
git commit -m "style: format App and UI components with prettier"
```
