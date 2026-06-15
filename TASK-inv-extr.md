## Текущий запрос: MMSS Mutator + invariants_extractor

### Цели текущего этапа

- Исключить `D:\WORK\CLIENTS\extract\invariants_extractor` из git push текущего репозитория `extract`.
- Изучить `invariants_extractor` и встроить его идеи в стратегию `Мутатор MMSS`.
- Подготовить отдельный seed-словарь MMSS-онтологии:
  - 7 фаз `init / stabilize / vectorize / commute / convolve / relax / focus`
  - 5 доменных оператора `Rhythm / Timbre / Space / Logic / Math`
- Подготовить маппинг, который позволит добавлять в blocks дополнительные столбцы/поля с результатами `invariants_extractor`.
- Обновить `PLAN.md` так, чтобы `MMSS Mutator` строился не только на generic runtime, но и на явной MMSS-онтологии.

### Исследование и проектирование

1. Изучить `invariants_extractor/backend/agents/offline_agent.py`.
2. Зафиксировать текущие `PhasePattern` как canonical phase ontology.
3. Спроектировать расширение ontology на 5 MMSS-доменов:
   - `rhythm`
   - `timbre`
   - `space`
   - `logic`
   - `math`
   
4. Отделить ontology в отдельный файл seed-формата, пригодный для:
   - runtime use в `react/my-app`
   - импорта в `abstract-mind-lab`
   - дальнейшего ручного пополнения

### Данные и БД

5. Определить целевые таблицы для ontology в `abstract-mind-lab`:
   - `mmss_phase_patterns`
   - `mmss_domain_patterns`
6. Спроектировать импорт ontology seed в PostgreSQL.
7. Спроектировать расширение runtime loader так, чтобы он:
   - загружал ontology из БД
   - fallback-ился на локальный seed-файл
   - использовал ontology при маппинге track/session pseudo-blocks
8. Подготовить расширение `music_blocks.content.mmss_meta`:
   - `phase_operator_id`
   - `domain_operator_id`
   - `mmss_role`
   - `mmss_stage`
   - `mmss_archetype`
   - `ontology_source`
   - `invariants_confidence`

### Использование invariants_extractor для session pseudo-blocks

9. Ввести pipeline извлечения из сессий:
   - prompt пользователя
   - tool-call / tool-return payload
   - assistant text
   - structured JSON prompt fragments
   - flow/memory patterns
   - audio/video workflow traces
10. Нормализовать эти фрагменты в текст/семантические чанки для `invariants_extractor`.
11. Прогонять чанки через phase/domain keyword ontology.
12. Добавлять результат в session-derived pseudo-blocks:
   - `phase_hits`
   - `domain_hits`
   - `dominant_phase`
   - `dominant_domain`
   - `confidence_breakdown`

### MMSS Mutator

13. Создать новый раздел UI: `Мутатор MMSS`.
14. Базировать его на `ASE Console / Python Generation`.
15. Заменить source runtime:
   - по умолчанию `abstract-mind-lab`
   - опционально merge с `abstract_mind_db`
16. Добавить checkbox:
   - `Подключать abstract_mind_db`
17. Добавить diagnostics по ontology coverage:
   - распределение фаз
   - распределение доменов
   - количество pseudo-blocks из tracks / sessions / music_blocks
   - legacy enrichment count

### План / документация

18. Дополнить `PLAN.md` явной MMSS-онтологией поверх блоков.
19. Внести в `PLAN.md` идеи из улучшений:
   - MMSS roles / stages / archetypes
   - Exploration vs Production
   - Mutation Recipes
   - JSON normalization pipeline
   - Vector backend abstraction
   - legacy echo merge
   - MMSS Inspector
   - self-eval / self-rule loop
   - heuristics sandbox

### Deliverables текущего шага

- `.gitignore` обновлен, `invariants_extractor/` не пушится.
- Создан ontology seed-файл.
- `TASK.md` отражает полный список шагов по интеграции `invariants_extractor` и MMSS Mutator.
- `PLAN.md` расширен MMSS-онтологией и архитектурными улучшениями.

