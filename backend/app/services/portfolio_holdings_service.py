import pandas as pd
import numpy as np
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.schemas.holdings import (
    HoldingsReport, InvestmentDistribution, VariableIncomeData,
    ProfitabilityEvolutionReport, ProfitabilityInstrumentSerie, ProfitabilityTrendPoint,
    CagrPerformanceItem
)

class PortfolioHoldingsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_holdings(self, user_id: int, base_currency: str = 'DOP') -> HoldingsReport:
        # Replicating notebook query logic for holdings data
        query_str = f'''
            select
                v.alias_institucion as institucion,
                tii.nombre as tipo_instrumento,
                tii.clase as clase_tipo_instrumento,
                tii.sub_clase as sub_tipo_instrumento,
                v.etiqueta as instrumento_inversion,
                tii.plazo,
                tii.peso as peso_tipo_instrumento,
                v.moneda,
                sum(v.valor_neto) as valor_neto_original,
                sum(v.valor_neto * tc.valor) as valor_neto_ajustado
            from
            wimm.v1_general_inversiones v
            join wimm.tipo_instrumento_inversion tii on tii.id = v.tipo_instrumento_id
            join wimm.tasa_cambio tc on tc.moneda_origen = v.moneda and tc.moneda_destino = '{base_currency}'
            where
            v.usuario_id = {user_id}
            group by v.instrumento_inversion_id
            UNION
            select
                t.nombre as institucion,
                tii.nombre  as tipo_instrumento,
                tii.clase  as clase_tipo_instrumento,
                tii.sub_clase  as sub_tipo_instrumento,
                concat('Efectivo / ', m.codigo) as instrumento_inversion,
                'Liquido'  as plazo,
                ifnull(tii.peso,0) as peso_tipo_instrumento,
                m.codigo as moneda,
                cb.monto_disponible as valor_neto_original,
                cb.monto_disponible * tc.valor as valor_neto_ajustado
            from wimm.cuenta_bancaria cb
            join wimm.institucion_financiera t on t.id  = cb.institucion_financiera_id
            join wimm.moneda m on m.id = cb.moneda_id
            join wimm.tasa_cambio tc on tc.moneda_origen = m.codigo and tc.moneda_destino = '{base_currency}'
            join wimm.tipo_instrumento_inversion tii on tii.id = (case when cb.institucion_financiera_id in (1,2) then 7 when cb.institucion_financiera_id = 9 then 13 when cb.institucion_financiera_id = 12 then 20 else 0 end)
            where
              cb.institucion_financiera_id in (1,2,9,12) and
              cb.activa = 1 and
              cb.tipo in ('CA_GEN','CI_BR') and
              cb.usuario_id = {user_id}
        '''
        
        df = await self.db.run_sync(lambda session: pd.read_sql(text(query_str), session.connection()))

        # Process data for holdings report
        # 1. Distribution data
        distribucion_moneda = df.groupby('moneda').agg({
            'valor_neto_original': 'sum',
            'valor_neto_ajustado': 'sum'
        }).reset_index()
        distribucion_institucion = df.groupby('institucion')['valor_neto_ajustado'].sum().reset_index()
        distribucion_plazo = df.groupby('plazo')['valor_neto_ajustado'].sum().reset_index()
        distribucion_clase = df.groupby('clase_tipo_instrumento')['valor_neto_ajustado'].sum().reset_index()

        # 2. Variable income data
        renta_variable = df[df['clase_tipo_instrumento'] == 'Renta variable'].groupby('tipo_instrumento').agg({
            'valor_neto_ajustado': 'sum',
            'peso_tipo_instrumento': 'max'
        }).reset_index()
        total_rv = renta_variable['valor_neto_ajustado'].sum()
        renta_variable['pct_actual'] = renta_variable['valor_neto_ajustado'] / total_rv if total_rv > 0 else 0

        # 3. Treemap data structure (nested)
        treemap = self._prepare_treemap_data(df)

        return HoldingsReport(
            distribucion_moneda=[InvestmentDistribution(
                criterio='DIVISA', 
                nombre=str(row['moneda']), 
                total_valor=float(row['valor_neto_ajustado']),
                total_valor_nominal=float(row['valor_neto_original'])
            ) for _, row in distribucion_moneda.iterrows()],
            distribucion_institucion=[InvestmentDistribution(criterio='ENTIDAD', nombre=str(row['institucion']), total_valor=float(row['valor_neto_ajustado'])) for _, row in distribucion_institucion.iterrows()],
            distribucion_plazo=[InvestmentDistribution(criterio='PLAZO', nombre=str(row['plazo']), total_valor=float(row['valor_neto_ajustado'])) for _, row in distribucion_plazo.iterrows()],
            distribucion_clase=[InvestmentDistribution(criterio='CLASE', nombre=str(row['clase_tipo_instrumento']), total_valor=float(row['valor_neto_ajustado'])) for _, row in distribucion_clase.iterrows()],
            renta_variable=[VariableIncomeData(instrumento=str(row['tipo_instrumento']), valor_actual=float(row['pct_actual']), meta_objetivo=float(row['peso_tipo_instrumento'])) for _, row in renta_variable.iterrows()],
            treemap_data=treemap
        )

    async def get_profitability_evolution(self, user_id: int, year: int, currency: str) -> ProfitabilityEvolutionReport:
        query = f"""
            SELECT 
                MONTHNAME(DATE_SUB(ri.fecha_transaccion, interval 1 month)) as monthname, 
                tii.nombre as type_instrument, 
                ii.nombre as instrument, 
                ri.rentabilidad as yield,
                ri.monto as balance 
            FROM wimm.registro_inversion ri
            JOIN wimm.inversion i ON i.id = ri.inversion_id
            JOIN wimm.moneda m ON m.id = i.moneda_id 
            JOIN wimm.instrumento_inversion ii ON ii.id = i.instrumento_inversion_id 
            JOIN wimm.tipo_instrumento_inversion tii on tii.id = ii.tipo_instrumento_inversion_id
            WHERE ri.activo = 1 
              AND i.activa = 1
              AND i.usuario_id = {user_id}  
              AND ri.tipo_operacion = 'C' 
              AND m.codigo = '{currency}'
              AND YEAR(DATE_SUB(ri.fecha_transaccion, interval 1 month)) = {year}
            ORDER BY MONTH(DATE_SUB(ri.fecha_transaccion, interval 1 month))
        """
        df = await self.db.run_sync(lambda session: pd.read_sql(text(query), session.connection()))
        
        if df.empty:
            return ProfitabilityEvolutionReport(year=year, currency=currency, series=[], weighted_average=[])

        # weighted average per month
        def calc_weighted(group):
            total_bal = group['balance'].sum()
            if total_bal == 0: return 0
            return (group['yield'] * group['balance']).sum() / total_bal

        wg_avg_df = df.groupby('monthname').apply(calc_weighted).reset_index().rename(columns={0: 'yield'})
        
        # Series per instrument
        series = []
        for instrument, inst_group in df.groupby('instrument'):
            type_inst = inst_group['type_instrument'].iloc[0]
            data_points = [
                ProfitabilityTrendPoint(month=row['monthname'], yield_value=float(row['yield']))
                for _, row in inst_group.iterrows()
            ]
            series.append(ProfitabilityInstrumentSerie(instrument=instrument, type_instrument=type_inst, data=data_points))

        weighted_average = [
            ProfitabilityTrendPoint(month=row['monthname'], yield_value=float(row['yield']))
            for _, row in wg_avg_df.iterrows()
        ]

        return ProfitabilityEvolutionReport(
            year=year,
            currency=currency,
            series=series,
            weighted_average=weighted_average
        )

    async def get_cagr_performance(self, user_id: int, base_currency: str = 'DOP') -> List[CagrPerformanceItem]:
        # 1. Historical Yields (CAGR)
        query_cagr = f'''
            SELECT 
                ii.nombre as instrumento,
                m.codigo as moneda,
                DATE_FORMAT(DATE_SUB(ri.fecha_transaccion, INTERVAL 1 MONTH), '%Y-%m') as periodo_iso,
                AVG(ri.rentabilidad) as yield
            FROM wimm.registro_inversion ri
            JOIN wimm.inversion i ON i.id = ri.inversion_id 
            JOIN wimm.instrumento_inversion ii ON ii.id = i.instrumento_inversion_id 
            JOIN wimm.moneda m ON m.id = i.moneda_id 
            WHERE i.usuario_id = {user_id}
              AND ri.activo = 1
              AND ri.tipo_operacion = 'C'
            GROUP BY ii.nombre, m.codigo, periodo_iso
            ORDER BY periodo_iso DESC
        '''
        
        # 2. Weights based on net global portfolio value (Base Currency)
        query_weights = f'''
            SELECT
                ii.nombre as instrumento,
                v.moneda,
                SUM(v.valor_neto * tc.valor) as valor_neto_ajustado
            FROM wimm.v1_general_inversiones v
            JOIN wimm.instrumento_inversion ii ON ii.id = v.instrumento_inversion_id
            JOIN wimm.tasa_cambio tc ON tc.moneda_origen = v.moneda AND tc.moneda_destino = '{base_currency}'
            WHERE v.usuario_id = {user_id}
            GROUP BY ii.nombre, v.moneda
            UNION
            SELECT 
                concat('Efectivo / ', m.codigo) as instrumento,
                m.codigo as moneda,
                cb.monto_disponible * tc.valor as valor_neto_ajustado
            FROM wimm.cuenta_bancaria cb 
            JOIN wimm.moneda m ON m.id = cb.moneda_id 
            JOIN wimm.tasa_cambio tc ON tc.moneda_origen = m.codigo AND tc.moneda_destino = '{base_currency}'
            WHERE cb.institucion_financiera_id in (1,2,9,12) 
              AND cb.activa = 1 
              AND cb.tipo in ('CA_GEN','CI_BR') 
              AND cb.usuario_id = {user_id}
        '''

        df_cagr = await self.db.run_sync(lambda session: pd.read_sql(text(query_cagr), session.connection()))
        df_weights = await self.db.run_sync(lambda session: pd.read_sql(text(query_weights), session.connection()))

        if df_cagr.empty:
            return []

        total_portfolio = df_weights['valor_neto_ajustado'].sum()
        df_weights['peso'] = (df_weights['valor_neto_ajustado'] / total_portfolio) * 100
        
        # Pivot CAGR data
        df_cagr['eff_monthly'] = ((1 + df_cagr['yield'] / 100) ** (1/12)) - 1
        df_pivot = df_cagr.pivot_table(index=['instrumento', 'moneda'], columns='periodo_iso', values='eff_monthly')
        df_pivot = df_pivot.sort_index(axis=1, ascending=False)

        def calculate_cagr(series, n_months):
            subset = series.iloc[:n_months]
            if subset.count() < (n_months * 0.8): # Tolerance: at least 80% of data
                return None
            total_growth = np.prod(1 + subset)
            cagr = (total_growth ** (12 / n_months)) - 1
            return float(cagr * 100)

        results = []
        for (inst, moneda), row in df_pivot.iterrows():
            weight = df_weights[(df_weights['instrumento'] == inst) & (df_weights['moneda'] == moneda)]['peso'].sum()
            if weight == 0: continue # Only include instruments with current weight > 0
            
            results.append(CagrPerformanceItem(
                instrument=inst,
                currency=moneda,
                weight=float(weight),
                cagr_30d=calculate_cagr(row, 1),
                cagr_90d=calculate_cagr(row, 3),
                cagr_180d=calculate_cagr(row, 6),
                cagr_1y=calculate_cagr(row, 12),
                cagr_3y=calculate_cagr(row, 36),
                cagr_5y=calculate_cagr(row, 60)
            ))
        
        # Sort by currency and then by weight descending
        results.sort(key=lambda x: (x.currency, -x.weight))
        return results

    def _prepare_treemap_data(self, df: pd.DataFrame) -> List[dict]:
        # Generar jerarquía con colores consistentes por sub-tipo
        treemap_data = []
        unique_subtypes = df['sub_tipo_instrumento'].unique().tolist()
        
        for clase, clase_group in df.groupby('clase_tipo_instrumento'):
            clase_val = float(clase_group['valor_neto_ajustado'].sum())
            clase_node = {'name': clase, 'value': clase_val, 'children': []}
            
            for sub_tipo, sub_group in clase_group.groupby('sub_tipo_instrumento'):
                sub_val = float(sub_group['valor_neto_ajustado'].sum())
                color_idx = unique_subtypes.index(sub_tipo)
                
                sub_node = {
                    'name': sub_tipo, 
                    'value': sub_val, 
                    'children': [], 
                    'color_index': color_idx
                }
                
                for _, row in sub_group.iterrows():
                    sub_node['children'].append({
                        'name': row['instrumento_inversion'], 
                        'value': float(row['valor_neto_ajustado']),
                        'color_index': color_idx
                    })
                clase_node['children'].append(sub_node)
            treemap_data.append(clase_node)
            
        return treemap_data


