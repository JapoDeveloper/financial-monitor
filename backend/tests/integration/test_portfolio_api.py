import pytest
from httpx import AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_portfolio_performance_api():
    """Test the portfolio performance API endpoints."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # Test health check first
        response = await ac.get("/api/v1/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "message": "Financial Platform API is running."}

        # Test yearly performance for a specific year
        response = await ac.get("/api/v1/portfolio/performance/2023", params={"currency": "USD"})
        assert response.status_code == 200
        data = response.json()
        assert "year" in data and data["year"] == 2023
        assert "currency" in data and data["currency"] == "USD"
        assert "summary" in data
        assert "current_value" in data["summary"]
        assert "total_gain" in data["summary"]
        assert "annual_return" in data["summary"]
        assert "monthly_breakdown" in data
        assert isinstance(data["monthly_breakdown"], list)

        # Test historical performance
        response = await ac.get("/api/v1/portfolio/performance/history", params={"start_year": 2020, "end_year": 2023, "currency": "USD"})
        assert response.status_code == 200
        history_data = response.json()
        assert isinstance(history_data, list)
        assert len(history_data) == 4 # Years 2020, 2021, 2022, 2023
        assert "year" in history_data[0]
        assert "currency" in history_data[0]
        assert "retorno_anual" in history_data[0]

        # Test invalid range for historical performance
        response = await ac.get("/api/v1/portfolio/performance/history", params={"start_year": 2023, "end_year": 2020})
        assert response.status_code == 400
        assert "Start year must be before end year" in response.json()["message"]

