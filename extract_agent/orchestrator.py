import json
import httpx
from extract_agent.schemas import AgentResponseSchema

class MistralAgentOrchestrator:
    def __init__(self, api_key: str, model_name: str = "mistral-large-latest"):
        self.api_key = api_key
        self.model_name = model_name
        self.base_url = "https://api.mistral.ai/v1"

    def generate_agent_decision(self, user_query: str) -> dict:
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

        response = httpx.post(
            f"{self.base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self.model_name,
                "messages": messages,
                "response_format": {"type": "json_object"}
            }
        )
        response.raise_for_status()
        data = response.json()
        raw_content = data["choices"][0]["message"]["content"]
        
        try:
            validated_response = AgentResponseSchema.model_validate_json(raw_content)
        except Exception as validation_error:
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
