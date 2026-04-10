from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.db.session import get_db
from app.db.repositories.legacy_repo import LegacyWimmRepository
from app.services.portfolio_service import PortfolioPerformanceService
from app.schemas.portfolio import YearlyPerformance, HistoricalReturn

router = APIRouter()

# Fixed USER_ID for now as per notebook requirements
DEFAULT_USER_ID = 1

async def get_portfolio_service(db: AsyncSession = Depends(get_db)) -> PortfolioPerformanceService:
    repo = LegacyWimmRepository(db)
    return PortfolioPerformanceService(repo)

@router.get("/performance/history", response_model=List[HistoricalReturn])
async def get_performance_history(
    start_year: int,
    end_year: int,
    service: PortfolioPerformanceService = Depends(get_portfolio_service)
):
    """Returns annual returns for a range of years, grouped by currency."""
    if start_year > end_year:
        raise HTTPException(status_code=400, detail="Start year must be before end year")
    return await service.get_historical_returns(DEFAULT_USER_ID, start_year, end_year)
    
@router.get("/currencies", response_model=List[str])
async def get_active_currencies(
    service: PortfolioPerformanceService = Depends(get_portfolio_service)
):
    """Returns a list of all active currencies."""
    return await service.get_active_currencies()
    
@router.get("/performance/{year}", response_model=YearlyPerformance)
async def get_yearly_performance(
    year: int,
    service: PortfolioPerformanceService = Depends(get_portfolio_service)
):
    """Returns detailed performance for a specific year, grouped by currency."""
    return await service.get_yearly_performance(DEFAULT_USER_ID, year)
