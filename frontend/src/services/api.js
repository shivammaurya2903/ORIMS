import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    // Do not attempt refresh on auth check or auth action endpoints
    const isAuthRoute =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/refresh') ||
      originalRequest?.url?.includes('/auth/me') ||
      originalRequest?.url?.includes('/auth/logout');
    
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      originalRequest._retry = true;
      
      try {
        const refreshRes = await api.post('/auth/refresh');
        if (refreshRes.data?.accessToken) {
          api.defaults.headers.common['Authorization'] = `Bearer ${refreshRes.data.accessToken}`;
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers['Authorization'] = `Bearer ${refreshRes.data.accessToken}`;
        }
        return api(originalRequest);
      } catch (refreshErr) {
        // Clear token on refresh failure; do not hard-redirect with window.location
        // so that React Router ProtectedRoute guards pages and public pages remain viewable
        delete api.defaults.headers.common['Authorization'];
        return Promise.reject(refreshErr);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
