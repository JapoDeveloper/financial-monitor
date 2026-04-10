import React, { useState, useRef, useEffect } from 'react';
import {RefreshCw, ArrowUpCircle, ArrowDownCircle, MinusCircle, Info, X } from 'lucide-react';

const RebalancePanel = ({ recommendations, macroRegime }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const triggerRef = useRef(null);
  
  // Close tooltip on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (triggerRef.current && !triggerRef.current.contains(event.target)) {
        setShowTooltip(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [triggerRef]);

  if (!recommendations || recommendations.length === 0) return null;

  const getActionStyles = (action) => {
    switch (action) {
      case 'BUY':
        return { color: 'var(--blue-600)', bg: 'var(--blue-50)', icon: <ArrowUpCircle size={16} /> };
      case 'SELL':
        return { color: 'var(--red-600)', bg: 'var(--red-50)', icon: <ArrowDownCircle size={16} /> };
      default:
        return { color: 'var(--gray-500)', bg: 'var(--gray-50)', icon: <MinusCircle size={16} /> };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Refined Legend for context: Black-Litterman */}
      <div style={{ 
        padding: '12px', 
        backgroundColor: 'var(--blue-50)', 
        borderRadius: '8px', 
        border: '1px dashed var(--blue-200)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        marginBottom: '4px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }} ref={triggerRef}>
          <button 
            onClick={() => setShowTooltip(!showTooltip)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title="Ver Guía de Escenarios Macroeconómicos"
          >
            <Info size={14} color="var(--blue-600)" />
          </button>
          <span style={{ fontSize: '11px', color: 'var(--blue-900)', fontWeight: 800 }}>
            Modelo Óptimo Black-Litterman
          </span>
          
          {/* Tooltip / Popover Guía Macro */}
          {showTooltip && (
            <div style={{
              position: 'absolute',
              top: '24px',
              left: '0',
              zIndex: 100,
              width: '320px',
              backgroundColor: 'white',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <strong style={{ fontSize: '12px', color: 'var(--blue-900)' }}>📚 Guía de Regímenes Macro</strong>
                <button onClick={() => setShowTooltip(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)' }}>
                  <X size={14} />
                </button>
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li style={{ fontSize: '11px', lineHeight: 1.4, color: 'var(--gray-700)' }}>
                  <strong>🔥 Crecimiento Caliente:</strong> Tasas altas/subiendo + Equity en alza. <em>El modelo premia proporcionalmente a los activos de alto beta.</em>
                </li>
                <li style={{ fontSize: '11px', lineHeight: 1.4, color: 'var(--gray-700)' }}>
                  <strong>📉 Estanflación / Contracción:</strong> Tasas altas + Equity a la baja. <em>El modelo castiga duramente a los activos cíclicos (Alto Beta) y protege los defensivos (Bajo Beta).</em>
                </li>
                <li style={{ fontSize: '11px', lineHeight: 1.4, color: 'var(--gray-700)' }}>
                  <strong>🛡️ Recesión / Vuelo a Calidad:</strong> Tasas a la baja + Equity a la baja. <em>Premio significativo a los activos de refugio (Bonos, Oro). Castigo al resto de la renta variable.</em>
                </li>
                <li style={{ fontSize: '11px', lineHeight: 1.4, color: 'var(--gray-700)' }}>
                  <strong>☀️ Relajación (Ricitos de Oro):</strong> Tasas a la baja + Equity en alza. <em>Expansión múltiple, fuerte ponderación al alza para todo el espectro de Alto Beta.</em>
                </li>
                <li style={{ fontSize: '11px', lineHeight: 1.4, color: 'var(--gray-700)' }}>
                  <strong>⚖️ Estable / Neutral:</strong> Tensión moderada. <em>El modelo asume eficiencia de mercado y solo cambia tus pesos empujado por alta covarianza. Mínima fricción.</em>
                </li>
                <div style={{ margin: '4px 0', borderTop: '1px dashed var(--border-color)' }}></div>
                <li style={{ fontSize: '11px', lineHeight: 1.4, color: 'var(--green-700)' }}>
                  <strong>💡 Maximizar Alpha (Aportes):</strong> Escenario agnóstico. <em>Cruza el rendimiento estructural histórico (Alpha) y el momento actual (YTD) para guiarte en dónde poner tu dinero nuevo evitando burbujas.</em>
                </li>
              </ul>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '22px' }}>
          <div style={{ fontSize: '11px', color: 'var(--blue-800)' }}>
            <strong>Escenario Macro Detectado:</strong> {macroRegime || 'Calculando...'}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--gray-600)', marginTop: '4px' }}>
            Las recomendaciones ajustan dinámicamente el presupuesto de riesgo en base a las vistas del régimen macroeconómico actual, mitigando el Tracking Error.
          </div>
        </div>
      </div>

      {recommendations.map((rec) => {
        const styles = getActionStyles(rec.action);
        return (
          <div 
            key={rec.ticker} 
            style={{ 
              padding: '14px', 
              backgroundColor: 'white', 
              borderRadius: '12px', 
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 900, color: 'var(--blue-900)', fontSize: '0.95rem' }}>{rec.ticker}</span>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px', 
                  padding: '2px 8px', 
                  borderRadius: '20px', 
                  backgroundColor: styles.bg, 
                  color: styles.color,
                  fontSize: '10px',
                  fontWeight: 800
                }}>
                  {styles.icon}
                  {rec.action}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, color: styles.color, fontSize: 'var(--font-size-xs)' }}>
                  {rec.action === 'HOLD' ? 'Objetivo: ' : (rec.delta_weight > 0 ? '+' : '')}
                  {rec.action !== 'HOLD' && `${(rec.delta_weight * 100).toFixed(1)}% `}
                  <span style={{ fontSize: '10px', color: 'var(--gray-500)' }}>
                    (&rarr; {(rec.target_weight * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
            
            <div style={{ 
              display: 'flex', 
              gap: '6px', 
              padding: '8px', 
              backgroundColor: 'var(--gray-50)', 
              borderRadius: '6px',
              borderLeft: `2px solid ${styles.color}`
            }}>
              <Info size={12} color="var(--gray-400)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ margin: 0, fontSize: '10px', color: 'var(--gray-600)', lineHeight: 1.3 }}>
                {rec.rationale}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RebalancePanel;
