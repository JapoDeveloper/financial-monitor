import React from 'react';

const AlphaAttributionPanel = ({ data }) => {
  if (!data || data.length === 0) return null;

  return (
    <div style={{ height: 'fit-content', width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr 1fr', 
          paddingBottom: '12px', 
          borderBottom: '1px solid var(--border-color)',
          fontSize: 'var(--font-size-xs)',
          fontWeight: 900,
          color: 'var(--gray-400)',
          textTransform: 'uppercase',
          letterSpacing: 0.5
        }}>
          <div>ACTIVO</div>
          <div style={{ textAlign: 'center' }}>CONTRIB. ALPHA</div>
          <div style={{ textAlign: 'right' }}>VEREDICTO</div>
        </div>
        
        {data.map((item, index) => (
          <div 
            key={item.ticker} 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr 1fr', 
              alignItems: 'center', 
              padding: '14px 0',
              borderBottom: index === data.length - 1 ? 'none' : '1px solid var(--border-color)' 
            }}
          >
            <div style={{ fontWeight: 800, color: 'var(--blue-900)' }}>{item.ticker}</div>
            
            <div style={{ textAlign: 'center' }}>
              <span className={`kpi-badge ${item.alpha_contribution >= 0 ? 'kpi-badge--up' : 'kpi-badge--down'}`} style={{ fontWeight: 900, fontSize: 'var(--font-size-sm)' }}>
                {item.alpha_contribution > 0 ? '+' : ''}{(item.alpha_contribution * 100).toFixed(2)}%
              </span>
            </div>
            
            <div style={{ textAlign: 'right' }}>
              <span style={{ 
                padding: '4px 8px', 
                borderRadius: '6px', 
                fontSize: 'var(--font-size-sm)', 
                fontWeight: 900,
                backgroundColor: item.verdict === 'GENERADOR' ? 'var(--green-50)' : item.verdict === 'DETRACTOR' ? 'var(--red-50)' : 'var(--gray-50)',
                color: item.verdict === 'GENERADOR' ? 'var(--green-700)' : item.verdict === 'DETRACTOR' ? 'var(--red-700)' : 'var(--gray-600)'
              }}>
                <span className={`kpi-badge ${item.verdict === 'GENERADOR' ? 'kpi-badge--up' : 'kpi-badge--down'}`}>
                {item.verdict}
                </span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AlphaAttributionPanel;
