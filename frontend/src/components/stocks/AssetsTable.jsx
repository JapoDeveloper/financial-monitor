import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

const AssetsTable = ({ assets, onSelectAsset, selectedTicker }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'weight', direction: 'desc' });

  const formatValue = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  const formatPercent = (val) => `${(val * 100).toFixed(1)}%`;

  const sortedAssets = useMemo(() => {
    let sortableAssets = [...assets];
    if (sortConfig !== null) {
      sortableAssets.sort((a, b) => {
        let aValue, bValue;

        if (sortConfig.key === 'distance') {
          const aAvg = a.average_buy_price || 0;
          const aCurr = a.current_price || 0;
          aValue = aAvg > 0 ? (aCurr - aAvg) / aAvg : 0;

          const bAvg = b.average_buy_price || 0;
          const bCurr = b.current_price || 0;
          bValue = bAvg > 0 ? (bCurr - bAvg) / bAvg : 0;
        } else {
          aValue = a[sortConfig.key];
          bValue = b[sortConfig.key];
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableAssets;
  }, [assets, sortConfig]);

  const requestSort = (key) => {
    let direction = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  return (
    <div className="fm-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="fm-table">
          <thead>
            <tr>
              <th>Activo</th>
              <th style={{ textAlign: 'left' }}>Clasific.</th>
              <th>Tamaño</th>
              <th>Estilo</th>
              <th>Región</th>
              <th 
                onClick={() => requestSort('current_value')}
                style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                className="sortable-header"
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                  Valor Actual {getSortIndicator('current_value')}
                </div>
              </th>
              <th 
                onClick={() => requestSort('weight')}
                style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                className="sortable-header"
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                  Peso % {getSortIndicator('weight')}
                </div>
              </th>
              <th 
                onClick={() => requestSort('ytd_return')}
                style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none', color: 'var(--blue-600)' }}
                className="sortable-header"
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                  YTD Mercado {getSortIndicator('ytd_return')}
                </div>
              </th>
              <th 
                onClick={() => requestSort('ytd_twr')}
                style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none', color: 'var(--blue-800)' }}
                className="sortable-header"
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                  YTD TWR {getSortIndicator('ytd_twr')}
                </div>
              </th>
              <th style={{ textAlign: 'right' }}>Precio Mercado</th>
              <th style={{ textAlign: 'right' }}>Costo Prom.</th>
              <th 
                onClick={() => requestSort('distance')}
                style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                className="sortable-header"
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                  Distancia % {getSortIndicator('distance')}
                </div>
              </th>
              <th style={{ textAlign: 'center' }}></th>
            </tr>
          </thead>
          <tbody>
            {sortedAssets.map((asset) => {
              const isSelected = selectedTicker === asset.ticker;
              const isSmall = asset.weight < 0.01;
              const formatPrice = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
              
              const avgPrice = asset.average_buy_price || 0;
              const currPrice = asset.current_price || 0;
              const distance = avgPrice > 0 ? (currPrice - avgPrice) / avgPrice : 0;

              return (
                <tr 
                  key={asset.ticker}
                  className={isSelected ? "row-highlight" : ""}
                  style={{ 
                    opacity: isSmall ? 0.7 : 1
                  }}
                  onClick={() => onSelectAsset && onSelectAsset(asset.ticker)}
                >
                  <td style={{ textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: isSelected ? 'var(--blue-800)' : 'var(--gray-200)', 
                        color: isSelected ? 'white' : 'var(--blue-800)',
                        width: 40, height: 40, borderRadius: '50%',
                        fontWeight: 'bold', fontSize: '0.9rem'
                      }}>
                        {asset.ticker.substring(0, 2)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--blue-800)' }}>{asset.ticker}</div>
                        <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)', textTransform: 'uppercase' }}>{asset.name}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    <span className={`status-badge status-badge--neutral`}>
                      {asset.classification}
                    </span>
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    <span className="kpi-badge kpi-badge--neutral">{asset.thematic.focus}</span>
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    <span className="status-badge status-badge--neutral">{asset.thematic.niche}</span>
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    <span style={{ fontWeight: 500, fontSize: 'var(--font-size-sm)' }}>{asset.thematic.region}</span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {formatValue(asset.current_value)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: '900', color: 'var(--blue-800)' }}>
                    {formatPercent(asset.weight)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', color: asset.ytd_return >= 0 ? 'var(--green-500)' : 'var(--red-500)' }}>
                    {formatPercent(asset.ytd_return)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: asset.ytd_twr >= 0 ? 'var(--green-500)' : 'var(--red-500)' }}>
                    <span className={`kpi-badge ${asset.ytd_twr >= 0 ? 'kpi-badge--up' : 'kpi-badge--down'}`} style={{ fontSize: 'var(--font-size-xs)', fontWeight: 900 }}>
                      {asset.ytd_twr > 0 ? '+' : ''}{formatPercent(asset.ytd_twr)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: '500', color: 'var(--gray-600)' }}>
                    {formatPrice(currPrice)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: '500', color: 'var(--gray-600)' }}>
                    {formatPrice(avgPrice)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    <span style={{ color: distance >= 0 ? 'var(--green-500)' : 'var(--red-500)' }}>
                      {distance >= 0 ? '↑' : '↓'} {formatPercent(Math.abs(distance))}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ 
                      width: 10, height: 10, borderRadius: '50%', 
                      backgroundColor: isSelected ? 'var(--blue-800)' : 'transparent',
                      border: isSelected ? 'none' : '2px solid var(--gray-200)',
                      margin: '0 auto'
                    }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AssetsTable;
