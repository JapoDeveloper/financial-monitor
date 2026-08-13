import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getYearlyPerformance, getPerformanceHistory } from "../api/portfolio";
import { getProfitabilityEvolution, getCagrPerformance } from "../api/holdings";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  DollarSign,
  Coins,
  TrendingUp,
  TrendingDown,
  Loader2,
  BarChart3,
  TableProperties,
} from "lucide-react";
import {
  CHART_PALETTE,
  CURRENCY_COLORS,
  TOOLTIP_STYLE,
  SELECTOR_STYLES,
} from "../constants/chartTheme";

/* ── Helpers ───────────────────────────────────── */
const pct = (v) => (v !== null && v !== undefined ? `${v.toFixed(2)}%` : "—");
const fmtCompact = (v) =>
  v !== null && v !== undefined
    ? new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(v)
    : "-";
const fmtCurrency = (v, currencyCode = "DOP") =>
  v !== null && v !== undefined
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: 0,
      }).format(v)
    : "-";

const fallbackColor = (i) => CHART_PALETTE[i % CHART_PALETTE.length];

/* ── Custom Tooltip ────────────────────────────── */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E8EEF8",
        borderRadius: 10,
        padding: "10px 14px",
        boxShadow: "0 4px 16px rgba(30,58,138,0.1)",
        fontFamily: "var(--font-family)",
        fontSize: 13,
      }}
    >
      <p style={{ fontWeight: 700, color: "var(--blue-800)", marginBottom: 6 }}>
        {label}
      </p>
      {payload.map((p) => (
        <div
          key={p.name}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 3,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: p.color,
            }}
          />
          <span style={{ color: "var(--gray-600)" }}>{p.name}:</span>
          <span
            style={{
              fontWeight: 700,
              color: p.value >= 0 ? "var(--green-500)" : "var(--red-500)",
            }}
          >
            {`${p.value.toFixed(2)}%`}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ── Metric Mini Card (summary) ────────────────── */
const SummaryCard = ({ currencyCode, data, index }) => {
  const isPos = data.summary.annual_return >= 0;
  const color = CURRENCY_COLORS[currencyCode]?.area || fallbackColor(index);
  return (
    <div
      className="fm-card fm-card--accent"
      style={{
        borderLeftColor: color,
        padding: "16px 32px",
        marginRight: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: `${color}18`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color,
            }}
          >
            {currencyCode === "USD" ? (
              <DollarSign size={18} />
            ) : (
              <Coins size={18} />
            )}
          </div>
          <div>
            <p className="kpi-label" style={{ marginBottom: 0 }}>
              Resumen {currencyCode}
            </p>
          </div>
        </div>
        <span className={`kpi-badge kpi-badge--${isPos ? "up" : "down"}`}>
          {isPos ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {pct(data.summary.annual_return)}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <p
            style={{
              fontSize: 11,
              color: "var(--gray-400)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 3,
            }}
          >
            Valor Actual
          </p>
          <p
            style={{ fontSize: 20, fontWeight: 800, color: "var(--gray-800)" }}
          >
            {fmtCompact(data.summary.current_value)}{" "}
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--gray-400)",
              }}
            >
              {currencyCode}
            </span>
          </p>
        </div>
        <div>
          <p
            style={{
              fontSize: 11,
              color: "var(--gray-400)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 3,
            }}
          >
            Ganancia Total
          </p>
          <p
            style={{
              fontSize: 20,
              fontWeight: 800,
              color:
                data.summary.total_gain >= 0
                  ? "var(--green-500)"
                  : "var(--red-500)",
            }}
          >
            {fmtCompact(data.summary.total_gain)}
          </p>
        </div>
      </div>
    </div>
  );
};

