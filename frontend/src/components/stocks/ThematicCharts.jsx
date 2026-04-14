import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CHART_PALETTE, TOOLTIP_STYLE } from '../../constants/chartTheme';

const ThematicCharts = ({ assets }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  
  const distributions = [
    { key: 'strategy', title: 'ESTRATEGIA' },
    { key: 'focus', title: 'TAMAÑO' },
    { key: 'niche', title: 'ESTILO' },
    { key: 'region', title: 'REGIÓN' }
  ];

  const activeItem = distributions[activeIndex];

  const getAggregation = (key) => {
    const agg = {};
    assets.forEach(a => {
      let val;
      if (key === 'strategy') {
        val = a.classification || 'N/A';
      } else {
        val = a.thematic[key] || 'N/A';
      }
      agg[val] = (agg[val] || 0) + a.weight;
    });
    return Object.keys(agg).map(label => ({
      name: label,
      value: agg[label]
    })).sort((a, b) => b.value - a.value);
  };

  const chartData = getAggregation(activeItem.key);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ ...TOOLTIP_STYLE, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontWeight: 700, color: 'var(--blue-800)' }}>{payload[0].name}</span>
          <span style={{ color: 'var(--gray-600)' }}>{(payload[0].value * 100).toFixed(1)}%</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Selector Horizontal Centrado */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
        <div style={{ 
          padding: '6px', 
          borderRadius: '96px', 
          display: 'flex', 
          backgroundColor: 'rgba(29, 53, 87, 0.04)',
          border: '1px solid #eee',
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          {distributions.map((item, index) => (
            <div 
              key={index}
              onClick={() => setActiveIndex(index)}
              style={{ 
                padding: '10px 32px', 
                borderRadius: '80px',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                backgroundColor: activeIndex === index ? 'var(--blue-800)' : 'transparent',
                color: activeIndex === index ? '#fff' : 'var(--blue-800)',
                fontWeight: '900',
                fontSize: '0.75rem',
                letterSpacing: 1.5,
                textAlign: 'center',
                boxShadow: activeIndex === index ? '0 6px 15px rgba(29, 53, 87, 0.3)' : 'none'
              }}
            >
              {item.title}
            </div>
          ))}
        </div>
      </div>

      {/* Detalle de Gráfico Full Width */}
      <div className="fm-card" style={{ padding: '32px' }}>
        <h5 style={{ 
          fontWeight: '900', 
          color: 'var(--blue-800)', 
          textAlign: 'center',
          marginBottom: '32px',
          textTransform: 'uppercase',
          letterSpacing: 4,
          fontSize: '1.25rem'
        }}>
          {activeItem.title}
        </h5>
        
        <div style={{ 
          width: '100%', 
          height: 380,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative'
        }}>
          {/* Centered label character */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '1.5rem',
            fontWeight: 'bold',
            color: 'var(--blue-800)',
            pointerEvents: 'none'
          }}>
            {activeItem.title.substring(0, 1)}
          </div>
          
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={120}
                paddingAngle={2}
                dataKey="value"
                label={({ cx, cy, midAngle, innerRadius, outerRadius, value, index }) => {
                  const RADIAN = Math.PI / 180;
                  const radius = outerRadius * 1.35;
                  const x = cx + radius * Math.cos(-midAngle * RADIAN);
                  const y = cy + radius * Math.sin(-midAngle * RADIAN);
                  
                  if (!chartData[index]) return null;
                  return (
                    <text 
                      x={x} 
                      y={y} 
                      fill="#666" 
                      textAnchor={x > cx ? 'start' : 'end'} 
                      dominantBaseline="central"
                      style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-family)' }}
                    >
                      {`${chartData[index].name} ${(value * 100).toFixed(1)}%`}
                    </text>
                  );
                }}
              >
                {chartData.map((entry, index) => {
                  let color = CHART_PALETTE[index % CHART_PALETTE.length];
                  return <Cell key={`cell-${index}`} fill={color} />;
                })}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default ThematicCharts;
