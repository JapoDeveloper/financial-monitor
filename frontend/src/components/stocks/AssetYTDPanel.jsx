import React from 'react';

const AssetYTDPanel = ({ assets }) => {
  const formatPercent = (val) => `${(val * 100).toFixed(2)}%`;
  
  // Sort assets by market YTD return descending
  const sortedAssets = [...assets].sort((a, b) => b.ytd_return - a.ytd_return);

  return (
    <div style={{ height: 'fit-content', width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {sortedAssets.map((asset, index) => (
          <div 
            key={asset.ticker} 
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              paddingBottom: index === sortedAssets.length - 1 ? '0' : '12px', 
              paddingTop: index === 0 ? '0' : '12px',
              borderBottom: index === sortedAssets.length - 1 ? 'none' : '1px solid var(--border-color)' 
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'var(--blue-50)', 
                color: 'var(--blue-800)',
                width: '32px', height: '32px', borderRadius: '8px',
                fontWeight: 'bold', fontSize: 'var(--font-size-xs)'
              }}>
                {asset.ticker.substring(0, 2)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontWeight: 800, color: 'var(--gray-800)', fontSize: 'var(--font-size-sm)' }}>
                  {asset.ticker}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Mercado
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className={`kpi-badge ${asset.ytd_return >= 0 ? 'kpi-badge--up' : 'kpi-badge--down'}`} style={{ fontWeight: 900, fontSize: 'var(--font-size-sm)' }}>
                {asset.ytd_return > 0 ? '+' : ''}{formatPercent(asset.ytd_return)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AssetYTDPanel;
