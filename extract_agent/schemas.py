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