## Промт для SWE 1.6

```markdown
# Задача: Интеграция PostgreSQL в Ollama-пайплайн json-genesis

## Контекст проекта

Архитектура:
- Фронтенд: `json-genesis/` (Vite + React + TypeScript)
- Бэкенд-прокси: `react/my-app/archiver-server.js` (Express, порт 3456)
- LLM: Ollama с моделью `gemma2b-mmss-dense` (локально, порт 11434)
- Альтернативный LLM: Mistral API (через тот же прокси)

## Требования

### 1. Переключатель провайдеров (Mistral ↔ Ollama)

**Файл для изменения:** `json-genesis/src/services/aiService.ts`

Добавить:
- Тип `AIProvider = 'mistral' | 'ollama'`
- Единую функцию `generateAI(prompt, structure, options)` которая маршрутизирует запросы
- Функцию `generateWithMistral()` без избыточной валидации (прямой вызов → парсинг JSON)
- Оставить существующую `generateWithOllama()` с жестким парсингом через `indexOf('{')` / `lastIndexOf('}')`

**Файл для изменения:** `json-genesis/src/components/MainEditor.tsx`

Добавить:
- Select-элемент для выбора провайдера
- Сохранение выбора в localStorage
- Передачу `provider` в `generateAI()`

### 2. Интеграция PostgreSQL для Ollama

**ВАЖНО:** Ollama сама не может делать запросы к БД. Нужен tool-calling механизм через прокси.

**Архитектура решения:**
```
Gemma (Ollama) 
  → генерирует SQL в формате ```sql SELECT ... ```
  → archiver-server.js парсит SQL
  → выполняет через pg driver
  → возвращает результат модели
  → модель формирует финальный JSON
```

**Шаг 2.1: Установить зависимости**
В `react/my-app/package.json` добавить:
```bash
npm install pg
```

**Шаг 2.2: Создать модуль БД**
Файл: `react/my-app/db.js`

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'abstract_mind_db',
  user: process.env.PG_USER || 'abstract_mind_user',
  password: process.env.PG_PASSWORD || 'mindfreak',
  max: 10,
  idleTimeoutMillis: 30000,
});

// БЕЗОПАСНОСТЬ: только SELECT запросы
async function executeReadOnlyQuery(sql) {
  const normalized = sql.trim().toUpperCase();
  
  // Запрещаем любые модификации
  const forbidden = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE', 'GRANT', 'REVOKE'];
  for (const keyword of forbidden) {
    if (normalized.includes(keyword)) {
      throw new Error(`Forbidden SQL operation: ${keyword}. Only SELECT allowed.`);
    }
  }
  
  // Запрещаем множественные запросы
  if (sql.includes(';') && sql.split(';').filter(s => s.trim()).length > 1) {
    throw new Error('Multiple SQL statements are not allowed');
  }
  
  const client = await pool.connect();
  try {
    const result = await client.query(sql);
    return result.rows;
  } finally {
    client.release();
  }
}

module.exports = { executeReadOnlyQuery, pool };
```

**Шаг 2.3: Добавить эндпоинт в archiver-server.js**

