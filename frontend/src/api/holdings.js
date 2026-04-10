import axios from 'axios';

const API_BASE_URL = '/api/v1'; // Adjust if needed based on your proxy config

export const getHoldings = async () => {
  const response = await axios.get(`${API_BASE_URL}/holdings/holdings`);
  return response.data;
};

export const getProfitabilityEvolution = async (year, currency) => {
  const response = await axios.get(`${API_BASE_URL}/holdings/profitability-evolution`, {
    params: { year, currency }
  });
  return response.data;
};

export const getCagrPerformance = async () => {
  const response = await axios.get(`${API_BASE_URL}/holdings/cagr-performance`);
  return response.data;
};
