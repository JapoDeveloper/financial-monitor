import pandas as pd
import numpy as np
from datetime import date
from typing import Dict, List, Optional

from app.db.repositories.legacy_repo import LegacyWimmRepository
from app.domain.portfolio import calculate_modified_dietz
from app.schemas.portfolio import YearlyPerformance, YearlyPerformanceData, PortfolioSummary, PerformancePeriod, HistoricalReturn

class PortfolioPerformanceService:
    def __init__(self, repo: LegacyWimmRepository):
        self.repo = repo

    async def get_yearly_performance(
        self, user_id: int, year: int
    ) -> YearlyPerformance:
        """
        Calculates portfolio performance for a given year, grouped by currency.
        """
        df_raw = await self.repo.get_portfolio_evolution_data(user_id, year)
        
        if df_raw.empty:
            return YearlyPerformance(year=year, data_by_currency={})

        # 1. Calculate performance per currency
        data_by_currency = {}
        for moneda, group in df_raw.groupby('moneda'):
            df = calculate_modified_dietz(group)
            
            # Filter for requested year
            start_date = pd.Timestamp(f'{year}-01-01')
            final_df = df[df['periodo'] >= start_date].copy()
            
            if final_df.empty:
                continue
                
            last_row = final_df.iloc[-1]
            summary = PortfolioSummary(
                total_gain=final_df['ganancia_mercado'].sum(),
                annual_return=last_row['retorno_acc'],
                current_value=last_row['valor_cartera']
            )

            breakdown = []
            for _, row in final_df.iterrows():
                breakdown.append(PerformancePeriod(
                    period=row['periodo'] if isinstance(row['periodo'], date) else pd.to_datetime(row['periodo']).date(),
                    v_inicial=float(row['v_inicial']),
                    flujo_neto=float(row['flujo_neto']),
                    ganancia_mercado=float(row['ganancia_mercado']),
                    valor_cartera=float(row['valor_cartera']),
                    retorno_mensual=float(row['retorno_mensual']),
                    retorno_acc=float(row['retorno_acc'])
                ))

            
            data_by_currency[moneda] = YearlyPerformanceData(
                summary=summary,
                monthly_breakdown=breakdown
            )

        return YearlyPerformance(
            year=year,
            data_by_currency=data_by_currency
        )

    async def get_historical_returns(
        self, user_id: int, start_year: int, end_year: int
    ) -> List[HistoricalReturn]:
        """Fetches annual returns for a range of years, grouped by currency."""
        history = []
        for year in range(start_year, end_year + 1):
            perf = await self.get_yearly_performance(user_id, year)
            
            returns_by_currency = {
                currency: data.summary.annual_return
                for currency, data in perf.data_by_currency.items()
            }
            
            history.append(HistoricalReturn(
                year=year,
                returns_by_currency=returns_by_currency
            ))
        return history

    async def get_active_currencies(self) -> List[str]:
        """Returns a list of all active currencies in the system."""
        return await self.repo.get_active_currencies()
