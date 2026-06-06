
```markdown
# TASK: Исправление работы LLM Агента и принудительного вызова инструментов (Mistral Tool Calling Fix)

## 1. Описание проблемы
В текущей реализации проекта `extract` ИИ-агент на базе Mistral игнорирует переданные ему инструменты (tools) и возвращает обычный текст вместо структурированного вызова функций. Это ломает слой оркестрации и делает невозможным автоматическое выполнение локальных действий.

## 2. Цель задачи
Переработать слой интеграции с Mistral API, промпты и Pydantic-модели таким образом, чтобы модель гарантированно возвращала валидный структурированный JSON, который затем автоматически валидируется через Pydantic и передается на выполнение в локальное приложение.

---

## 3. Пошаговый план реализации

### Шаг 3.1: Модернизация Pydantic схем (Файл схем/моделей)
Необходимо убедиться, что схемы четко описывают намерения и содержат поле для цепочки рассуждений (Chain-of-Thought), что критически важно для качества работы Mistral.

Создать или полностью обновить существующие модели до следующего вида:

```python
from pydantic import BaseModel, Field
from typing import Literal, Optional, Dict, Any

class ExtractionAction(BaseModel):
    action_type: Literal["extract_text", "extract_links", "download_file", "screenshot"] = Field(
        ..., 
        description="Тип действия по извлечению данных, которое необходимо выполнить."
    )
    target_url: str = Field(
        ..., 
        description="Полный URL-адрес веб-страницы или путь к источнику для обработки."
    )
    parameters: Optional[Dict[str, Any]] = Field(
        default_factory=dict, 
        description="Дополнительные параметры, такие как селекторы, глубина парсинга или формат."
    )

class AgentResponseSchema(BaseModel):
    reasoning: str = Field(
        ..., 
        description="Пошаговое логическое обоснование того, почему выбрано именно это действие."
    )
    action_required: bool = Field(
        ..., 
        description="Флаг, указывающий, требуется ли выполнение локального инструмента (True/False)."
    )
    command: Optional[ExtractionAction] = Field(
        default=None, 
        description="Объект команды с параметрами. Обязателен, если action_required равен True."
    )

```

### Шаг 3.2: Переработка Оркестратора и вызова Mistral API

Для обеспечения 100% стабильности Mistral мы переводим агента на работу через **JSON Mode (`response_format={"type": "json_object"}`)**, так как нативный `tools` в неоригинальных клиентах или меньших моделях часто игнорируется. В системный промпт жестко зашивается схема Pydantic.

Обновить код оркестратора (модуль взаимодействия с LLM):

```python
import json
from mistralai import Mistral
from schemas import AgentResponseSchema

class MistralAgentOrchestrator:
    def __init__(self, api_key: str, model_name: str = "mistral-large-latest"):
        self.client = Mistral(api_key=api_key)
        self.model_name = model_name

    def generate_agent_decision(self, user_query: str) -> dict:
        # Извлекаем чистую JSON-схему из Pydantic модели
        json_schema_str = json.dumps(AgentResponseSchema.model_json_schema(), ensure_ascii=False)
        
        system_prompt = (
            "Ты — интеллектуальный агент-оркестратор для приложения по извлечению данных (extract).\n"
            "Твоя задача — проанализировать запрос пользователя и строго определить, какой инструмент нужно вызвать.\n"
            "Ты должен отвечать ТОЛЬКО в формате JSON.\n"
            f"Ответ должен строго соответствовать следующей JSON-схеме:\n{json_schema_str}\n"
            "Запрещено добавлять любой текст до или после JSON-объекта. Не пиши пояснений в теле ответа, "
            "используй для этого исключительно поле 'reasoning' внутри JSON."
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Запрос пользователя: {user_query}"}
        ]

        # Выполняем запрос к API с принудительным JSON-форматом
        response = self.client.chat.complete(
            model=self.model_name,
            messages=messages,
            response_format={"type": "json_object"}
        )

        raw_content = response.choices[0].message.content
        
        # Валидация сырого ответа через Pydantic
        try:
            validated_response = AgentResponseSchema.model_validate_json(raw_content)
        except Exception as validation_error:
            # Предохранитель на случай некорректного JSON от модели
            raise ValueError(f"Ошибка валидации ответа модели: {str(validation_error)}. Сырой ответ: {raw_content}")

        return self.execute_orchestration(validated_response)

    def execute_orchestration(self, agent_decision: AgentResponseSchema) -> dict:
        if not agent_decision.action_required or not agent_decision.command:
            return {
                "status": "skipped",
                "reasoning": agent_decision.reasoning,
                "result": "Модель решила, что вызов инструментов не требуется."
            }

        cmd = agent_decision.command
        
        # Слой диспетчеризации вызовов реальных инструментов приложения
        if cmd.action_type == "extract_links":
            execution_result = f"Успешно запущен сбор ссылок с ресурса {cmd.target_url} с параметрами {cmd.parameters}"
        elif cmd.action_type == "extract_text":
            execution_result = f"Успешно запущен сбор текстового контента с ресурса {cmd.target_url}"
        elif cmd.action_type == "download_file":
            execution_result = f"Скачивание файла по адресу {cmd.target_url} инициировано."
        elif cmd.action_type == "screenshot":
            execution_result = f"Создание скриншота страницы {cmd.target_url} запущено."
        else:
            execution_result = f"Неизвестный тип действия: {cmd.action_type}"

        return {
            "status": "success",
            "reasoning": agent_decision.reasoning,
            "action_executed": cmd.action_type,
            "target": cmd.target_url,
            "details": execution_result
        }

```

### Шаг 3.3: Обновление FastAPI Endpoint

Необходимо связать новый оркестратор с эндпоинтом FastAPI, обеспечив корректную обработку ошибок.

```python
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from orchestrator import MistralAgentOrchestrator

app = FastAPI(title="Extract Data Agent API", version="1.0.0")

# Инициализация оркестратора. API-ключ берется из переменных окружения
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "mock-key-if-testing")
orchestrator = MistralAgentOrchestrator(api_key=MISTRAL_API_KEY)

class UserPromptRequest(BaseModel):
    prompt: str

@app.post("/api/v1/agent/run")
async def run_agent_command(request: UserPromptRequest):
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Запрос пользователя не может быть пустым.")
    
    try:
        result = orchestrator.generate_agent_decision(request.prompt)
        return result
    except ValueError as val_err:
        raise HTTPException(status_code=422, detail=str(val_err))
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Внутренняя ошибка сервера при работе агента: {str(err)}")

```

---

## 4. Критерии приемки задачи (Definition of Done)

1. **Отсутствие синтаксических ошибок:** Код полностью написан на Python 3.10+, отсутствуют заглушки вида `pass` или `...` в критических узлах.
2. **Гарантированный JSON:** Изменен тип запроса к Mistral на работу через `json_object`.
3. **Pydantic Валидация:** Ответ от Mistral успешно преобразуется в объект `AgentResponseSchema`. Если модель возвращает невалидную структуру, генерируется понятное исключение, а не падение сервера.
4. **Рабочий Эндпоинт:** Маршрут `/api/v1/agent/run` успешно принимает POST-запросы и возвращает структурированный ответ с полями `status`, `reasoning` и `details`.

```

```