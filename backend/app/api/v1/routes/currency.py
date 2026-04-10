from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.db.session import get_db
from app.db.repositories.legacy_repo import LegacyWimmRepository
from app.services.currency_service import CurrencyService
from app.schemas.currency import CurrencyRate, CurrencyUpdateResponse

router = APIRouter()

async def get_currency_service(db: AsyncSession = Depends(get_db)) -> CurrencyService:
    repository = LegacyWimmRepository(db)
    return CurrencyService(repository)

@router.get("/rates", response_model=List[CurrencyRate])
async def get_rates(service: CurrencyService = Depends(get_currency_service)):
    """
    Retrieves current exchange rates from the database.
    """
    return await service.get_rates_from_db()

@router.post("/update", response_model=CurrencyUpdateResponse)
async def update_rates(service: CurrencyService = Depends(get_currency_service)):
    """
    Triggers a manual synchronization of exchange rates from Infodolar.
    """
    updated_rates = await service.update_rates_from_web()
    return CurrencyUpdateResponse(
        status="success",
        message="Exchange rates synchronized successfully from Infodolar.",
        updated_rates=updated_rates
    )
