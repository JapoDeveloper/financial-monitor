from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional

class CurrencyRate(BaseModel):
    """
    Pydantic model for currency exchange rate information.
    Includes source, destination, value, and last update timestamp.
    """
    model_config = ConfigDict(strict=True)

    moneda_origen: str = Field(..., description="Source currency code (e.g., USD)")
    moneda_destino: str = Field(..., description="Destination currency code (e.g., DOP)")
    valor: float = Field(..., gt=0, description="Exchange rate value")
    fecha_actualizacion: datetime = Field(..., description="Last update timestamp from source")

class CurrencyUpdateResponse(BaseModel):
    """
    Response model for the currency update operation.
    """
    model_config = ConfigDict(strict=True)

    status: str = Field(..., description="Success or failure status")
    message: str = Field(..., description="Detailed message about the update")
    updated_rates: list[CurrencyRate] = Field(default_factory=list, description="List of updated rates")
