import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Calculator, TrendingUp, DollarSign, Percent, Calendar, AlertCircle, Loader2, AlertTriangle, Info } from 'lucide-react';
import { getActiveInstruments, calculatePerformance } from '../api/performance';

/* ─────────────────────────────────────────────
   Sub-components
   ───────────────────────────────────────────── */

/** KPI card with white background and left accent border */
const KpiCard = ({ label, value, sub, badge, accentClass = 'fm-card--accent' }) => (
  <div className={`fm-card ${accentClass}`} style={{ flex: 1 }}>
    <p className="kpi-label">{label}</p>
    <p className="kpi-value">{value}</p>
    {badge && (
      <span className={`kpi-badge kpi-badge--${badge.type}`}>
        {badge.icon} {badge.text}
      </span>
    )}
    {sub && <p className="kpi-sub" style={{ marginTop: 8 }}>{sub}</p>}
  </div>
);

/** Metric mini-block for risk card */
const MetricBlock = ({ label, value, colorClass }) => (
  <div className="metric-item">
    <p className="metric-label">{label}</p>
    <p className={`metric-value ${colorClass}`}>{value}</p>
  </div>
);

/** Currency formatter */
const fmt = (amount, currency = 'DOP') =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);

/** Determine badge class from numeric value */
const numBadge = (v) => (parseFloat(v) >= 0 ? 'kpi-badge--up' : 'kpi-badge--down');

/* ─────────────────────────────────────────────
   Main Page
   ───────────────────────────────────────────── */
