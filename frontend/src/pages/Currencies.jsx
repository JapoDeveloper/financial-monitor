import React, { useState, useEffect } from 'react';
import { RefreshCw, ArrowRightLeft, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

const Currencies = () => {
  const [rates,      setRates]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [syncing,    setSyncing]    = useState(false);
  const [error,      setError]      = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

  const fetchRates = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/currency/rates`);
      if (!res.ok) throw new Error('Error al cargar las tasas de cambio');
      setRates(await res.json());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const res = await fetch(`${API_URL}/currency/update`, { method: 'POST' });
      if (!res.ok) throw new Error('Error al sincronizar las tasas');
      const data = await res.json();
      setRates(data.updated_rates);
      setSuccessMsg(data.message);
      setError(null);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => { fetchRates(); }, []);

  const fmtDate = (dateStr) =>
    new Date(dateStr).toLocaleString('es-DO', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 20px' }}>
      {/* ── Header ──────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Monitor de Divisas
          </h1>
          <p className="page-subtitle">
            Tasas de cambio activas para conversión de portafolio
          </p>
        </div>
        <button
          className="fm-btn fm-btn--primary"
          onClick={handleSync}
          disabled={syncing}
          id="sync-rates-btn"
        >
          {syncing
            ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Sincronizando…</>
            : <><RefreshCw size={15} /> Sincronizar Tasas</>
          }
        </button>
      </div>

      {/* ── Alerts ──────────────────────────────── */}
      {error && (
        <div className="fm-alert fm-alert--error section-spacing">
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="fm-alert section-spacing" style={{
          background: 'var(--green-100)',
          color: '#15803D', border: '1px solid #BBF7D0',
        }}>
          <CheckCircle size={16} style={{ flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ── Loading ─────────────────────────────── */}
      {loading && rates.length === 0 ? (
        <div className="fm-spinner empty-panel">
          <Loader2 size={40} style={{ animation: 'spin 1s linear infinite', color: 'var(--blue-500)' }} />
        </div>
      ) : (
        <>
          {/* ── Summary mini-cards ─────────────── */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
            {rates.map((rate, i) => (
              <div key={`${rate.moneda_origen}-${rate.moneda_destino}`}
                className="fm-card fm-card--accent"
                style={{ flex: '1 1 200px', borderLeftColor: i === 0 ? 'var(--blue-500)' : 'var(--cyan-500)' }}>
                <p className="kpi-label">
                  {rate.moneda_origen} → {rate.moneda_destino}
                </p>
                <p className="kpi-value">
                  {rate.valor.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                </p>
                <p className="kpi-sub">1 {rate.moneda_origen} = {rate.valor.toLocaleString(undefined, { minimumFractionDigits: 2 })} {rate.moneda_destino}</p>
              </div>
            ))}
          </div>

          {/* ── Table ─────────────────────────────── */}
          <div className="fm-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowRightLeft size={16} color="var(--blue-500)" />
              <h3 className="section-title" style={{ fontSize: 'var(--font-size-base)' }}>
                Tasas Vigentes
              </h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="fm-table">
                <thead>
                  <tr>
                    <th>Moneda Origen</th>
                    <th>Moneda Destino</th>
                    <th style={{ textAlign: 'right' }}>Tasa de Cambio</th>
                    <th style={{ textAlign: 'right' }}>Última Actualización</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--gray-400)' }}>
                        No hay tasas disponibles. Use el botón de sincronización.
                      </td>
                    </tr>
                  ) : (
                    rates.map((rate) => (
                      <tr key={`${rate.moneda_origen}-${rate.moneda_destino}`}>
                        <td>
                          <span className="status-badge status-badge--neutral">{rate.moneda_origen}</span>
                        </td>
                        <td>
                          <span className="status-badge status-badge--neutral" style={{ color: 'var(--cyan-500)', background: 'var(--cyan-100)' }}>
                            {rate.moneda_destino}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 'var(--font-size-md)', color: 'var(--blue-800)' }}>
                          {rate.valor.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--gray-400)', fontSize: 'var(--font-size-sm)' }}>
                          {fmtDate(rate.fecha_actualizacion)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Currencies;
