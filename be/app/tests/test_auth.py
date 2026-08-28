import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_register_client():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post("/auth/register", json={
            "nombre": "Test",
            "apellido": "User",
            "tipo_documento_id": 1,
            "documento": 123456789,
            "telefono": 3001234567,
            "email": "test@example.com",
            "direccion": "Calle Falsa 123",
            "password": "secret123"
        })
    assert response.status_code == 201