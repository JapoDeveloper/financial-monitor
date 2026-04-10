import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const getActiveInstruments = async () => {
  const response = await axios.get(`${API_BASE_URL}/performance/instruments`);
  return response.data;
};

export const calculatePerformance = async (params) => {
  const response = await axios.post(`${API_BASE_URL}/performance/calculate`, params);
  return response.data;
};
