import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import PortfolioAnuallyPerformance from './pages/PortfolioAnuallyPerformance';
import PortfolioHoldings from './pages/PortfolioHoldings';
import Currencies from './pages/Currencies';
import Performance from './pages/Performance';
import StocksPortfolio from './pages/StocksPortfolio';
import './App.css';

// ThemeProvider lives in main.jsx — no duplicate wrapper here
function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/"            element={<PortfolioAnuallyPerformance />} />
          <Route path="/holdings"    element={<PortfolioHoldings />} />
          <Route path="/currencies"  element={<Currencies />} />
          <Route path="/performance" element={<Performance />} />
          <Route path="/stocks"      element={<StocksPortfolio />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
