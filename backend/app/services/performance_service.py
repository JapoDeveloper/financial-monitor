import pandas as pd
from typing import List, Optional
from datetime import datetime, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.utils.assets_info_utils import get_assets_last_price_for_period, get_asset_dividends_for_period
from app.domain.performance import calculate_modified_dietz_metrics
from app.schemas.performance import (
    InstrumentInfo, 
    PerformanceResults, 
    PerformanceResponse, 
    DividendComparison, 
    DividendEvent
)
from app.core.logging import logger

class PerformanceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_active_instruments(self, user_id: int) -> List[InstrumentInfo]:
        query = text('''
            SELECT 
                ii.id AS id,
                ii.nombre AS nombre,
                ii.nombre_corto as alias,
                CASE 
                    WHEN ii.pago_dividendos = 'trimestral' THEN 3 
                    WHEN ii.pago_dividendos = 'semestral' THEN 6 
                    WHEN ii.pago_dividendos IS NULL THEN 0 
                    ELSE 12 
                END as meses_dividendo,
                ifi.nombre AS institucion,
                SUM(i.cuotas_participacion) AS cuotas_participacion,
                tii.sub_clase as sub_clase,
                m.codigo as moneda
            FROM wimm.inversion i
            JOIN wimm.instrumento_inversion ii ON ii.id = i.instrumento_inversion_id 
            JOIN wimm.moneda m ON m.id = i.moneda_id
            JOIN wimm.tipo_instrumento_inversion tii ON tii.id = ii.tipo_instrumento_inversion_id 
            JOIN wimm.institucion_financiera ifi ON ifi.id = ii.institucion_financiera_id
            WHERE i.activa = 1 AND i.usuario_id = :user_id
            GROUP BY i.instrumento_inversion_id, m.codigo 
            ORDER BY ifi.nombre, ii.nombre
        ''')
        
        result = await self.db.execute(query, {"user_id": user_id})
        rows = result.fetchall()
        
        return [InstrumentInfo(
            id=row.id,
            nombre=row.nombre,
            alias=row.alias.strip() if row.alias else None,
            meses_dividendo=row.meses_dividendo,
            institucion=row.institucion,
            cuotas_participacion=float(row.cuotas_participacion),
            sub_clase=row.sub_clase,
            moneda=row.moneda
        ) for row in rows]

    async def calculate_performance(
        self, 
        user_id: int, 
        instrument_id: int, 
        year: int, 
        month: int, 
        div_period: int,
        manual_price: Optional[float] = None
    ) -> PerformanceResponse:
        """
        Orchestrates the calculation of performance for a specific instrument and period.
        """
        # 1. Fetch instrument details
        instruments = await self.get_active_instruments(user_id)
        instrument = next((i for i in instruments if i.id == instrument_id), None)
        if not instrument:
            raise ValueError(f"Instrument {instrument_id} not found or not active for user {user_id}")

        # 2. Determine final market value
        # market_value is ALWAYS price * cuotas_participacion
        market_value = None
        price_date_str = None
        
        if manual_price is not None:
            # Case A: User provided the unit price manually
            market_value = float(manual_price) * instrument.cuotas_participacion
            logger.info(f"Using manual price {manual_price} for {instrument.alias}. Market Value: {market_value}")
        elif instrument.sub_clase and "Activos /" in instrument.sub_clase and instrument.alias:
            # Case B: Automatic Yahoo Finance lookup
            logger.info(f"Attempting automatic price lookup for {instrument.alias} (Instrument ID: {instrument_id})")
            prices_dict = get_assets_last_price_for_period([instrument.alias], year, month)
            price_data = prices_dict.get(instrument.alias, {})
            price = price_data.get("price")
            
            if price is not None and not pd.isna(price):
                market_value = float(price) * instrument.cuotas_participacion
                price_date_str = price_data.get("date")
                logger.info(f"Successfully fetched price: {price} on {price_date_str} for {instrument.alias}. Market Value: {market_value}")
            else:
                logger.warning(f"Could not fetch price for {instrument.alias} from Yahoo Finance")
                raise ValueError(
                    f"No se pudo obtener el precio de Yahoo Finance para el alias '{instrument.alias}'. "
                    "Esto puede deberse a límites de la API o falta de datos. Por favor, ingrese el valor de cierre manualmente."
                )
        
        if market_value is None:
            logger.error(f"Market value determination failed for instrument {instrument_id}. "
                         f"Sub-clase: '{instrument.sub_clase}', Alias: '{instrument.alias}', "
                         f"Manual Price: {manual_price}")
            raise ValueError("El valor de mercado no pudo ser determinado. Por favor, ingrese un valor manual.")

        # 3. Calculate metrics using the logic from the notebook
        factor_anualizacion = 12 / div_period if div_period > 0 else 12
        dt_fmt = '%Y-%m-%d'
        
        # We'll execute the same CTE query logic within the database
        query = text('''
        WITH Inputs AS (
            SELECT :user_id AS UsuarioID, :instrument_id AS InversionID, :market_value AS MontoFinalInput,
                   :year AS Anio, :month AS Mes, :factor_anualizacion AS FactorAnualizacion,
                   STR_TO_DATE(CONCAT(:year, '-', :month, '-01'), :dt_fmt) AS FechaInicioMes,
                   LAST_DAY(STR_TO_DATE(CONCAT(:year, '-', :month, '-01'), :dt_fmt)) AS FechaFinMes,
                   DAY(LAST_DAY(STR_TO_DATE(CONCAT(:year, '-', :month, '-01'), :dt_fmt))) AS DiasDelMes
        ),
        ValorInicial AS (
            SELECT IFNULL(SUM(ri.monto), 0) as Vi
            FROM wimm.registro_inversion ri
            JOIN wimm.inversion i ON i.id = ri.inversion_id
            JOIN Inputs ix
            WHERE i.usuario_id = ix.UsuarioID AND i.instrumento_inversion_id = ix.InversionID
              AND ri.tipo_operacion = 'C'
              AND ri.fecha_transaccion BETWEEN ix.FechaInicioMes AND DATE_ADD(ix.FechaInicioMes, INTERVAL 15 DAY)
        ),
        DetalleFlujosDiarios AS (
            SELECT ri.fecha_transaccion,
                   SUM(CASE WHEN ri.tipo_operacion IN ('R', 'D') THEN ri.monto * -1 ELSE ri.monto END) as FlujoNetoDia,
                   SUM(CASE WHEN ri.tipo_operacion IN ('R', 'D') THEN ri.monto * -1 ELSE ri.monto END) * 
                       (DATEDIFF(ix.FechaFinMes, ri.fecha_transaccion) / ix.DiasDelMes) as FlujoPonderadoDia,
                   SUM(CASE WHEN ri.tipo_operacion = 'D' THEN ri.monto ELSE 0 END) as DividendosDia
            FROM wimm.registro_inversion ri
            JOIN wimm.inversion i ON i.id = ri.inversion_id
            JOIN Inputs ix
            WHERE i.usuario_id = ix.UsuarioID AND i.instrumento_inversion_id = ix.InversionID
              AND ri.tipo_operacion IN ('A', 'R', 'D')
              AND ri.fecha_transaccion BETWEEN ix.FechaInicioMes AND ix.FechaFinMes
            GROUP BY ri.fecha_transaccion
        )
        SELECT 
            ini.Vi, 
            IFNULL(SUM(tf.FlujoNetoDia), 0) as F_Neto,
            IFNULL(SUM(tf.FlujoPonderadoDia), 0) as F_Pond,
            IFNULL(SUM(tf.DividendosDia), 0) as Div_Monto
        FROM ValorInicial ini
        LEFT JOIN DetalleFlujosDiarios tf ON 1=1
        GROUP BY ini.Vi
        ''')
        
        params = {
            "user_id": user_id, 
            "instrument_id": instrument_id, 
            "market_value": market_value, 
            "year": year, 
            "month": month, 
            "factor_anualizacion": factor_anualizacion, 
            "dt_fmt": dt_fmt
        }
        
        result = await self.db.execute(query, params)
        data = result.fetchone()
        
        if not data:
            logger.warning(f"No performance data found for user {user_id}, instrument {instrument_id}, period {year}-{month}")
            raise ValueError("No se pudo recuperar la data de transacciones para este periodo en la base de datos.")

        # 3.5 Check for dividends in Yahoo Finance vs Local
        dividend_info = None
        if instrument.sub_clase and "Activos /" in instrument.sub_clase and instrument.alias:
            yf_divs = get_asset_dividends_for_period(instrument.alias, year, month)
            if yf_divs:
                dividend_info = DividendComparison(
                    has_dividend=True,
                    events=[DividendEvent(**e) for e in yf_divs],
                    is_registered=float(data.Div_Monto) > 0
                )
            
        try:
            # 4. Use domain function for finalized calculation
            metrics = calculate_modified_dietz_metrics(
                valor_inicial=float(data.Vi),
                valor_final=market_value,
                flujos_netos=float(data.F_Neto),
                flujos_ponderados=float(data.F_Pond),
                dividendos=float(data.Div_Monto),
                factor_anualizacion=factor_anualizacion
            )
            
            # Determine which unit price to return (for UX awareness)
            unit_price_used = manual_price if manual_price is not None else (market_value / instrument.cuotas_participacion if instrument.cuotas_participacion > 0 else 0)

            logger.info(f"Performance calculated successfully for {instrument.alias}")
            
            return PerformanceResponse(
                instrument=instrument,
                year=year,
                month=month,
                calculated_price=round(float(unit_price_used), 6),
                price_date=price_date_str,
                dividend_info=dividend_info,
                results=PerformanceResults(
                    capital_inicial=metrics["valor_inicial"],
                    flujos_netos=metrics["flujos_netos"],
                    dividendos_recibidos=metrics["dividendos_recibidos"],
                    capital_final=metrics["valor_final"],
                    ganancia_capital=metrics["ganancia_capital"],
                    ganancia_total=metrics["ganancia_total"],
                    roi_mensual=metrics["roi_mensual"],
                    tea=metrics["tea"],
                    div_yield_ann=metrics["div_yield_ann"]
                )
            )
        except ValueError as e:
            logger.error(f"Validation Error in calculate_performance: {str(e)}", exc_info=True)
            if request:
                logger.error(f"Request data: {request.model_dump()}")
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            logger.error(f"Error in metric calculation or response building: {str(e)}", exc_info=True)
            raise
