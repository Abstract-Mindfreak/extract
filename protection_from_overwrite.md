# Защита от перезаписи при импорте из flowmusic.app

## Проблема
При следующем импорте данных из flowmusic.app может произойти перезапись существующих данных в abstract-mind-lab.

## Решение

### 1. Использование ON CONFLICT DO NOTHING
Во всех INSERT операциях при импорте использовать:
```sql
INSERT INTO table_name (columns...) VALUES (values...)
ON CONFLICT (id) DO NOTHING;
```

### 2. Source tracking
Добавить поле `source` в основные таблицы:
```sql
ALTER TABLE tracks ADD COLUMN source VARCHAR(50) DEFAULT 'manual';
ALTER TABLE sessions ADD COLUMN source VARCHAR(50) DEFAULT 'manual';
```

При импорте из flowmusic.app помечать записи:
```sql
INSERT INTO tracks (..., source) VALUES (..., 'flowmusic_import')
ON CONFLICT (id) DO UPDATE SET source = 'flowmusic_import';
```

### 3. Timestamp protection
Добавить поле `imported_at` и проверять при импорте:
```sql
INSERT INTO tracks (..., imported_at) VALUES (..., NOW())
ON CONFLICT (id) DO NOTHING;
```

### 4. Separate import schema
Создать отдельную схему для импорта:
```sql
CREATE SCHEMA IF NOT EXISTS flowmusic_import;
-- Импортировать в flowmusic_import.*
-- Потом сливать вручную с проверками
```

### 5. Implementation в localRagService.js

Добавить защиту в функции импорта:
```javascript
async function safeImport(table, data, source = 'manual') {
  const result = await pool.query(`
    INSERT INTO ${table} (${columns}, source, imported_at)
    VALUES (${placeholders}, $${columns.length + 1}, $${columns.length + 2})
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `, [...values, source, new Date()]);
  
  return result.rows;
}
```

### 6. Рекомендуемый подход

**Сразу реализовать:**
1. Добавить ON CONFLICT DO NOTHING во все INSERT операции
2. Добавить поле `source` в ключевые таблицы
3. Логировать попытки перезаписи

**Дополнительно (если нужно):**
- Создать separate схему для импорта
- Добавить version control для данных
- Implement manual merge process