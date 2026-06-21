import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getHoldings } from '../api/holdings';
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ChartTooltip, Legend, LabelList,
  PieChart, Pie, Cell
} from 'recharts';
import { Loader2 } from 'lucide-react';
import { CHART_PALETTE, SELECTOR_STYLES, CURRENCY_COLORS, TOOLTIP_STYLE } from '../constants/chartTheme';

/* ── Helpers ───────────────────────────────────── */
const fmtCurrency = (v, currencyCode = 'DOP') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode, minimumFractionDigits: 0 }).format(v);
const fmtCompact = (v) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

const fallbackColor = (i) => CHART_PALETTE[i % CHART_PALETTE.length];

/* ── Category Explorer ────────────────────────────── */
const CategoryExplorer = ({ distributions }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeItem = distributions[activeIndex];
  const filteredData = activeItem.data.filter(d => d.total_valor > 0);

  const pieData = filteredData.map(d => ({
    name: d.nombre,
    value: d.total_valor
  })).sort((a, b) => b.value - a.value);

  const totalValue = pieData.reduce((sum, item) => sum + item.value, 0);

  const CustomPieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ ...TOOLTIP_STYLE, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontWeight: 700, color: 'var(--blue-800)' }}>{payload[0].name}</span>
          <span style={{ color: 'var(--gray-600)', fontWeight: 600 }}>
            {fmtCurrency(payload[0].value)} ({(payload[0].value / totalValue * 100).toFixed(1)}%)
          </span>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      {/* Tab Pills */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
        <div style={SELECTOR_STYLES.container}>
          {distributions.map((item, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              style={SELECTOR_STYLES.button(activeIndex === idx)}
            >
              {item.title}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Card */}
      <div className="fm-card" style={{ padding: '32px' }}>
        <h3 style={{
          textAlign: 'center', fontSize: 'var(--font-size-sm)', fontWeight: 700,
          color: 'var(--blue-800)', textTransform: 'uppercase', letterSpacing: '0.1em',
          marginBottom: '24px',
        }}>
          {activeItem.title}
        </h3>
        
        <div style={{ width: '100%', height: 380, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
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
                data={pieData}
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
                  const percent = (value / totalValue * 100).toFixed(1);
                  if (!pieData[index]) return null;
                  return (
                    <text 
                      x={x} 
                      y={y} 
                      fill="var(--gray-600)" 
                      textAnchor={x > cx ? 'start' : 'end'} 
                      dominantBaseline="central"
                      style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-family)' }}
                    >
                      {`${pieData[index].name} ${percent}%`}
                    </text>
                  );
                }}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                ))}
              </Pie>
              <ChartTooltip content={<CustomPieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

/* ── Renta Variable Tooltip ──────────────────────── */
const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ ...TOOLTIP_STYLE, display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <p style={{ fontWeight: 700, color: 'var(--blue-800)', marginBottom: 6 }}>{label}</p>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', gap: 8, marginBottom: 3, alignItems: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: p.fill }} />
          <span style={{ color: 'var(--gray-600)', fontSize: '13px' }}>{p.name}:</span>
          <span style={{ fontWeight: 700, fontSize: '13px' }}>{(p.value * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
};

/* ── Main Page ────────────────────────────────────── */
const PortfolioHoldings = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['holdings'],
    queryFn: getHoldings,
  });

  const [rebalanceMode, setRebalanceMode] = useState('compra-excedente'); // 'total', 'compra-total', 'compra-excedente'

  if (isLoading) return (
    <div className="fm-spinner empty-panel">
      <Loader2 size={40} style={{ animation: 'spin 1s linear infinite', color: 'var(--blue-500)' }} />
    </div>
  );

  // ─── Simulador de Rebalanceo de Renta Variable ───
  // Obtener la tasa de cambio USD/DOP a partir de la distribución de monedas
  const usdMoneda = data?.distribucion_moneda?.find(m => m.nombre === 'USD');
  const usdRate = (usdMoneda && usdMoneda.total_valor_nominal > 0)
    ? (usdMoneda.total_valor / usdMoneda.total_valor_nominal)
    : 58.0;

  const totalRVDOP = data?.distribucion_clase?.find(c => c.nombre?.toLowerCase() === 'renta variable')?.total_valor || 0;
  const totalRV = totalRVDOP / usdRate; // Convertimos todo el total de Renta Variable a USD
  
  // Encontrar el instrumento de Cash / Equivalents
  const cashInstrument = data?.renta_variable?.find(item => item.instrumento === 'Cash / Equivalents');
  const cashTargetWeight = cashInstrument?.meta_objetivo || 0.05;
  const cashActualWeight = cashInstrument?.valor_actual || 0.0;
  const cashActualValue = totalRV * cashActualWeight;

  // Lógica de simulación
  let simulatedAssets = [];
  if (data?.renta_variable) {
    const rawAssets = data.renta_variable;
    
    // Determinar efectivo a distribuir
    let cashToSpend = 0;
    if (rebalanceMode === 'compra-total') {
      cashToSpend = cashActualValue;
    } else if (rebalanceMode === 'compra-excedente') {
      cashToSpend = Math.max(0, cashActualValue - totalRV * cashTargetWeight);
    }

    if (rebalanceMode === 'total') {
      // Rebalanceo Total: Compras y Ventas. El efectivo queda exactamente en su meta_objetivo.
      simulatedAssets = rawAssets.map(item => {
        const targetWeight = item.meta_objetivo;
        const targetValue = totalRV * targetWeight;
        const currentValue = totalRV * item.valor_actual;
        const deltaValue = targetValue - currentValue;
        
        return {
          instrumento: item.instrumento,
          valorActual: currentValue,
          pesoActual: item.valor_actual,
          deltaValue: deltaValue,
          pesoProyectado: targetWeight,
          pesoMeta: targetWeight
        };
      });
    } else {
      // Modos Solo Compra: 'compra-total' o 'compra-excedente'
      // 1. Definir pesos objetivos de referencia
      let refTargetWeights = {};
      if (rebalanceMode === 'compra-total') {
        // Cash queda en 0. Los demás activos se escalan para sumar 1.
        rawAssets.forEach(item => {
          if (item.instrumento === 'Cash / Equivalents') {
            refTargetWeights[item.instrumento] = 0;
          } else {
            refTargetWeights[item.instrumento] = item.meta_objetivo / (1 - cashTargetWeight);
          }
        });
      } else {
        // Cash queda en su peso meta original. Los demás activos en sus pesos metas originales.
        rawAssets.forEach(item => {
          refTargetWeights[item.instrumento] = item.meta_objetivo;
        });
      }

      // 2. Calcular déficits para los activos que no son Cash / Equivalents
      const deficits = [];
      let totalDeficit = 0;
      rawAssets.forEach(item => {
        if (item.instrumento !== 'Cash / Equivalents') {
          const targetValue = totalRV * refTargetWeights[item.instrumento];
          const currentValue = totalRV * item.valor_actual;
          const deficit = Math.max(0, targetValue - currentValue);
          deficits.push({ instrumento: item.instrumento, currentValue, targetValue, deficit, refWeight: refTargetWeights[item.instrumento] });
          totalDeficit += deficit;
        }
      });

      // 3. Distribuir el efectivo (water-filling/proportional-deficit)
      const allocations = {};
      if (cashToSpend < totalDeficit) {
        // Caja insuficiente, distribuir proporcional al déficit
        deficits.forEach(d => {
          allocations[d.instrumento] = totalDeficit > 0 ? cashToSpend * (d.deficit / totalDeficit) : 0;
        });
      } else {
        // Caja suficiente, cubrir todo el déficit
        const remainingCash = cashToSpend - totalDeficit;
        deficits.forEach(d => {
          // El remanente se distribuye proporcional a los pesos meta proyectados
          const scaleFactor = rebalanceMode === 'compra-total' ? 1 : (1 - cashTargetWeight);
          const weightFactor = d.refWeight / scaleFactor;
          allocations[d.instrumento] = d.deficit + remainingCash * weightFactor;
        });
      }

      // 4. Crear los registros proyectados
      simulatedAssets = rawAssets.map(item => {
        const currentValue = totalRV * item.valor_actual;
        if (item.instrumento === 'Cash / Equivalents') {
          const projectedValue = cashActualValue - cashToSpend;
          const projectedWeight = projectedValue / totalRV;
          return {
            instrumento: item.instrumento,
            valorActual: currentValue,
            pesoActual: item.valor_actual,
            deltaValue: -cashToSpend,
            pesoProyectado: projectedWeight,
            pesoMeta: item.meta_objetivo
          };
        } else {
          const alloc = allocations[item.instrumento] || 0;
          const projectedValue = currentValue + alloc;
          const projectedWeight = projectedValue / totalRV;
          return {
            instrumento: item.instrumento,
            valorActual: currentValue,
            pesoActual: item.valor_actual,
            deltaValue: alloc,
            pesoProyectado: projectedWeight,
            pesoMeta: item.meta_objetivo
          };
        }
      });
    }
  }

  // Filtrar activos que necesiten ser rebalanceados (umbral de transacción > $0.01 DOP) y ordenar por monto absoluto de transacción
  const filteredSimulatedAssets = simulatedAssets
    .filter(item => Math.abs(item.deltaValue) >= 0.01)
    .sort((a, b) => Math.abs(b.deltaValue) - Math.abs(a.deltaValue));
  
  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 20px' }}>
      {/* ── Header ──────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Tenencias del Portafolio
          </h1>
          <p className="page-subtitle">
            Distribución y análisis detallado de activos — valores ajustados a moneda base
          </p>
        </div>
      </div>

      {/* ── KPI Total Cards ──────────────────────── */}
      <div className="section-spacing" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {data.distribucion_moneda.map((item, i) => {
          const color = CURRENCY_COLORS[item.nombre]?.area || fallbackColor(i);
          return (
            <div key={item.nombre} className="fm-card fm-card--accent"
              style={{ borderLeftColor: color }}>
              <p className="kpi-label">Total aprox. ({item.nombre})</p>
              <p className="kpi-value" style={{ color: 'var(--blue-800)' }}>
                {fmtCurrency(item.total_valor_nominal || item.total_valor, item.nombre)}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Dashboard Explorer (Pie Charts) ──────── */}
      <div className="section-spacing">
        <CategoryExplorer
          distributions={[
            { data: data.distribucion_moneda,     title: 'Divisa' },
            { data: data.distribucion_institucion, title: 'Entidad Financiera' },
            { data: data.distribucion_plazo,       title: 'Plazo' },
            { data: data.distribucion_clase,       title: 'Clase de Activo' },
          ]}
        />
      </div>

      {/* ── Hierarchical Panels (Composition by Class) ── */}
      <div className="section-spacing">
        <h2 className="section-title" style={{ margin: '0 0 24px 0' }}>
          Composición por Clase
        </h2>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
          gap: '24px' 
        }}>
          {[...data.treemap_data]
            .sort((a, b) => b.value - a.value)
            .map((clase, idx) => {
              const accentColor = CHART_PALETTE[idx % CHART_PALETTE.length];
              return (
                <div key={clase.name} className="fm-card" style={{
                  padding: 0, overflow: 'hidden',
                  borderTop: `3px solid ${accentColor}`,
                  width: '100%'
                }}>
                  {/* Class Header */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px 20px', background: `${accentColor}08`,
                    borderBottom: '1px solid var(--border-color)',
                  }}>
                    <p style={{ fontWeight: 800, color: 'var(--blue-800)', fontSize: 'var(--font-size-base)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {clase.name}
                    </p>
                    <p style={{ fontWeight: 800, color: accentColor, fontSize: 'var(--font-size-md)' }}>
                      {fmtCurrency(clase.value)}
                    </p>
                  </div>

                  {/* Subclasses */}
                  <div style={{ padding: '16px 20px' }}>
                    {clase.children.map((subclase) => {
                      const grouped = Object.values(
                        subclase.children.reduce((acc, inst) => {
                          acc[inst.name] = acc[inst.name]
                            ? { ...acc[inst.name], value: acc[inst.name].value + inst.value }
                            : { ...inst };
                          return acc;
                        }, {})
                      ).sort((a, b) => b.value - a.value);

                      return (
                        <div key={subclase.name} style={{ marginBottom: '20px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              {subclase.name}
                            </p>
                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-400)', fontWeight: 600 }}>
                              {((subclase.value / clase.value) * 100).toFixed(1)}%
                            </p>
                          </div>
                          {grouped.map((inst) => (
                            <div key={inst.name} style={{ marginBottom: '10px', paddingLeft: '12px', borderLeft: `2px solid ${accentColor}30` }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--gray-800)' }}>{inst.name}</p>
                                <div style={{ textAlign: 'right' }}>
                                  <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--blue-800)' }}>
                                    {fmtCompact(inst.value)}
                                  </p>
                                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-400)', fontWeight: 600 }}>
                                    {((inst.value / clase.value) * 100).toFixed(1)}%
                                  </p>
                                </div>
                              </div>
                              <div style={{ height: '6px', borderRadius: '3px', background: 'var(--gray-100)', overflow: 'hidden' }}>
                                <div style={{
                                  height: '100%', borderRadius: '3px',
                                  width: `${Math.min((inst.value / clase.value) * 100, 100)}%`,
                                  background: accentColor,
                                  transition: 'width 0.6s ease',
                                }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* ── Renta Variable Bar Chart ─────────────── */}
      <div className="fm-card section-spacing">
        <h3 className="section-title" style={{ fontSize: 'var(--font-size-md)', marginBottom: '20px' }}>
          Renta Variable — Meta vs. Actual
        </h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart 
            data={[...data.renta_variable].sort((a, b) => b.meta_objetivo - a.meta_objetivo)} 
            margin={{ top: 16, right: 20, left: 0, bottom: 16 }}
            barGap={6}
            barCategoryGap="10%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_PALETTE[9]} vertical={false} />
            <XAxis 
              dataKey="instrumento" 
              interval={0} 
              tick={{ fontSize: 10,  fontFamily: 'var(--font-family)', fill: 'var(--gray-600)', dy: 15 }} 
              textAnchor="end" 
              angle={-10} 
              height={80} 
              axisLine={false} 
              tickLine={false} 
            />
            <YAxis tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 12, fontFamily: 'var(--font-family)' }} axisLine={false} tickLine={false} width={44} />
            <ChartTooltip content={<BarTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'var(--font-family)', fontWeight: 600, paddingTop: 12 }} iconType="circle" iconSize={8} />
            <Bar dataKey="meta_objetivo" name="Meta" fill={CHART_PALETTE[9]} radius={[4, 4, 0, 0]}>
              <LabelList dataKey="meta_objetivo" position="top" formatter={v => `${(v * 100).toFixed(1)}%`}
                style={{ fontSize: 11, fill: 'var(--gray-400)', fontWeight: 700, fontFamily: 'var(--font-family)' }} />
            </Bar>
            <Bar dataKey="valor_actual" name="Actual" fill={CHART_PALETTE[0]} radius={[4, 4, 0, 0]}>
              <LabelList dataKey="valor_actual" position="top" formatter={v => `${(v * 100).toFixed(1)}%`}
                style={{ fontSize: 11, fill: CHART_PALETTE[0], fontWeight: 800, fontFamily: 'var(--font-family)' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Simulador de Rebalanceo de Renta Variable ── */}
      <div className="fm-card section-spacing">
        <div className="rebalance-panel-header">
          <h3 className="section-title">Simulador de Rebalanceo — Renta Variable</h3>
          
          <div className="rebalance-selector-container">
            <button
              onClick={() => setRebalanceMode('compra-excedente')}
              className={`rebalance-selector-btn ${rebalanceMode === 'compra-excedente' ? 'rebalance-selector-btn--active' : ''}`}
            >
              Solo Compra (Excedente)
            </button>
            <button
              onClick={() => setRebalanceMode('compra-total')}
              className={`rebalance-selector-btn ${rebalanceMode === 'compra-total' ? 'rebalance-selector-btn--active' : ''}`}
            >
              Solo Compra (Todo el Cash)
            </button>
            <button
              onClick={() => setRebalanceMode('total')}
              className={`rebalance-selector-btn ${rebalanceMode === 'total' ? 'rebalance-selector-btn--active' : ''}`}
            >
              Rebalanceo Total
            </button>
          </div>
        </div>

        {/* Info Banner explaining the selected mode */}
        <div className="rebalance-info-card animate-fade-in">
          {rebalanceMode === 'compra-excedente' && (
            <p>
              <strong>Modalidad: Solo Compra (Efectivo Excedente).</strong> Se utiliza únicamente el efectivo de
              {' '}<code>Cash / Equivalents</code> que supera su peso meta de <strong>{(cashTargetWeight * 100).toFixed(1)}%</strong>
              {' '} (equivalente a <strong>{fmtCurrency(totalRV * cashTargetWeight, 'USD')}</strong> de reserva mínima).
              Se compra proporcionalmente los activos subponderados sin vender ningún activo.
              Efectivo a distribuir: <strong>{fmtCurrency(Math.max(0, cashActualValue - totalRV * cashTargetWeight), 'USD')}</strong>.
            </p>
          )}
          {rebalanceMode === 'compra-total' && (
            <p>
              <strong>Modalidad: Solo Compra (Todo el Cash).</strong> Se distribuye la totalidad del efectivo disponible
              {' '}en <code>Cash / Equivalents</code> (<strong>{fmtCurrency(cashActualValue, 'USD')}</strong>)
              para comprar proporcionalmente los activos subponderados sin vender ningún activo. El peso proyectado de caja será <strong>0.0%</strong>.
            </p>
          )}
          {rebalanceMode === 'total' && (
            <p>
              <strong>Modalidad: Rebalanceo Total.</strong> Ajuste institucional completo.
              Se venden los activos sobreponderados y se compran los subponderados.
              La reserva de <code>Cash / Equivalents</code> se ajusta exactamente a su peso meta de <strong>{(cashTargetWeight * 100).toFixed(1)}%</strong>
              {' '} (<strong>{fmtCurrency(totalRV * cashTargetWeight, 'USD')}</strong>).
            </p>
          )}
        </div>

        {/* Simulación Table */}
        {filteredSimulatedAssets.length > 0 ? (
          <div className="rebalance-table-container animate-fade-in">
            <table className="rebalance-table">
              <thead>
                <tr>
                  <th>Activo</th>
                  <th className="col-right">Valor Actual</th>
                  <th className="col-right">Peso Actual (%)</th>
                  <th className="col-center">Transacción Sugerida</th>
                  <th className="col-right">Peso Proyectado (%)</th>
                </tr>
              </thead>
              <tbody>
                {filteredSimulatedAssets.map((item) => {
                  const isBuy = item.deltaValue > 0.01;
                  const isSell = item.deltaValue < -0.01;
                  return (
                    <tr key={item.instrumento}>
                      <td className="fw-semibold">{item.instrumento}</td>
                      <td className="col-right">{fmtCurrency(item.valorActual, 'USD')}</td>
                      <td className="col-right">{(item.pesoActual * 100).toFixed(2)}%</td>
                      <td className="col-center">
                        {isBuy && (
                          <span className="badge-transaction badge-transaction--buy">
                            Compra: +{fmtCurrency(item.deltaValue, 'USD')}
                          </span>
                        )}
                        {isSell && (
                          <span className="badge-transaction badge-transaction--sell">
                            Venta: -{fmtCurrency(Math.abs(item.deltaValue), 'USD')}
                          </span>
                        )}
                      </td>
                      <td className={`col-right fw-bold ${Math.abs(item.pesoProyectado - item.pesoMeta) <= 0.01 ? 'text-positive' : 'text-primary'}`}>
                        {(item.pesoProyectado * 100).toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>El portafolio se encuentra completamente al día con los pesos meta para esta modalidad.</p>
          </div>
        )}

        {/* Simulación Summary Footer */}
        <div className="rebalance-summary">
          <div className="rebalance-summary-item">
            <span className="rebalance-summary-label">Total Sub-portafolio RV:</span>
            <span>{fmtCurrency(totalRV, 'USD')}</span>
          </div>
          <div className="rebalance-summary-item">
            <span className="rebalance-summary-label">Efectivo Post-Rebalanceo:</span>
            <span>
              {fmtCurrency(
                (simulatedAssets.find(item => item.instrumento === 'Cash / Equivalents')?.pesoProyectado || 0) * totalRV,
                'USD'
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortfolioHoldings;
