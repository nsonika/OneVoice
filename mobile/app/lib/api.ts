import axios from 'axios';

// For physical devices, set EXPO_PUBLIC_API_URL in mobile/.env to your LAN URL.
export const API_URL = process.env.EXPO_PUBLIC_API_URL;

let authToken = '';

export function setAuthToken(token: string | null) {
  authToken = token || '';
}

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});
