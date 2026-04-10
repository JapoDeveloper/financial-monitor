import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
});

export const getYearlyPerformance = async (year, currency = 'USD') => {
  const { data } = await api.get(`/portfolio/performance/${year}`, {
    params: { currency },
  });
  return data;
};

export const getCurrencies = async () => {
  const { data } = await api.get('/portfolio/currencies');
  return data;
};

export const getPerformanceHistory = async (startYear, endYear, currency = 'USD') => {
  const { data } = await api.get('/portfolio/performance/history', {
    params: { start_year: startYear, end_year: endYear, currency },
  });
  return data;
};
