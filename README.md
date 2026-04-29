# Практична робота 1 (Частина 2), Варіант 2: Рефакторинг API-клієнта

## Структура

```text
lab-01-part-2/
├── original/
│   └── apiClient.js
├── refactored/
│   └── apiClient.ts
├── tests/
│   └── apiClient.test.ts
├── ai-review.md
├── jest.config.cjs
├── package.json
├── tsconfig.json
└── README.md
```

## Що зроблено

1. Проведено AI code review legacy-коду (`ai-review.md`).
2. Виконано рефакторинг:
   - переписано на `async/await` + `fetch` API,
   - додано універсальну `request` функцію,
   - додано retry-логіку (до 3 спроб) з exponential backoff,
   - введено типізовану помилку `ApiClientError`.
3. Додано TypeScript типи для параметрів і повернень (`refactored/apiClient.ts`).
4. Написано 8 тест-кейсів із mock fetch (`tests/apiClient.test.ts`).

## Запуск

```bash
cd labs/lab-01-part-2
npm install
npm test
```

## Покриті тестами сценарії

1. Успішний `getData`.
2. Успішний `postData` + перевірка body/header.
3. 404 без retry.
4. Retry після мережевої помилки.
5. Retry при 503.
6. Помилка після вичерпання retry.
7. Відсутність retry при 400.
8. Помилка при невалідному JSON.

## Примітка

Реалізація орієнтована на середовище Node.js 18+ (вбудований `fetch`).
