import pandas as pd
import numpy as np
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any

class LegacyWimmRepository:
    """
    Repository for interacting with the legacy 'wimm' database.
    Optimized for performance metrics and historical data retrieval.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_portfolio_evolution_data(self, user_id: int, year: int) -> pd.DataFrame:
        """
        Retrieves raw portfolio evolution data (closings and flows) for a given year.
        """
        query = text("""
            SELECT 
                periodo, 
                moneda, 
                SUM(valor_cartera) as valor_cartera, 
                SUM(aportes) as aportes, 
                SUM(retiros) as retiros,
                SUM(dividendos) as dividendos,
                SUM(flujo_ponderado) as flujo_ponderado
            FROM (
                -- A. CIERRES
                SELECT 
                    LAST_DAY(DATE_SUB(ri.fecha_transaccion, INTERVAL 1 MONTH)) as periodo, 
                    m.codigo as moneda, 
                    ri.monto as valor_cartera, 
                    0 as aportes, 0 as retiros, 0 as dividendos, 0 as flujo_ponderado
                FROM wimm.registro_inversion ri
                JOIN wimm.inversion i ON i.id = ri.inversion_id
                JOIN wimm.moneda m ON m.id = ri.moneda_id
                WHERE ri.activo = 1 
                  AND ri.usuario_id = :user_id
                  AND ri.tipo_operacion = 'C'
                  AND ri.fecha_transaccion >= DATE(CONCAT(:year, '-01-01'))
                  AND ri.fecha_transaccion < DATE_ADD(DATE(CONCAT(:year, '-01-01')), INTERVAL 13 MONTH)

                UNION ALL

                -- B. FLUJOS
                SELECT 
                    LAST_DAY(ri.fecha_transaccion) as periodo, 
                    m.codigo as moneda, 
                    0 as valor_cartera, 
                    IF(ri.tipo_operacion = 'A', ri.monto, 0) as aportes, 
                    IF(ri.tipo_operacion = 'R', ri.monto, 0) as retiros,
                    IF(ri.tipo_operacion = 'D', ri.monto, 0) as dividendos,
                    ri.monto * (CASE WHEN ri.tipo_operacion = 'A' THEN 1 WHEN ri.tipo_operacion IN ('R', 'D') THEN -1 ELSE 0 END) *
                    ( (DAY(LAST_DAY(ri.fecha_transaccion)) - DAY(ri.fecha_transaccion)) / DAY(LAST_DAY(ri.fecha_transaccion)) ) 
                    as flujo_ponderado
                FROM wimm.registro_inversion ri
                JOIN wimm.inversion i ON i.id = ri.inversion_id
                JOIN wimm.moneda m ON m.id = ri.moneda_id
                WHERE ri.activo = 1 
                  AND ri.usuario_id = :user_id
                  AND ri.tipo_operacion IN ('A', 'R', 'D')
                  AND ri.fecha_transaccion >= DATE(CONCAT(:year, '-01-01'))
                  AND ri.fecha_transaccion <= DATE(CONCAT(:year, '-12-31'))
            ) as combined_data
            GROUP BY periodo, moneda
            ORDER BY moneda, periodo ASC
        """)
        
        result = await self.db.execute(query, {"user_id": user_id, "year": year})
        rows = result.fetchall()
        
        if not rows:
            return pd.DataFrame()
            
        df = pd.DataFrame(rows, columns=list(result.keys()))
        df['periodo'] = pd.to_datetime(df['periodo'])
        
        # Ensure numeric types
        numeric_cols = ['valor_cartera', 'aportes', 'retiros', 'dividendos', 'flujo_ponderado']
        df[numeric_cols] = df[numeric_cols].fillna(0).astype(float)
        
        # Forward fill valor_cartera within each currency group if it's 0 (missing closing record)
        # This ensures continuity when only flows are present in a given period.
        df['valor_cartera'] = df.groupby('moneda')['valor_cartera'].transform(
            lambda x: x.mask(x == 0).ffill().fillna(0)
        )
        
        return df

    async def get_active_currencies(self) -> List[str]:
        """Retrieves a list of distinct currency codes present in the transaction records."""
        query = text("SELECT DISTINCT m.codigo FROM wimm.registro_inversion ri JOIN wimm.moneda m ON m.id = ri.moneda_id WHERE ri.activo = 1")
        result = await self.db.execute(query)
        return [row[0] for row in result.fetchall()]

    async def get_exchange_rate(self, src: str, dst: str = "USD") -> float:
        """Fetches the latest exchange rate between two currencies."""
        if src == dst:
            return 1.0
            
        query = text("SELECT valor FROM wimm.tasa_cambio WHERE moneda_origen = :src AND moneda_destino = :dst LIMIT 1")
        result = await self.db.execute(query, {"src": src, "dst": dst})
        row = result.fetchone()
        return float(row[0]) if row else 1.0

    async def get_all_exchange_rates(self) -> List[Dict[str, Any]]:
        """
        Retrieves all exchange rates from the 'tasa_cambio' table.
        Excludes records where source and destination currencies are the same.
        """
        query = text("""
            SELECT moneda_origen, moneda_destino, valor, fecha_actualizacion 
            FROM wimm.tasa_cambio 
            WHERE moneda_origen != moneda_destino
        """)
        result = await self.db.execute(query)
        return [
            {
                "moneda_origen": row[0],
                "moneda_destino": row[1],
                "valor": float(row[2]),
                "fecha_actualizacion": row[3]
            }
            for row in result.fetchall()
        ]

    async def update_exchange_rate(self, src: str, dst: str, value: float, last_updated: Any) -> None:
        """
        Updates or inserts an exchange rate in the 'tasa_cambio' table.
        """
        # Using ON DUPLICATE KEY UPDATE assuming there's a unique constraint on (moneda_origen, moneda_destino)
        # If not, we'll use a simple UPDATE since the table seems established.
        query = text("""
            UPDATE wimm.tasa_cambio 
            SET valor = :val, fecha_actualizacion = :dt 
            WHERE moneda_origen = :src AND moneda_destino = :dst
        """)
        await self.db.execute(query, {"src": src, "dst": dst, "val": value, "dt": last_updated})

    async def get_stocks_transactions(self, user_id: int, active_investment: bool = True) -> pd.DataFrame:
        """
        Retrieves transaction history for active stock investments (Variable Income).
        Criteria: i.activa = 1 AND tii.sub_clase LIKE '%Activos%'
        """
        query = text('''
            SELECT
                ii.nombre AS nombre,
                ii.nombre_corto AS nombre_corto,
                ri.fecha_transaccion,
                SUM(CASE WHEN ri.tipo_operacion = 'A' THEN ri.monto ELSE 0 END) AS aporte,
                SUM(CASE WHEN ri.tipo_operacion = 'R' THEN ri.monto ELSE 0 END) AS retiro,
                SUM(CASE WHEN ri.tipo_operacion = 'D' THEN ri.monto ELSE 0 END) AS dividendos,
                SUM(CASE WHEN ri.tipo_operacion = 'A' THEN ri.monto ELSE 0 END) / NULLIF(SUM(CASE WHEN ri.tipo_operacion = 'A' THEN ri.cuotas_participacion ELSE 0 END), 0) AS precio_compra,
                SUM(CASE WHEN ri.tipo_operacion = 'R' THEN ri.monto ELSE 0 END) / NULLIF(SUM(CASE WHEN ri.tipo_operacion = 'R' THEN ri.cuotas_participacion ELSE 0 END), 0) AS precio_venta,
                SUM(CASE WHEN ri.tipo_operacion = 'A' THEN ri.cuotas_participacion 
                         WHEN ri.tipo_operacion = 'R' THEN ri.cuotas_participacion * -1 
                         ELSE 0 END) AS cuotas_participacion,
                i.id AS inversion_id,
                i.activa
            FROM
                wimm.inversion i
            JOIN wimm.registro_inversion ri ON
                ri.inversion_id = i.id
            JOIN wimm.instrumento_inversion ii ON
                ii.id = i.instrumento_inversion_id
            JOIN wimm.tipo_instrumento_inversion tii ON
                tii.id = ii.tipo_instrumento_inversion_id
            WHERE
                i.usuario_id = :user_id
                AND tii.sub_clase LIKE '%Activos%'
                AND ri.activo = 1
                AND ri.tipo_operacion IN ('A', 'R', 'D')
            GROUP BY
                i.id,
                ri.fecha_transaccion
            ORDER BY
                ri.fecha_transaccion ASC
        ''')
        
        result = await self.db.execute(query, {"user_id": user_id})
        rows = result.fetchall()
        
        if not rows:
            return pd.DataFrame()
            
        df = pd.DataFrame(rows, columns=list(result.keys()))
        if active_investment:
            df = df[df['activa'] == True]
        df['fecha_transaccion'] = pd.to_datetime(df['fecha_transaccion'])
        return df
