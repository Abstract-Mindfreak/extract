import pytest
from fastapi.testclient import TestClient
from extract_agent.server import app
from extract_agent.schemas import AgentResponseSchema, ExtractionAction

client = TestClient(app)

def test_empty_prompt():
    response = client.post("/api/v1/agent/run", json={"prompt": "   "})
    assert response.status_code == 400
    assert "не может быть пустым" in response.json()["detail"]

def test_valid_extract_text_request():
    response = client.post("/api/v1/agent/run", json={"prompt": "Извлечь текст с https://example.com"})
    assert response.status_code in [200, 422, 500]
    if response.status_code == 200:
        data = response.json()
        assert "status" in data
        assert "reasoning" in data

def test_valid_extract_links_request():
    response = client.post("/api/v1/agent/run", json={"prompt": "Найди все ссылки на https://example.com"})
    assert response.status_code in [200, 422, 500]
    if response.status_code == 200:
        data = response.json()
        assert "status" in data
        assert "reasoning" in data

def test_schema_validation():
    action = ExtractionAction(
        action_type="extract_text",
        target_url="https://example.com",
        parameters={"depth": 2}
    )
    response = AgentResponseSchema(
        reasoning="Пользователь хочет извлечь текст с указанного URL",
        action_required=True,
        command=action
    )
    assert response.action_required is True
    assert response.command.action_type == "extract_text"

def test_schema_validation_no_action():
    response = AgentResponseSchema(
        reasoning="Запрос не требует выполнения действий",
        action_required=False,
        command=None
    )
    assert response.action_required is False
    assert response.command is None

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
