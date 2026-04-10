import React from 'react';
import { ShieldCheck, ShieldAlert, Zap, Info } from 'lucide-react';

const DiagnosticPanel = ({ diagnostic, riskFree }) => {
  const getVerdictColor = () => {
    if (diagnostic.verdict.includes("EXCELENTE")) return "#2E7D32";
    if (diagnostic.verdict.includes("BUENA")) return "#457B9D";
    if (diagnostic.verdict.includes("MEJORABLE")) return "#ED6C02";
    return "#D32F2F";
  };

  const getIcon = () => {
    if (diagnostic.verdict.includes("Alpha")) return <Zap size={24} color={getVerdictColor()} />;
    if (diagnostic.verdict.includes("Neutral")) return <ShieldCheck size={24} color={getVerdictColor()} />;
    return <ShieldAlert size={24} color={getVerdictColor()} />;
  };

  const verdictText = diagnostic.verdict.split(' (')[0];

  const fmtPct = (v) => `${(v * 100).toFixed(2)}%`;
  const alphaColor = (v) => v >= 0 ? 'var(--green-500)' : 'var(--red-500)';

  return (
    <div className="fm-card" style={{ height: 'fit-content', width: 'fit-content', border: '1px solid rgba(0,0,0,0.05)' }}>
      <div style={{ padding: '8px' }}>
        {/* Header Badge */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          marginBottom: '24px',
          padding: '12px 24px',
          borderRadius: '12px',
          backgroundColor: `${getVerdictColor()}10`,
          border: `1px solid ${getVerdictColor()}30`,
          width: 'fit-content'
        }}>
          {getIcon()}
          <span style={{ fontWeight: 900, color: getVerdictColor(), lineHeight: 1.2, fontSize: 'var(--font-size-md)' }}>
            {verdictText}
          </span>
        </div>

        {/* Dual Alpha + Risk-Free */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>

          {/* Alpha TWR */}
          <div style={{ flex: '1 1 auto' }}>
            <div style={{ color: 'var(--gray-400)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, fontSize: 'var(--font-size-xs)' }}>
              Alpha (TWR)
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '4px' }}>
              <span style={{ fontWeight: 900, color: alphaColor(diagnostic.alpha_jensen), fontSize: '1.25rem' }}>
                {fmtPct(diagnostic.alpha_jensen)}
              </span>
              <span style={{ color: 'var(--gray-400)', fontWeight: 'bold', fontSize: 'var(--font-size-xs)' }}>
                ({diagnostic.alpha_label})
              </span>
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-400)', marginTop: '2px' }}>
              Gestión con flujos
            </div>
          </div>

          {/* Alpha Mercado */}
          <div style={{ flex: '1 1 auto' }}>
            <div style={{ color: 'var(--gray-400)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, fontSize: 'var(--font-size-xs)' }}>
              Alpha (Mercado)
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '4px' }}>
              <span style={{ fontWeight: 900, color: alphaColor(diagnostic.alpha_market), fontSize: '1.25rem' }}>
                {fmtPct(diagnostic.alpha_market)}
              </span>
              <span style={{ color: 'var(--gray-400)', fontWeight: 'bold', fontSize: 'var(--font-size-xs)' }}>
                ({diagnostic.alpha_market_label})
              </span>
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-400)', marginTop: '2px' }}>
              Calidad activos pura
            </div>
          </div>

          {/* Risk-Free */}
          <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-end', textAlign: 'right' }}>
            <div style={{ color: 'var(--gray-400)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, fontSize: 'var(--font-size-xs)' }}>
              Risk-Free Rate
            </div>
            <span style={{ fontWeight: 900, color: 'var(--blue-800)', marginTop: '4px', fontSize: '1.1rem' }}>
              {(riskFree * 100).toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Separator */}
        <div style={{ height: '1px', backgroundColor: 'rgba(0,0,0,0.05)', margin: '24px 0' }}></div>

        {/* New Row: Portfolio Values */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '40px', alignItems: 'center' }}>
          
          {/* Valor Invertido */}
          <div style={{ flex: '1 1 auto' }}>
            <div style={{ color: 'var(--gray-400)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, fontSize: 'var(--font-size-xs)' }}>
              Valor Total Invertido
            </div>
            <div style={{ fontWeight: 900, color: 'var(--blue-900)', fontSize: '1.2rem', marginTop: '4px' }}>
              ${diagnostic.total_invested?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Valor Actual */}
          <div style={{ flex: '1 1 auto' }}>
            <div style={{ color: 'var(--gray-400)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, fontSize: 'var(--font-size-xs)' }}>
              Valor Actual Cartera
            </div>
            <div style={{ fontWeight: 900, color: 'var(--blue-900)', fontSize: '1.2rem', marginTop: '4px' }}>
              ${diagnostic.current_value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Diferencia */}
          {(() => {
            const diff = diagnostic.current_value - diagnostic.total_invested;
            const diffPct = diagnostic.total_invested > 0 ? (diff / diagnostic.total_invested) * 100 : 0;
            const color = diff >= 0 ? 'var(--green-500)' : 'var(--red-500)';
            return (
              <div style={{ flex: '1 1 auto', textAlign: 'right' }}>
                <div style={{ color: 'var(--gray-400)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, fontSize: 'var(--font-size-xs)' }}>
                  Diferencia de Cartera
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                  <span style={{ fontWeight: 900, color: color, fontSize: '1.25rem' }}>
                    {diff >= 0 ? '+' : ''}${Math.abs(diff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span style={{ color: color, fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                    ({diffPct >= 0 ? '+' : ''}{diffPct.toFixed(2)}%)
                  </span>
                </div>
              </div>
            );
          })()}

        </div>
      </div>
    </div>
  );
};

export default DiagnosticPanel;
