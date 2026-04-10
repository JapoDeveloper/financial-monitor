import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Award, List, PieChart as PieChartIcon, Activity, Loader2, AlertCircle } from 'lucide-react';
import { getStocksDashboard } from '../api/stocks';

import Scorecard        from '../components/stocks/Scorecard';
import DiagnosticPanel  from '../components/stocks/DiagnosticPanel';
import AssetYTDPanel    from '../components/stocks/AssetYTDPanel';
import AssetsTable      from '../components/stocks/AssetsTable';
import ThematicCharts   from '../components/stocks/ThematicCharts';
import AssetHistoryChart from '../components/stocks/AssetHistoryChart';
import PortfolioVariationChart from '../components/stocks/PortfolioVariationChart';
import RebalancePanel from '../components/stocks/RebalancePanel';
import AlphaAttributionPanel from '../components/stocks/AlphaAttributionPanel';
import { RefreshCw } from 'lucide-react';

/* ── Section Header ─────────────────────────────── */
const SectionHeader = ({ icon: Icon, title }) => (
  <div className="section-header">
    <div className="section-icon-wrapper">
      <Icon size={17} color="var(--blue-600)" strokeWidth={2} />
    </div>
    <h2 className="section-title">
      {title}
    </h2>
  </div>
);

/* ── Main Page ──────────────────────────────────── */
const StocksPortfolio = () => {
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [isTacticalExpanded, setIsTacticalExpanded] = useState(false);
  const [macroRegimeOverride, setMacroRegimeOverride] = useState('');

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['stocksDashboard', macroRegimeOverride],
    queryFn: () => getStocksDashboard(macroRegimeOverride),
    refetchOnWindowFocus: false,
    keepPreviousData: true,
    placeholderData: (prev) => prev
  });

  useEffect(() => {
    if (data?.assets?.length > 0 && !selectedTicker) {
      setSelectedTicker(data.assets[0].ticker);
    }
  }, [data, selectedTicker]);

  if (isLoading) return (
    <div className="empty-panel">
      <Loader2 size={40} style={{ animation: 'spin 1s linear infinite', color: 'var(--blue-500)' }} />
      <p className="empty-panel-text">
        Analizando portafolio de bolsa…
      </p>
    </div>
  );

  if (isError) return (
    <div className="fm-alert fm-alert--error section-spacing">
      <AlertCircle size={18} style={{ flexShrink: 0 }} />
      <span>Error al cargar el dashboard: {error.message}</span>
    </div>
  );

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 20px 60px 20px' }}>
      {/* ── Header ──────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Bolsa de Valores
          </h1>
          <p className="page-subtitle">
            Seguimiento de renta variable y métricas de riesgo
          </p>
        </div>
      </div>

      {/* ── FILA 1: Diagnóstico + Comparativa YTD ─────────────────── */}
      <div className="section-spacing" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        <div>
          <SectionHeader icon={Award} title="Diagnóstico de Gestión" />
          <DiagnosticPanel diagnostic={data.diagnostic} riskFree={data.risk_free_rate} />
        </div>
        <div>
          <SectionHeader icon={TrendingUp} title="Comparativa YTD & Benchmarks" />
          <Scorecard data={data.scorecard} />
        </div>
      </div>

      {/* ── FILA 2: Panel Colapsable (Análisis Táctico) ─────────────────── */}
      <div className="section-spacing fm-panel" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
        <button 
          onClick={() => setIsTacticalExpanded(!isTacticalExpanded)}
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px',
            backgroundColor: isTacticalExpanded ? 'var(--gray-50)' : 'white',
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              backgroundColor: 'var(--blue-50)', 
              padding: '8px', 
              borderRadius: '10px',
              color: 'var(--blue-600)'
            }}>
              <Activity size={20} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 800, color: 'var(--blue-900)', fontSize: '1.1rem' }}>Análisis Táctico de Portafolio</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-500)' }}>
                Rendimiento YTD, Atribución Alpha y Modelo de Rebalanceo
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--gray-400)' }}>
            {isTacticalExpanded ? 'Contraer' : 'Expandir'}
            {isTacticalExpanded ? <RefreshCw size={18} style={{ transform: 'rotate(180deg)', transition: 'transform 0.3s ease' }} /> : <RefreshCw size={18} />}
          </div>
        </button>

        {isTacticalExpanded && (
          <div style={{ padding: '32px', backgroundColor: 'var(--gray-50)', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr 4fr', gap: '64px' }}>
              <div>
                <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--blue-900)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={14} /> Rendimiento YTD
                </h4>
                <AssetYTDPanel assets={data.assets} />
              </div>
              <div>
                <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--blue-900)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Award size={14} /> Atribución de Alpha
                </h4>
                <AlphaAttributionPanel data={data.alpha_attribution} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--blue-900)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <RefreshCw size={14} /> Modelo de Rebalanceo
                  </h4>
                  <select 
                    value={macroRegimeOverride} 
                    onChange={(e) => setMacroRegimeOverride(e.target.value)}
                    className="fm-input"
                    style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '11px', width: '160px', border: '1px solid var(--border-color)', outline: 'none' }}
                  >
                    <option value="">Automático (Medido)</option>
                    <option value="Crecimiento Caliente (Tasas al Alza, Equity Fuerte)">Crecimiento Caliente</option>
                    <option value="Estanflación / Contracción de Múltiplos (Tasas al Alza, Equity Débil)">Estanflación</option>
                    <option value="Recesión / Vuelo a la Calidad (Tasas a la Baja, Equity Débil)">Recesión</option>
                    <option value="Ricitos de Oro / Relajación (Tasas a la Baja, Equity Fuerte)">Relajación</option>
                    <option value="Régimen Estable / Neutral">Estable / Neutral</option>
                    <option value="💡 Maximizar Alpha (Aporte Puntual)" style={{ fontWeight: 'bold', color: 'var(--green-600)' }}>💡 Maximizar Alpha (Aporte Especial)</option>
                  </select>
                </div>
                {isFetching && !isLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                    <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--blue-500)' }} />
                    <span style={{ marginLeft: '8px', fontSize: 'var(--font-size-sm)', color: 'var(--gray-500)' }}>Recalibrando portafolio...</span>
                  </div>
                ) : (
                  <RebalancePanel 
                    recommendations={data.rebalancing_recommendations} 
                    macroRegime={data.macro_regime}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── FILA 3: Composición Temática ─────────────────── */}
      <div className="section-spacing">
        <SectionHeader icon={PieChartIcon} title="Composición Temática" />
        <ThematicCharts assets={data.assets} />
      </div>

      {/* ── FILA 4: Detalle de Activos ─────────────────── */}
      <div className="section-spacing">
        <SectionHeader icon={List} title="Detalle de Posiciones" />
        <AssetsTable
          assets={data.assets}
          selectedTicker={selectedTicker}
          onSelectAsset={setSelectedTicker}
        />
      </div>

      {/* ── FILA 5: Evolución Individual con Selección ─────────────────── */}
      <div className="section-spacing" style={{ backgroundColor: 'white', padding: '24px', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <SectionHeader icon={Activity} title="Análisis de Evolución Individual" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--gray-500)' }}>Seleccionar Activo:</span>
            <select 
              value={selectedTicker || ''} 
              onChange={(e) => setSelectedTicker(e.target.value)}
              className="fm-input"
              style={{ padding: '8px 16px', borderRadius: '10px', fontSize: 'var(--font-size-sm)', fontWeight: 700, width: '160px' }}
            >
              {data.assets.map(a => (
                <option key={a.ticker} value={a.ticker}>{a.ticker}</option>
              ))}
            </select>
          </div>
        </div>
        {selectedTicker && <AssetHistoryChart ticker={selectedTicker} />}
      </div>

      {/* ── FILA 6: Comparativa de Variación ─────────────────── */}
      <div className="section-spacing">
        <SectionHeader icon={TrendingUp} title="Matriz de Variación de Precios (Base 100 - Visualización de Correlación)" />
        <PortfolioVariationChart data={data.portfolio_history} />
      </div>
    </div>
  );
};

export default StocksPortfolio;