```javascript
const { executeReadOnlyQuery } = require('./db');

// Эндпоинт для выполнения SQL
app.post('/api/db/query', async (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql || typeof sql !== 'string') {
      return res.status(400).json({ error: 'SQL query required' });
    }
    
    console.log('[DB] Executing query:', sql.slice(0, 200));
    const rows = await executeReadOnlyQuery(sql);
    res.json({ success: true, data: rows, rowCount: rows.length });
  } catch (err) {
    console.error('[DB] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Модифицированный эндпоинт Ollama с tool-calling
app.post('/api/ollama/generate', async (req, res) => {
  try {
    const { model, prompt, stream, options, context } = req.body;
    
    // Первый запрос к Ollama
    const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false, options }),
    });
    
    const ollamaData = await ollamaResponse.json();
    let response = ollamaData.response || '';
    
    // Проверяем, есть ли SQL в ответе
    const sqlMatch = response.match(/```sql\s*([\s\S]*?)```/);
    
    if (sqlMatch && context?.enableDB) {
      const sql = sqlMatch[1].trim();
      console.log('[OLLAMA] Detected SQL query:', sql);
      
      try {
        // Выполняем SQL
        const dbResult = await executeReadOnlyQuery(sql);
        
        // Отправляем результат обратно в Ollama для финальной генерации
        const followUpPrompt = `${prompt}\n\nDatabase query result:\n${JSON.stringify(dbResult, null, 2)}\n\nNow generate the final JSON based on this data.`;
        
        const finalResponse = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            model, 
            prompt: followUpPrompt, 
            stream: false, 
            options 
          }),
        });
        
        const finalData = await finalResponse.json();
        response = finalData.response || response;
      } catch (dbError) {
        console.error('[OLLAMA] DB error:', dbError.message);
        response += `\n\n[DB Error: ${dbError.message}]`;
      }
    }
    
    res.json({ response });
  } catch (err) {
    console.error('[OLLAMA] Error:', err);
    res.status(500).json({ error: err.message });
  }
});
```

**Шаг 2.4: Переменные окружения**
Файл: `react/my-app/.env`

```env
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=mmss
PG_USER=mmss_user
PG_PASSWORD=your_secure_password
OLLAMA_MODEL=gemma2b-mmss-dense
```

**Шаг 2.5: Обновить фронтенд**
Файл: `json-genesis/src/services/aiService.ts`

Добавить параметр `enableDB` в `GenOptions`:

```typescript
export interface GenOptions {
  mode?: 'augment' | 'rewrite' | 'skeleton';
  rules?: string;
  libraryContext?: string;
  temperature?: number;
  max_tokens?: number;
  onProgress?: (msg: string) => void;
  provider?: AIProvider;
  enableDB?: boolean; // НОВОЕ
}
```

И передавать в запрос:

```typescript
body: JSON.stringify({
  model: OLLAMA_MODEL,
  prompt: fullPrompt,
  stream: false,
  context: { enableDB: options?.enableDB || false },
  options: { temperature: 0.3, num_predict: 4096 },
})
```

### 3. Промпт для модели с поддержкой SQL

Добавить в `aiService.ts` шаблон промпта:

```typescript
const dbInstruction = options?.enableDB 
  ? `\n\nDATABASE ACCESS: You can query PostgreSQL database. 
If you need data from DB, output SQL query in format:
\`\`\`sql
SELECT column1, column2 FROM table_name WHERE condition;
\`\`\`
Only SELECT queries allowed. After receiving DB results, generate final JSON.`
  : '';

const fullPrompt = `Mode: ${options?.mode || 'augment'}
Rules: ${options?.rules || 'None'}
MMSS Library Context: ${options?.libraryContext || 'None'}
Context: ${structure || 'None'}
Action: ${prompt}
Instruction: ${modeInstruction}${dbInstruction}

CRITICAL: Return ONLY valid JSON. No explanations, no markdown, no text before or after JSON.`;
```

## Критерии приемки

1. ✅ В UI есть переключатель Mistral ↔ Ollama
2. ✅ Выбор сохраняется в localStorage
3. ✅ Ollama может выполнять SELECT запросы к PostgreSQL
4. ✅ Запрещены INSERT/UPDATE/DELETE/DROP/CREATE/ALTER
5. ✅ Запрещены множественные SQL-запросы
6. ✅ Все credentials в .env, не в коде
7. ✅ Работает обратная совместимость (без enableDB — обычная генерация)

## Тестирование

1. Создать тестовую таблицу:
```sql
CREATE TABLE test_data (id SERIAL PRIMARY KEY, name VARCHAR(100), value INTEGER);
INSERT INTO test_data (name, value) VALUES ('test1', 42), ('test2', 100);
```

2. Проверить промпт: "Получи все записи из test_data и верни JSON массив"
3. Убедиться что модель генерирует SQL, получает данные, формирует JSON

## Безопасность

- Только SELECT запросы
- Только один SQL-запрос за раз
- Connection pooling с лимитом 10 соединений
- Timeout 30 секунд
- Все credentials через环境变量
```
