import React, { useState, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { CHART_PALETTE, TOOLTIP_STYLE, SELECTOR_STYLES } from '../../constants/chartTheme';

const TIMEFRAMES = [
  { label: '1M',  days: 30 },
  { label: '3M',  days: 90 },
  { label: '6M',  days: 180 },
  { label: 'YTD', days: 'ytd' },
  { label: '1A',  days: 365 },
];

const PortfolioVariationChart = ({ data }) => {
  const [hiddenTickers, setHiddenTickers] = useState(new Set());
  const [activeTimeframe, setActiveTimeframe] = useState('1A');
  const [hoveredTicker, setHoveredTicker] = useState(null);

  const filteredAndNormalizedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    let cutoffDate = new Date();
    const tf = TIMEFRAMES.find(t => t.label === activeTimeframe);
    
    if (tf.days === 'ytd') {
        cutoffDate = new Date(new Date().getFullYear(), 0, 1);
    } else {
        cutoffDate.setDate(cutoffDate.getDate() - tf.days);
    }

    const filtered = data.filter(d => new Date(d.date) >= cutoffDate);
    if (filtered.length === 0) return [];

    // Re-normalize to 100 on the first day of the visible range
    const firstPoint = filtered[0];
    const tickers = Object.keys(firstPoint).filter(k => k !== 'date');

    return filtered.map(point => {
        const newPoint = { date: point.date };
        tickers.forEach(t => {
            const startVal = firstPoint[t];
            if (startVal && startVal !== 0) {
                // (CurrentVal / InitialValInRange) * 100
                newPoint[t] = (point[t] / startVal) * 100;
            } else {
                newPoint[t] = 100;
            }
        });
        return newPoint;
    });
  }, [data, activeTimeframe]);

  if (!data || data.length === 0) {
    return (
      <div className="fm-card" style={{ padding: '32px', textAlign: 'center', color: 'var(--gray-400)' }}>
        No hay datos históricos suficientes para mostrar la variación.
      </div>
    );
  }

  // Extract all tickers from the data (excluding 'date')
  const tickers = Object.keys(data[0]).filter(key => key !== 'date');

  const handleLegendClick = (e) => {
    const { dataKey } = e;
    setHiddenTickers(prev => {
      const next = new Set(prev);
      if (next.has(dataKey)) {
        next.delete(dataKey);
      } else {
        next.add(dataKey);
      }
      return next;
    });
  };

  const selectAll = () => setHiddenTickers(new Set());
  const deselectAll = () => setHiddenTickers(new Set(tickers));

  return (
    <div className="fm-card" style={{ padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '14px', color: 'var(--gray-500)', lineHeight: '1.5', margin: 0 }}>
            Este gráfico muestra el rendimiento relativo de cada activo. 
            Todos los precios se normalizan a <strong>100</strong> en el punto de partida seleccionado.
          </p>
          <div style={{ marginTop: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button 
              onClick={selectAll}
              style={{ background: 'none', border: 'none', color: 'var(--blue-600)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              Mostrar todo
            </button>
            <div style={{ width: 1, height: 10, background: '#ddd' }} />
            <button 
              onClick={deselectAll}
              style={{ background: 'none', border: 'none', color: 'var(--gray-400)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              Ocultar todo
            </button>
          </div>
        </div>

        {/* ── Timeframe Selector ──────────────────── */}
        <div style={SELECTOR_STYLES.container}>
            {TIMEFRAMES.map(tf => (
                <button
                    key={tf.label}
                    style={SELECTOR_STYLES.button(activeTimeframe === tf.label)}
                    onClick={() => setActiveTimeframe(tf.label)}
                >
                    {tf.label}
                </button>
            ))}
        </div>
      </div>

      <div style={{ height: 500, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={filteredAndNormalizedData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EEF8" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 11, fill: 'var(--gray-400)' }} 
              tickMargin={12} 
              minTickGap={40} 
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              domain={['auto', 'auto']} 
              tick={{ fontSize: 11, fill: 'var(--gray-400)' }} 
              tickFormatter={val => val.toFixed(0)}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip 
              contentStyle={TOOLTIP_STYLE} 
              labelStyle={{ fontWeight: 'bold', color: 'var(--blue-800)', marginBottom: '8px' }} 
              itemStyle={{ fontSize: '12px', padding: '1px 0' }}
              formatter={(value, name) => [value.toFixed(2), name]} 
            />
            <Legend 
              wrapperStyle={{ paddingTop: '24px', fontSize: '12px', cursor: 'pointer' }} 
              iconType="circle"
              iconSize={8}
              onClick={handleLegendClick}
              onMouseEnter={(e) => setHoveredTicker(e.dataKey)}
              onMouseLeave={() => setHoveredTicker(null)}
              formatter={(value, entry) => {
                const isHidden = hiddenTickers.has(entry.dataKey);
                const isHovered = hoveredTicker === entry.dataKey;
                const anyHovered = hoveredTicker !== null;
                
                return (
                  <span style={{ 
                    color: isHidden ? 'var(--gray-300)' : (anyHovered && !isHovered ? 'var(--gray-400)' : 'var(--blue-800)'), 
                    fontWeight: isHidden ? 'normal' : (isHovered ? 900 : 600),
                    opacity: anyHovered && !isHovered ? 0.4 : 1,
                    transition: 'all 0.2s ease'
                  }}>
                    {value}
                  </span>
                );
              }}
            />
            
            {tickers.map((ticker, index) => {
              const isHovered = hoveredTicker === ticker;
              const anyHovered = hoveredTicker !== null;
              
              return (
                <Line 
                  key={ticker}
                  type="monotone" 
                  dataKey={ticker} 
                  name={ticker} 
                  stroke={CHART_PALETTE[index % CHART_PALETTE.length]} 
                  strokeWidth={isHovered ? 2.5 : 1} 
                  strokeOpacity={anyHovered ? (isHovered ? 1 : 0.15) : 1}
                  dot={false} 
                  activeDot={{ r: 6, strokeWidth: 0 }} 
                  connectNulls={true}
                  isAnimationActive={true}
                  hide={hiddenTickers.has(ticker)}
                  onMouseEnter={() => setHoveredTicker(ticker)}
                  onMouseLeave={() => setHoveredTicker(null)}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PortfolioVariationChart;
