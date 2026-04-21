// import axios from 'axios';

// const api = axios.create({
//   baseURL: process.env.REACT_APP_API_URL ?? 'https://localhost:7001',
//   headers: { 'Content-Type': 'application/json' },
//   timeout: 10_000,
// });

// api.interceptors.response.use(
//   (res) => res,
//   (err) => {
//     const message = err.response?.data?.message ?? err.message ?? 'Unknown error';
//     return Promise.reject(new Error(message));
//   },
// );

// export default api;
// Stub — not used in mock mode but satisfies imports
import axios from 'axios';
export default axios.create({ baseURL: 'http://localhost:7001' });