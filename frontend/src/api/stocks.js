import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const getStocksDashboard = async (macroRegimeOverride = null) => {
    let url = `${API_URL}/stocks/dashboard`;
    if (macroRegimeOverride) {
        url += `?macro_regime_override=${encodeURIComponent(macroRegimeOverride)}`;
    }
    const response = await axios.get(url);
    return response.data;
};

export const getAssetHistory = async (ticker, period = null) => {
    let url = `${API_URL}/stocks/asset/${ticker}/history`;
    if (period) {
        url += `?period=${encodeURIComponent(period)}`;
    }
    const response = await axios.get(url);
    return response.data;
};
