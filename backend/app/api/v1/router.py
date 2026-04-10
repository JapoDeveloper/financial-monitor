from fastapi import APIRouter
from app.api.v1.routes import portfolio, holdings, currency, performance, stocks

api_router = APIRouter()
api_router.include_router(portfolio.router, prefix="/portfolio", tags=["portfolio"])
api_router.include_router(holdings.router, prefix="/holdings", tags=["holdings"])
api_router.include_router(currency.router, prefix="/currency", tags=["currency"])
api_router.include_router(performance.router, prefix="/performance", tags=["performance"])
api_router.include_router(stocks.router, prefix="/stocks", tags=["stocks"])
