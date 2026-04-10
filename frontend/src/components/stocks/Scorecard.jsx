import React from 'react';
import { Info } from 'lucide-react';

const Scorecard = ({ data }) => {
  const formatPercent = (val) => `${(val * 100).toFixed(2)}%`;
  const deltaColor = (v) => v >= 0 ? 'var(--green-500)' : 'var(--red-500)';
  const fmtDelta = (v, zero = '-') => v === 0 ? zero : (v > 0 ? '+' : '') + formatPercent(v);

  return (
    <div className="fm-card" style={{ overflow: 'hidden', padding: 0 }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="fm-table" style={{ minWidth: 700 }}>
          <thead>
            <tr>
              <th style={{ color: 'var(--blue-800)' }}>Estrategia</th>
              <th style={{ color: 'var(--blue-600)', textAlign: 'right' }}>YTD (Mercado)</th>
              <th style={{ color: 'var(--blue-800)', textAlign: 'right' }}>YTD (TWR)</th>
              <th style={{ color: 'var(--blue-800)', textAlign: 'right' }}>Volatilidad</th>
              <th style={{ color: 'var(--blue-800)', textAlign: 'right' }}>Sharpe</th>
              <th style={{ color: 'var(--blue-800)', textAlign: 'right' }}>Beta</th>
              <th style={{ color: 'var(--blue-600)', textAlign: 'right' }}>vs SPY (Mkt)</th>
              <th style={{ color: 'var(--blue-600)', textAlign: 'right' }}>vs VT (Mkt)</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => {
              const isPortfolio = row.strategy === "Mi Portafolio";
              return (
                <tr key={index} className={isPortfolio ? "row-highlight" : ""}>
                  <td style={{ fontWeight: isPortfolio ? 800 : 600 }}>
                    {row.strategy}
                  </td>
                  {/* YTD Mercado (Standardized for all) */}
                  <td style={{ textAlign: 'right' }}>
                    <span className={`kpi-badge ${row.ytd >= 0 ? 'kpi-badge--up' : 'kpi-badge--down'}`} style={{ fontWeight: 900, fontSize: 'var(--font-size-xs)' }}>
                      {row.ytd > 0 ? '+' : ''}{formatPercent(row.ytd)}
                    </span>
                  </td>
                  {/* YTD TWR (Portfolio only) */}
                  <td style={{ textAlign: 'right', fontWeight: 700, color: row.ytd_twr >= 0 ? 'var(--green-500)' : 'var(--red-500)' }}>
                    {row.ytd_twr != null ? formatPercent(row.ytd_twr) : <span style={{ color: 'var(--gray-400)' }}>—</span>}
                  </td>
                  <td className="text-muted" style={{ textAlign: 'right' }}>{formatPercent(row.volatility)}</td>
                  <td className="fw-bold" style={{ textAlign: 'right' }}>{row.sharpe.toFixed(2)}</td>
                  <td style={{ color: 'var(--blue-800)', fontWeight: 600, textAlign: 'right' }}>{row.beta.toFixed(2)}</td>
                  <td style={{ fontWeight: 600, textAlign: 'right', color: deltaColor(row.vs_spy) }}>
                    {fmtDelta(row.vs_spy)}
                  </td>
                  <td style={{ fontWeight: 600, textAlign: 'right', color: deltaColor(row.vs_vt) }}>
                    {fmtDelta(row.vs_vt)}
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

export default Scorecard;
