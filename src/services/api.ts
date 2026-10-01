import axios from 'axios';

const api = axios.create({
  // Same-origin "/api": proxied to the Node server by Vite in dev, routed to the
  // serverless function by vercel.json in production. Override with VITE_API_URL if needed.
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15_000,
});

// Response Interceptor for global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error ?? error.message ?? 'Something went wrong';
    return Promise.reject(new Error(message));
  }
);

export default api;