const Performance = () => {
  const [selectedInstrument, setSelectedInstrument] = useState(null);
  const [year,      setYear]      = useState(new Date().getFullYear());
  const [month,     setMonth]     = useState(new Date().getMonth()); // 0-indexed in UI
  const [unitPrice, setUnitPrice] = useState('');
  const [results,   setResults]   = useState(null);

  const { data: instruments, isLoading: loadingInstruments } = useQuery({
    queryKey: ['activeInstruments'],
    queryFn: getActiveInstruments,
  });

  const mutation = useMutation({
    mutationFn: calculatePerformance,
    onSuccess: (data) => {
      setResults(data.results);
      if (data.calculated_price) setUnitPrice(data.calculated_price.toString());
    },
  });

  const handleCalculate = () => {
    if (!selectedInstrument) return;
    mutation.mutate({
      year,
      month: month + 1,
      instrument_id: selectedInstrument.id,
      dividend_period_months: selectedInstrument.meses_dividendo || 12,
      manual_price: unitPrice ? parseFloat(unitPrice) : null,
    });
  };

  const years  = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const months = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
  ];
  const currentYear  = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  if (loadingInstruments) {
    return (
      <div className="fm-spinner">
        <Loader2 size={36} className="text-primary" style={{ animation: 'spin 1s linear infinite', color: 'var(--blue-500)' }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px' }}>
      {/* ── Page Header ───────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--blue-800)', marginBottom: 4 }}>
          Cálculo de Rentabilidad
        </h1>
        <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--gray-400)', fontWeight: 400 }}>
          Atribución de resultados mediante el Método Dietz Modificado
        </p>
      </div>

      {/* ── Main Grid ─────────────────────────── */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

        {/* ── LEFT: Input Panel ─────────────── */}
        <div className="fm-card" style={{ width: 340, minWidth: 300, flexShrink: 0 }}>
          <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--gray-800)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calculator size={18} color="var(--blue-500)" strokeWidth={2} />
            Parámetros de Entrada
          </h2>

          {/* Instrumento */}
          <div className="fm-form-group">
            <label className="fm-label">Instrumento</label>
            <div className="fm-select-wrapper">
              <select
                className="fm-select"
                value={selectedInstrument ? selectedInstrument.id : ''}
                onChange={(e) => {
                  console.log('Instrument change triggered', e.target.value);
                  const inst = instruments?.find(i => i.id === parseInt(e.target.value));
                  setSelectedInstrument(inst || null);
                  setResults(null);
                  setUnitPrice('');
                  mutation.reset();
                }}
              >
                <option value="">Seleccione un instrumento…</option>
                {instruments?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre} ({item.institucion}) — {item.moneda}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Año / Mes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div>
              <label className="fm-label">Año</label>
              <div className="fm-select-wrapper">
                <select className="fm-select" value={year} onChange={(e) => {
                  setYear(parseInt(e.target.value));
                  setUnitPrice('');
                  setResults(null);
                  mutation.reset();
                }}>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="fm-label">Mes</label>
              <div className="fm-select-wrapper">
                <select className="fm-select" value={month} onChange={(e) => {
                  setMonth(parseInt(e.target.value));
                  setUnitPrice('');
                  setResults(null);
                  mutation.reset();
                }}>
                  {months.map((m, i) => {
                    const isFuture = year === currentYear && i > currentMonth;
                    return (
                      <option key={i} value={i} disabled={isFuture}>{m}</option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          {/* Info fields (read-only) */}
          <div className="fm-form-group">
            <label className="fm-label">Período de Dividendos (Meses)</label>
            <input
              className="fm-input"
              value={selectedInstrument ? selectedInstrument.meses_dividendo || '12 (Anual)' : '—'}
              disabled
              readOnly
            />
          </div>

          <div className="fm-form-group">
            <label className="fm-label">Cantidad de Cuotas</label>
            <input
              className="fm-input"
              value={selectedInstrument ? selectedInstrument.cuotas_participacion : '—'}
              disabled
              readOnly
            />
          </div>

          {/* Precio */}
          <div className="fm-form-group">
            <label className="fm-label">Precio de Cuota al Cierre ({selectedInstrument?.moneda || '—'})</label>
            <div style={{ position: 'relative' }}>
              <DollarSign size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
              <input
                className="fm-input"
                style={{ paddingLeft: 32 }}
                type="number"
                step="any"
                placeholder={
                  selectedInstrument?.sub_clase?.includes('Activos /')
                    ? 'Opcional — se buscará en Yahoo Finance'
                    : 'Ingrese el precio de la cuota'
                }
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </div>
            {mutation.data?.price_date && (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-400)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 4 }}>
                <Calendar size={12} strokeWidth={2} />
                <span>Precio al cierre del {new Date(mutation.data.price_date + 'T12:00:00').toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
              </div>
            )}
          </div>
          
          {mutation.data?.dividend_info?.has_dividend && (
            <div 
              style={{ 
                marginTop: 12, 
                display: 'flex', 
                gap: 10, 
                alignItems: 'flex-start', 
                background: mutation.data.dividend_info.is_registered ? '#f0f9ff' : '#fffbeb', 
                border: `1px solid ${mutation.data.dividend_info.is_registered ? '#bae6fd' : '#fef3c7'}`, 
                color: mutation.data.dividend_info.is_registered ? '#0369a1' : '#92400e', 
                borderRadius: 8, 
                padding: '10px 12px' 
              }}
            >
              {mutation.data.dividend_info.is_registered ? <Info size={16} /> : <AlertTriangle size={16} />}
              <div style={{ fontSize: 'var(--font-size-xs)', lineHeight: 1.4 }}>
                <strong style={{ display: 'block', marginBottom: 2 }}>
                  {mutation.data.dividend_info.is_registered ? 'Dividendo Confirmado:' : '¡Alerta! Dividendo no registrado:'}
                </strong>
                {mutation.data.dividend_info.events.map((ev, idx) => (
                  <div key={idx}>
                    Fecha: {new Date(ev.date + 'T12:00:00').toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' })} — Monto: {ev.amount.toFixed(6)} por acción
                  </div>
                ))}
                {!mutation.data.dividend_info.is_registered && (
                  <p style={{ marginTop: 4, fontWeight: 500 }}>No se encontraron registros de cobro en el sistema para este periodo.</p>
                )}
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            className="fm-btn fm-btn--primary fm-btn--lg"
            onClick={handleCalculate}
            disabled={!selectedInstrument || mutation.isPending}
          >
            {mutation.isPending
              ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Calculando…</>
              : <><TrendingUp size={16} /> Calcular Rendimiento</>
            }
          </button>

          {/* Error */}
          {mutation.isError && (
            <div className="fm-alert fm-alert--error">
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{mutation.error?.response?.data?.detail || 'Ocurrió un error en el cálculo.'}</span>
            </div>
          )}
        </div>

        {/* ── RIGHT: Results ────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {results ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* ── Section header ─────────────── */}
              <div>
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--blue-800)', marginBottom: 2 }}>
                  Atribución de Resultados
                </h2>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--gray-400)' }}>
                  {months[month]} {year} — {selectedInstrument?.nombre}
                </p>
              </div>

              {/* ── KPI Cards Row ──────────────── */}
              <div style={{ display: 'flex', gap: 16 }}>
                <KpiCard
                  label="ROI Mensual"
                  value={`${parseFloat(results.roi_mensual).toFixed(2)}%`}
                  sub="Eficiencia del período"
                  badge={{ type: parseFloat(results.roi_mensual) >= 0 ? 'up' : 'down', icon: '↑', text: 'vs. mes anterior' }}
                  accentClass="fm-card--accent"
                />
                <KpiCard
                  label="TEA"
                  value={`${parseFloat(results.tea).toFixed(2)}%`}
                  sub="Retorno Anualizado"
                  badge={{ type: 'neutral', text: 'Dietz Modificado' }}
                  accentClass="fm-card--accent-cyan"
                />
                <KpiCard
                  label="Div. Yield Anualizado"
                  value={`${parseFloat(results.div_yield_ann).toFixed(2)}%`}
                  sub="Renta por dividendos"
                  badge={{ type: parseFloat(results.div_yield_ann) >= 0 ? 'up' : 'neutral', icon: '↑', text: 'Flujo recibido' }}
                  accentClass="fm-card--accent-amber"
                />
              </div>

              {/* ── Attribution Table ──────────── */}
              <div className="fm-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)' }}>
                  <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--gray-800)' }}>
                    Detalle de Atribución
                  </h3>
                </div>
                <table className="fm-table">
                  <thead>
                    <tr>
                      <th>Concepto</th>
                      <th style={{ textAlign: 'right' }}>Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Capital Inicial</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {fmt(results.capital_inicial, selectedInstrument?.moneda)}
                      </td>
                    </tr>
                    <tr>
                      <td>Flujos Netos <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-400)', fontWeight: 400 }}>(Aportes - Retiros)</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {fmt(results.flujos_netos, selectedInstrument?.moneda)}
                      </td>
                    </tr>
                    <tr>
                      <td>Dividendos Recibidos</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {fmt(results.dividendos_recibidos, selectedInstrument?.moneda)}
                      </td>
                    </tr>
                    <tr className="row-highlight">
                      <td style={{ fontWeight: 800, color: 'var(--blue-800)' }}>CAPITAL FINAL</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--blue-800)' }}>
                        {fmt(results.capital_final, selectedInstrument?.moneda)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ paddingTop: 16, paddingBottom: 4 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          Ganancia de Capital
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, paddingTop: 16, paddingBottom: 4 }}>
                        <span className={results.ganancia_capital >= 0 ? 'text-positive' : 'text-negative'}>
                          {fmt(results.ganancia_capital, selectedInstrument?.moneda)}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ paddingBottom: 8 }}>
                        <strong>Ganancia Total (P&amp;L)</strong>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, paddingBottom: 8 }}>
                        <span className={results.ganancia_total >= 0 ? 'text-positive' : 'text-negative'}>
                          {fmt(results.ganancia_total, selectedInstrument?.moneda)}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ── Performance Summary Bar ────── */}
              {(() => {
                const absCap = Math.abs(results.ganancia_capital);
                const absDiv = Math.abs(results.dividendos_recibidos);
                const totalImpact = absCap + absDiv;
                
                const capWeight = totalImpact > 0 ? (absCap / totalImpact) * 100 : 0;
                const divWeight = totalImpact > 0 ? (absDiv / totalImpact) * 100 : 0;
                
                const isLoss = results.ganancia_capital < 0;
                const capColor = isLoss ? 'var(--red-500)' : 'var(--blue-500)';
                const divColor = 'var(--cyan-500)';

                return (
                  <div className="fm-card" style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                    <div style={{ minWidth: 0 }}>
                      <p className="kpi-label" style={{ marginBottom: 10 }}>Composición del Retorno (% Atribución)</p>
                      <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', width: 220, background: 'var(--gray-100)' }}>
                        <div style={{ width: `${capWeight}%`, background: capColor, transition: 'width 0.6s ease' }} />
                        <div style={{ width: `${divWeight}%`, background: divColor, transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: capColor, flexShrink: 0 }} />
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--gray-600)' }}>
                          {isLoss ? 'Pérdida Capital' : 'Plusvalía'} <strong>{capWeight.toFixed(1)}%</strong>
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: divColor, flexShrink: 0 }} />
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--gray-600)' }}>
                          Dividendos <strong>{divWeight.toFixed(1)}%</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

            </div>
          ) : (
            /* ── Empty State ─────────────────── */
            <div className="empty-state">
              <Calendar size={48} strokeWidth={1.2} />
              <p>Seleccione un instrumento y configure los parámetros para ver el análisis de rentabilidad</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Performance;
