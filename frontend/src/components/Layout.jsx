import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  BriefcaseBusiness,
  Banknote,
  TrendingUp,
  LineChart,
} from 'lucide-react';

const menuItems = [
  { text: 'Rendimiento Portafolio',             icon: LayoutDashboard,   path: '/' },
  { text: 'Composición Portafolio',    icon: BriefcaseBusiness, path: '/holdings' },
  { text: 'Activos Internacionales', icon: LineChart,        path: '/stocks' },
  { text: 'Cálculo Rentabilidad',  icon: TrendingUp,        path: '/performance' },
  { text: 'Seguimiento Precio Monedas',               icon: Banknote,          path: '/currencies' },
];

export default function Layout({ children }) {
  const navigate  = useNavigate();
  const location  = useLocation();

  return (
    <div className="app-shell">
      {/* ── Floating Nav ──────────────────────── */}
      <nav className="floating-nav" aria-label="Navegación principal" style={{ marginLeft: '24px' }}>
        {menuItems.map((item, idx) => {
          const Icon    = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <React.Fragment key={item.text}>
              <button
                className={`nav-item${isActive ? ' active' : ''}`}
                onClick={() => navigate(item.path)}
                aria-label={item.text}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={19} strokeWidth={isActive ? 2.2 : 1.8} />
                <span className="nav-tooltip">{item.text}</span>
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      {/* ── Page Content ──────────────────────── */}
      <main className="page-content">
        {children}
      </main>
    </div>
  );
}