/* ── Monthly Table ─────────────────────────────── */
const ConsolidatedMonthlyTable = ({ yearlyData, currencies }) => {
  const periods =
    [
      ...new Set(
        Object.values(yearlyData).flatMap((data) =>
          data.monthly_breakdown?.map((b) => b.period),
        ),
      ),
    ] || [];

  return (
    <div
      className="fm-card"
      style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}
    >
      <div
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--border-color)",
        }}
      >
        <h3
          style={{
            fontSize: "var(--font-size-base)",
            fontWeight: 700,
            color: "var(--gray-800)",
          }}
        >
          Progreso Mensual Detallado
        </h3>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="fm-table">
          <thead>
            <tr>
              <th>Período</th>
              {currencies.map((c) => (
                <th
                  key={c}
                  colSpan={6}
                  style={{
                    textAlign: "center",
                    background: CURRENCY_COLORS[c]
                      ? `${CURRENCY_COLORS[c].area}10`
                      : undefined,
                    borderLeft: `3px solid ${CURRENCY_COLORS[c]?.area || "#E8EEF8"}`,
                  }}
                >
                  {c}
                </th>
              ))}
            </tr>
            <tr>
              <th style={{ background: "var(--gray-50)" }}></th>
              {currencies.map((c) => (
                <React.Fragment key={c}>
                  {[
                    "Saldo I.",
                    "Flujo",
                    "Ganancia",
                    "Saldo F.",
                    "Ret.",
                    "Acum.",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "right",
                        fontWeight: 600,
                        background: CURRENCY_COLORS[c]
                          ? `${CURRENCY_COLORS[c].area}08`
                          : undefined,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((period, pIndex) => (
              <tr key={period}>
                <td
                  style={{
                    fontWeight: 600,
                    color: "var(--blue-800)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {period}
                </td>
                {currencies.map((c, cIdx) => {
                  const row = yearlyData[c].monthly_breakdown[pIndex];
                  const borderLeft =
                    cIdx > 0
                      ? `2px solid ${CURRENCY_COLORS[c]?.area || "#E8EEF8"}30`
                      : undefined;
                  const fmt0 = (v) =>
                    v !== null && v !== undefined
                      ? new Intl.NumberFormat("en-US", {
                          minimumFractionDigits: 0,
                        }).format(v)
                      : "-";
                  return (
                    <React.Fragment key={c}>
                      <td style={{ textAlign: "right", borderLeft }}>
                        {fmt0(row?.v_inicial)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {fmt0(row?.flujo_neto)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {fmt0(row?.ganancia_mercado)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        {fmt0(row?.valor_cartera)}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontWeight: 700,
                          color:
                            row?.retorno_mensual >= 0
                              ? "var(--green-500)"
                              : "var(--red-500)",
                        }}
                      >
                        {pct(row?.retorno_mensual)}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontWeight: 700,
                          color:
                            row?.retorno_acc >= 0
                              ? "var(--blue-600)"
                              : "var(--red-500)",
                        }}
                      >
                        {pct(row?.retorno_acc)}
                      </td>
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ── Profitability Evolution Chart ───────────── */
const ProfitabilityEvolution = ({ year, initialCurrency }) => {
  const [currency, setCurrency] = useState(initialCurrency || "DOP");
  const [hiddenSeries, setHiddenSeries] = useState([]);
  const [hoveredSeries, setHoveredSeries] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["profitabilityEvolution", year, currency],
    queryFn: () => getProfitabilityEvolution(year, currency),
  });

  const handleLegendClick = (o) => {
    const { dataKey } = o;
    setHiddenSeries((prev) =>
      prev.includes(dataKey)
        ? prev.filter((s) => s !== dataKey)
        : [...prev, dataKey],
    );
  };

  if (isLoading)
    return (
      <div className="fm-spinner">
        <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  if (!data || !data.series?.length)
    return (
      <div
        className="fm-card"
        style={{ padding: 40, textAlign: "center", color: "var(--gray-400)" }}
      >
        No hay datos de rentabilidad por instrumento para {year} ({currency})
      </div>
    );

  // Transform data for Recharts
  const SPANISH_MONTHS = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const ENGLISH_MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const getMonthIndex = (m) => {
    if (!m) return 99;
    const mStr =
      String(m).charAt(0).toUpperCase() + String(m).slice(1).toLowerCase();
    const idxEs = SPANISH_MONTHS.indexOf(mStr);
    if (idxEs !== -1) return idxEs;
    const idxEn = ENGLISH_MONTHS.indexOf(mStr);
    if (idxEn !== -1) return idxEn;
    return 99;
  };

  const months = Array.from(
    new Set([
      ...data.weighted_average.map((d) => d.month),
      ...data.series.flatMap((s) => s.data.map((d) => d.month)),
    ]),
  ).sort((a, b) => getMonthIndex(a) - getMonthIndex(b));

  const chartDataRaw = months.map((m) => {
    const point = { month: m };
    data.series.forEach((s) => {
      const d = s.data.find((dp) => dp.month === m);
      if (d) point[s.instrument] = d.yield;
    });
    const avg = data.weighted_average.find((a) => a.month === m);
    if (avg) point["PROMEDIO"] = avg.yield;
    return point;
  });

  const chartData =
    chartDataRaw.length > 0
      ? [
          {
            month: "0",
            ...data.series.reduce(
              (acc, s) => ({ ...acc, [s.instrument]: 0 }),
              {},
            ),
            PROMEDIO: 0,
          },
          ...chartDataRaw,
        ]
      : [];

  return (
    <div className="fm-card" style={{ marginBottom: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h3
          style={{
            fontSize: "var(--font-size-md)",
            fontWeight: 700,
            color: "var(--gray-800)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <BarChart3 size={18} color="var(--blue-500)" />
          Evolución de Rentabilidad ({year})
        </h3>
        <div style={SELECTOR_STYLES.container}>
          {["DOP", "USD"].map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              style={SELECTOR_STYLES.button(currency === c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: "1px dashed #E8EEF8",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--gray-400)",
              marginRight: 4,
            }}
          >
            Filtros de Clase:
          </span>
          {Array.from(new Set(data.series.map((s) => s.asset_class)))
            .filter(Boolean)
            .map((ac) => (
              <button
                key={ac}
                onClick={() => {
                  const seriesToHide = data.series
                    .filter((s) => s.asset_class !== ac)
                    .map((s) => s.instrument);
                  setHiddenSeries([...seriesToHide, "PROMEDIO"]);
                }}
                style={{
                  fontSize: 11,
                  padding: "4px 10px",
                  borderRadius: 12,
                  background: "var(--blue-50)",
                  color: "var(--blue-700)",
                  border: "1px solid var(--blue-100)",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {ac}
              </button>
            ))}
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => setHiddenSeries([])}
            style={{
              fontSize: 12,
              color: "var(--blue-600)",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              padding: 0,
            }}
          >
            Mostrar todo
          </button>
          <button
            onClick={() =>
              setHiddenSeries([
                ...data.series.map((s) => s.instrument),
                "PROMEDIO",
              ])
            }
            style={{
              fontSize: 12,
              color: "var(--gray-500)",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              padding: 0,
            }}
          >
            Ocultar todo
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={420}>
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#E8EEF840"
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "#9CA3AF" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => `${v.toFixed(1)}%`}
            tick={{ fontSize: 11, fill: "#9CA3AF" }}
            axisLine={false}
            tickLine={false}
            width={55}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 20, cursor: "pointer" }}
            iconType="circle"
            onClick={handleLegendClick}
            onMouseEnter={(e) => setHoveredSeries(e.dataKey)}
            onMouseLeave={() => setHoveredSeries(null)}
            formatter={(value, entry) => {
              const isHidden = hiddenSeries.includes(entry.dataKey);
              const isHovered = hoveredSeries === entry.dataKey;
              const anyHovered = hoveredSeries !== null;

              return (
                <span
                  style={{
                    color: isHidden
                      ? "var(--gray-300)"
                      : anyHovered && !isHovered
                        ? "var(--gray-400)"
                        : "var(--blue-800)",
                    fontWeight: isHidden ? "normal" : isHovered ? 900 : 700,
                    opacity: anyHovered && !isHovered ? 0.4 : 1,
                    transition: "all 0.2s ease",
                  }}
                >
                  {value}
                </span>
              );
            }}
          />

          {data.series.map((s, i) => {
            const isHovered = hoveredSeries === s.instrument;
            const anyHovered = hoveredSeries !== null;
            return (
              <Line
                key={s.instrument}
                type="monotone"
                dataKey={s.instrument}
                stroke={fallbackColor(i)}
                strokeWidth={isHovered ? 3 : 1.5}
                strokeOpacity={anyHovered ? (isHovered ? 1 : 0.15) : 1}
                dot={{ r: isHovered ? 4 : 2.5, fill: fallbackColor(i) }}
                activeDot={{ r: 5 }}
                hide={hiddenSeries.includes(s.instrument)}
                onMouseEnter={() => setHoveredSeries(s.instrument)}
                onMouseLeave={() => setHoveredSeries(null)}
              />
            );
          })}

          {/* Average Line: Subtle / Dasharray as requested */}
          <Line
            type="monotone"
            dataKey="PROMEDIO"
            name="PROMEDIO PONDERADO"
            stroke="var(--gray-400)"
            strokeWidth={hoveredSeries === "PROMEDIO" ? 4 : 3}
            strokeOpacity={
              hoveredSeries !== null
                ? hoveredSeries === "PROMEDIO"
                  ? 1
                  : 0.15
                : 1
            }
            strokeDasharray="5 5"
            dot={{
              r: hoveredSeries === "PROMEDIO" ? 5 : 4,
              fill: "var(--gray-400)",
            }}
            activeDot={{ r: 6 }}
            hide={hiddenSeries.includes("PROMEDIO")}
            onMouseEnter={() => setHoveredSeries("PROMEDIO")}
            onMouseLeave={() => setHoveredSeries(null)}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

/* ── CAGR Performance Table ─────────────────── */
const CagrTable = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["cagrPerformance"],
    queryFn: getCagrPerformance,
  });

  if (isLoading)
    return (
      <div className="fm-spinner">
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  if (!data?.length) return null;

  const currencies = [...new Set(data.map((d) => d.currency))];

  return (
    <div
      className="fm-card"
      style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}
    >
      <div
        style={{
          padding: "18px 24px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <TableProperties size={18} color="var(--blue-500)" />
        <h3
          style={{
            fontSize: "var(--font-size-base)",
            fontWeight: 700,
            color: "var(--gray-800)",
          }}
        >
          Rentabilidad Anualizada (CAGR) — Global Portafolio
        </h3>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="fm-table">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Instrumento</th>
              <th style={{ textAlign: "center" }}>Divisa</th>
              <th style={{ textAlign: "right" }}>Peso (%)</th>
              <th style={{ textAlign: "right" }}>30 Días</th>
              <th style={{ textAlign: "right" }}>90 Días</th>
              <th style={{ textAlign: "right" }}>180 Días</th>
              <th style={{ textAlign: "right" }}>1 Año</th>
              <th style={{ textAlign: "right" }}>3 Años</th>
              <th style={{ textAlign: "right" }}>5 Años</th>
            </tr>
          </thead>
          <tbody>
            {currencies.map((curr) => (
              <React.Fragment key={curr}>
                <tr style={{ background: "var(--gray-50)" }}>
                  <td
                    colSpan={9}
                    style={{
                      fontWeight: 800,
                      color: "var(--blue-800)",
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      padding: "8px 24px",
                    }}
                  >
                    Bloque {curr}
                  </td>
                </tr>
                {data
                  .filter((d) => d.currency === curr)
                  .map((row, idx) => (
                    <tr key={`${row.instrument}-${idx}`}>
                      <td style={{ fontWeight: 600, color: "var(--gray-700)" }}>
                        {row.instrument}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background:
                              CURRENCY_COLORS[row.currency]?.area + "20",
                            color: CURRENCY_COLORS[row.currency]?.area,
                          }}
                        >
                          {row.currency}
                        </span>
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontWeight: 700,
                          color: "var(--blue-600)",
                        }}
                      >
                        {row.weight.toFixed(2)}%
                      </td>
                      {[
                        row.cagr_30d,
                        row.cagr_90d,
                        row.cagr_180d,
                        row.cagr_1y,
                        row.cagr_3y,
                        row.cagr_5y,
                      ].map((v, i) => (
                        <td
                          key={i}
                          style={{
                            textAlign: "right",
                            fontWeight: 700,
                            color:
                              v === null
                                ? "var(--gray-300)"
                                : v >= 0
                                  ? "var(--green-500)"
                                  : "var(--red-500)",
                          }}
                        >
                          {v !== null ? `${v.toFixed(2)}%` : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ── Main Dashboard ────────────────────────────── */
const PortfolioAnuallyPerformance = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedHistoryYears, setSelectedHistoryYears] = useState(5);
  const [hiddenCurrencies, setHiddenCurrencies] = useState([]);

  const { data: yearlyData, isLoading: loadingYearly } = useQuery({
    queryKey: ["yearlyPerformance", selectedYear],
    queryFn: () => getYearlyPerformance(selectedYear),
  });

  const { data: historyData, isLoading: loadingHistory } = useQuery({
    queryKey: ["performanceHistory", selectedHistoryYears],
    queryFn: () =>
      getPerformanceHistory(currentYear - selectedHistoryYears, currentYear),
  });

  const handleLegendClick = (o) => {
    const { dataKey } = o;
    setHiddenCurrencies((prev) =>
      prev.includes(dataKey)
        ? prev.filter((c) => c !== dataKey)
        : [...prev, dataKey],
    );
  };

  let chartData = (historyData || []).map((h) => ({
    year: h.year,
    ...h.returns_by_currency,
  }));
  if (chartData.length > 0) {
    const first = chartData[0];
    const currencyKeys = Object.keys(first).filter((k) => k !== "year");
    const zero = { year: first.year - 1 };
    currencyKeys.forEach((c) => (zero[c] = 0));
    chartData = [zero, ...chartData];
  }

  const currencies = yearlyData ? Object.keys(yearlyData.data_by_currency) : [];

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 20px" }}>
      {/* ── Header ──────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 28,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "var(--font-size-xl)",
              fontWeight: 800,
              color: "var(--blue-800)",
              marginBottom: 4,
            }}
          >
            Rendimiento Anual Detallado
          </h1>
          <p
            style={{
              fontSize: "var(--font-size-base)",
              color: "var(--gray-400)",
            }}
          >
            Comparativa institucional de rentabilidades y evolución por divisa
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div>
            <label className="fm-label" style={{ marginBottom: 4 }}>
              Año de análisis
            </label>
            <div className="fm-select-wrapper">
              <select
                className="fm-select"
                style={{ width: "auto", minWidth: 100 }}
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              >
                {[...Array(5)].map((_, i) => (
                  <option key={i} value={currentYear - i}>
                    {currentYear - i}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="fm-label" style={{ marginBottom: 4 }}>
              Historial
            </label>
            <div className="fm-select-wrapper">
              <select
                className="fm-select"
                style={{ width: "auto", minWidth: 120 }}
                value={selectedHistoryYears}
                onChange={(e) =>
                  setSelectedHistoryYears(parseInt(e.target.value))
                }
              >
                {[3, 5, 7, 10].map((y) => (
                  <option key={y} value={y}>
                    Últimos {y} años
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Summary Cards ───────────────────────── */}
      {loadingYearly ? (
        <div className="fm-spinner">
          <Loader2
            size={32}
            style={{
              animation: "spin 1s linear infinite",
              color: "var(--blue-500)",
            }}
          />
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          {currencies.map((currency, i) => (
            <SummaryCard
              key={currency}
              currencyCode={currency}
              data={yearlyData.data_by_currency[currency]}
              index={i}
            />
          ))}
        </div>
      )}

      {/* ── Monthly Table ────────────────────────── */}
      {!loadingYearly && yearlyData && currencies.length > 0 && (
        <ConsolidatedMonthlyTable
          yearlyData={yearlyData.data_by_currency}
          currencies={currencies}
        />
      )}

      {/* ── Profitability Evolution Chart (New) ─── */}
      <ProfitabilityEvolution
        year={selectedYear}
        initialCurrency={currencies[0]}
      />

      {/* ── CAGR Performance Table (New) ────────── */}
      <CagrTable />

      {/* ── Historical Area Chart ────────────────── */}
      <div className="fm-card" style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h3
            style={{
              fontSize: "var(--font-size-md)",
              fontWeight: 700,
              color: "var(--gray-800)",
            }}
          >
            Rendimientos Históricos de Cartera
          </h3>
          <span
            style={{
              fontSize: "var(--font-size-xs)",
              color: "var(--gray-400)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Retorno anual acumulado por divisa
          </span>
        </div>

        {loadingHistory ? (
          <div className="fm-spinner">
            <Loader2
              size={28}
              style={{
                animation: "spin 1s linear infinite",
                color: "var(--blue-500)",
              }}
            />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
            >
              <defs>
                {currencies.map((c, i) => {
                  const color = CURRENCY_COLORS[c]?.area || fallbackColor(i);
                  const id = `grad_${c}`;
                  return (
                    <linearGradient
                      key={id}
                      id={id}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor={color} stopOpacity={0.22} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.01} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#E8EEF820"
                vertical={false}
              />
              <XAxis
                dataKey="year"
                tick={{
                  fontSize: 12,
                  fill: "#9CA3AF",
                  fontFamily: "var(--font-family)",
                }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={pct}
                tick={{
                  fontSize: 11,
                  fill: "#9CA3AF",
                  fontFamily: "var(--font-family)",
                }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <ReferenceLine y={0} stroke="#E8EEF8" strokeWidth={1.5} />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                wrapperStyle={{
                  fontSize: 12,
                  fontFamily: "var(--font-family)",
                  fontWeight: 600,
                  paddingTop: 16,
                  cursor: "pointer",
                }}
                iconType="circle"
                iconSize={8}
                onClick={handleLegendClick}
              />
              {currencies.map((c, i) => {
                const color = CURRENCY_COLORS[c]?.area || fallbackColor(i);
                return (
                  <Area
                    key={c}
                    type="monotoneX"
                    dataKey={c}
                    stroke={color}
                    strokeWidth={2.5}
                    fill={`url(#grad_${c})`}
                    dot={{ fill: color, strokeWidth: 0, r: 4 }}
                    activeDot={{
                      r: 6,
                      fill: color,
                      stroke: "#fff",
                      strokeWidth: 2,
                    }}
                    hide={hiddenCurrencies.includes(c)}
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default PortfolioAnuallyPerformance;
