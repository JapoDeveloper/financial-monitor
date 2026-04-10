/**
 * FINANCIAL MONITOR — Shared Design Constants
 * Single source of truth for colors and chart theming.
 * All chart components should import from here.
 */

/**
 * Unified chart color palette — Sophisticated Institutional Palette.
 * Harmonious, professional, and consistent across all pages.
 */
export const CHART_PALETTE = [
  '#1D3557', // Prussian Blue (Institutional Base)
  '#457B9D', // Steel Blue (Balanced)
  '#2A9D8F', // Persian Green (Growth)
  '#84A98C', // Sage Green (Stability)
  '#E9C46A', // Saffron (Premium Accent)
  '#F4A261', // Soft Orange (Tactical)
  '#E76F51', // Terracotta (Yield/Alert)
  '#6D597A', // Muted Violet (Alternative)
  '#B5838D', // Mallow (Defensive)
  '#A8DADC', // Powder Blue (Liquidity)
  '#52796F', // Deep Sage (Sustainable)
  '#264653', // Charcoal Blue (Foundational)
];

export const CURRENCY_COLORS = {
  USD: { area: '#2A9D8F', gradient: 'gradientUSD' },
  DOP: { area: '#1D3557', gradient: 'gradientDOP' },
};
/**
 * Shared Selector Styles (Matching Activos Internacionales)
 */
export const SELECTOR_STYLES = {
  container: {
    display: 'inline-flex',
    gap: '6px',
    padding: '6px',
    background: 'rgba(29, 53, 87, 0.04)',
    borderRadius: '14px',
    border: '1px solid #eee',
    boxShadow: 'none',
  },
  button: (isActive) => ({
    padding: '8px 20px',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-family)',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    background: isActive ? '#1D3557' : 'transparent',
    color: isActive ? '#fff' : '#1D3557',
    boxShadow: isActive ? '0 6px 15px rgba(29, 53, 87, 0.3)' : 'none',
    '&:hover': {
      background: isActive ? '#1D3557' : 'rgba(29, 53, 87, 0.1)',
    },
  }),
};

/**
 * Semantic colors for financial values.
 */
export const FIN_COLORS = {
  positive: '#22C55E',
  negative: '#EF4444',
  neutral:  '#9CA3AF',
  primary:  '#2563EB',
  secondary:'#06B6D4',
  warning:  '#F59E0B',
};

/**
 * Chart tooltip style — consistent across all charts.
 */
export const TOOLTIP_STYLE = {
  background: '#FFFFFF',
  border: '1px solid #E8EEF8',
  borderRadius: '10px',
  padding: '10px 14px',
  boxShadow: '0 4px 16px rgba(30,58,138,0.09)',
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  fontSize: '13px',
};
