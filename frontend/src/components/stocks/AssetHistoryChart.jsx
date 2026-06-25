import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  ComposedChart, Line, Area, Scatter, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { getAssetHistory } from '../../api/stocks';
import { TOOLTIP_STYLE } from '../../constants/chartTheme';
import { Loader2, AlertCircle, Clock } from 'lucide-react';

const RANGE_OPTIONS = [
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '6M', value: '6mo' },
  { label: 'YTD', value: 'ytd' },
  { label: '1Y', value: '1y' },
  { label: 'MAX', value: 'max' },
  { label: 'Desde Compra', value: 'since_entry' },
];

const AssetHistoryChart = ({ ticker }) => {
  const [timeRange, setTimeRange] = useState('1y');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['assetHistory', ticker, timeRange],
    queryFn: () => getAssetHistory(ticker, timeRange),
    enabled: !!ticker,
  });

  const chartData = useMemo(() => {
    if (!data?.history) return [];
    
    const { history, transactions } = data;
    return history.map(h => {
      const buyTx = transactions.find(t => t.date === h.date && t.type === 'buy');
      const sellTx = transactions.find(t => t.date === h.date && t.type === 'sell');
      const divTx = transactions.find(t => t.date === h.date && t.type === 'dividend');
      return {
        date: h.date,
        price: h.price,
        buyPrice: buyTx ? buyTx.price : null,
        buyQty: buyTx && buyTx.price > 0 ? buyTx.monto / buyTx.price : null,
        sellPrice: sellTx ? sellTx.price : null,
        sellQty: sellTx && sellTx.price > 0 ? sellTx.monto / sellTx.price : null,
        dividend: divTx ? divTx.monto : null,
        dividendPrice: divTx ? h.price : null, // Precio de mercado el día del dividendo
      };
    });
  }, [data]);

  if (isLoading) return (
    <div className="fm-card" style={{ padding: '32px', display: 'flex', justifyContent: 'center' }}>
      <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--blue-500)' }} />
    </div>
  );

  if (isError) return (
    <div className="fm-alert fm-alert--error">
      <AlertCircle size={16} style={{ flexShrink: 0 }} />
      Error loading history for {ticker}: {error.message}
    </div>
  );

  const { average_buy_price, current_price } = data;
  const price_diff_perc = average_buy_price > 0 ? (current_price - average_buy_price) / average_buy_price : 0;

  // Calculate range and offset for gradient
  const prices = chartData.map(d => d.price);
  const allValues = [...prices, average_buy_price].filter(v => v !== null && v !== undefined);
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const padding = (rawMax - rawMin) * 0.1 || (rawMax * 0.05) || 1;
  const yDomain = [rawMin - padding, rawMax + padding];
  
  const range = yDomain[1] - yDomain[0];
  const off = range === 0 ? 0.5 : (yDomain[1] - average_buy_price) / range;

  let avgLineColor = '#94A3B8'; // Gray default
  if (current_price < average_buy_price) avgLineColor = '#ef4444'; // Red-500
  if (current_price > average_buy_price) avgLineColor = '#22c55e'; // Green-500

  return (
    <div className="fm-card" style={{ padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
           <div style={{ fontSize: '2.25rem', fontWeight: 900, color: 'var(--blue-800)' }}>
             ${current_price.toFixed(2)}
           </div>
           <div style={{ 
             color: price_diff_perc >= 0 ? 'var(--green-500)' : 'var(--red-500)', 
             fontWeight: 'bold', fontSize: 'var(--font-size-sm)' 
           }}>
             {price_diff_perc >= 0 ? '+' : ''}{(price_diff_perc * 100).toFixed(2)}% vs Costo Promedio
           </div>
        </div>

        {/* Range Selector */}
        <div style={{ 
          display: 'flex', 
          backgroundColor: 'var(--gray-100)', 
          padding: '4px', 
          borderRadius: '12px',
          border: '1px solid var(--border-color)'
        }}>
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTimeRange(opt.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: timeRange === opt.value ? 'var(--white)' : 'transparent',
                color: timeRange === opt.value ? 'var(--blue-600)' : 'var(--gray-500)',
                boxShadow: timeRange === opt.value ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      
      <div style={{ height: 500, width: '100%', marginTop: '8px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
            <defs>
              {/* Stroke Gradient: Hard transition for the line */}
              <linearGradient id="lineColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset={off} stopColor="var(--green-500)" stopOpacity={1} />
                <stop offset={off} stopColor="var(--red-500)" stopOpacity={1} />
              </linearGradient>
              
              {/* Fill Gradient: Soft transition for the area */}
              <linearGradient id="fillColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset={off} stopColor="var(--green-500)" stopOpacity={0.10} />
                <stop offset={off} stopColor="var(--red-500)" stopOpacity={0.10} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EEF8" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 11, fill: 'var(--gray-400)' }} 
              tickMargin={12} 
              minTickGap={30} 
              axisLine={false}
              tickLine={false}
              tickFormatter={(date) => {
                const d = new Date(date);
                return d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
              }}
            />
            <YAxis 
              domain={yDomain} 
              tick={{ fontSize: 11, fill: 'var(--gray-400)' }} 
              tickFormatter={val => `$${val.toFixed(0)}`}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0]?.payload;
                if (!point) return null;
                const dateStr = new Date(label).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
                return (
                  <div className="asset-chart-tooltip">
                    <p className="asset-chart-tooltip__date">{dateStr}</p>
                    <div className="asset-chart-tooltip__row">
                      <span className="asset-chart-tooltip__dot asset-chart-tooltip__dot--market" />
                      <span className="asset-chart-tooltip__label">Precio Mercado</span>
                      <span className="asset-chart-tooltip__value">${point.price?.toFixed(2)}</span>
                    </div>
                    {point.buyPrice != null && (
                      <>
                        <div className="asset-chart-tooltip__row">
                          <span className="asset-chart-tooltip__dot asset-chart-tooltip__dot--buy" />
                          <span className="asset-chart-tooltip__label">Precio de Compra</span>
                          <span className="asset-chart-tooltip__value">${point.buyPrice.toFixed(2)}</span>
                        </div>
                        {point.buyQty != null && (
                          <div className="asset-chart-tooltip__row asset-chart-tooltip__row--detail">
                            <span className="asset-chart-tooltip__label">Cantidad Comprada</span>
                            <span className="asset-chart-tooltip__value asset-chart-tooltip__value--qty">
                              {point.buyQty.toFixed(4)} acciones
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    {point.sellPrice != null && (
                      <>
                        <div className="asset-chart-tooltip__row">
                          <span className="asset-chart-tooltip__dot asset-chart-tooltip__dot--sell" />
                          <span className="asset-chart-tooltip__label">Precio de Venta</span>
                          <span className="asset-chart-tooltip__value">${point.sellPrice.toFixed(2)}</span>
                        </div>
                        {point.sellQty != null && (
                          <div className="asset-chart-tooltip__row asset-chart-tooltip__row--detail">
                            <span className="asset-chart-tooltip__label">Cantidad Vendida</span>
                            <span className="asset-chart-tooltip__value asset-chart-tooltip__value--qty">
                              {point.sellQty.toFixed(4)} acciones
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    {point.dividend != null && (
                      <div className="asset-chart-tooltip__row asset-chart-tooltip__row--detail">
                        <span className="asset-chart-tooltip__dot asset-chart-tooltip__dot--dividend" />
                        <span className="asset-chart-tooltip__label">Dividendo</span>
                        <span className="asset-chart-tooltip__value">${point.dividend.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            
            <ReferenceLine 
              y={average_buy_price} 
              stroke={avgLineColor} 
              strokeDasharray="4 4" 
              label={{ 
                position: 'top', 
                value: `Costo Avg $${average_buy_price.toFixed(2)}`, 
                fill: avgLineColor, 
                fontSize: 11, 
                fontWeight: 'bold' 
              }} 
            />
            
            <Area 
              type="monotone" 
              dataKey="price" 
              stroke="none" 
              fill="url(#fillColor)" 
              baseLine={yDomain[0]}
              isAnimationActive={true}
              tooltipType="none"
              legendType="none"
              connectNulls
            />
            <Line 
              type="monotone" 
              dataKey="price" 
              name="Precio Mercado" 
              stroke="url(#lineColor)" 
              strokeWidth={1} 
              dot={false} 
              activeDot={{ r: 6, strokeWidth: 0 }} 
            />
            <Scatter 
              dataKey="buyPrice" 
              name="Compra" 
              fill="var(--green-500)" 
              shape="circle" 
              isAnimationActive={false}
            />
            <Scatter 
              dataKey="sellPrice" 
              name="Venta" 
              fill="var(--red-500)" 
              shape="wye" 
              isAnimationActive={false}
            />
            <Scatter 
              dataKey="dividendPrice" 
              name="Dividendo" 
              fill="var(--amber-500)" 
              shape="circle" 
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AssetHistoryChart;
