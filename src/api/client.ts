import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: baseURL ? `${baseURL}/api` : '/api',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const csrf = getCsrfToken();
  if (csrf) config.headers['X-XSRF-TOKEN'] = csrf;
  return config;
});

function getCsrfToken(): string | null {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** À appeler avant le premier POST (ex. login) pour éviter l’erreur 419 CSRF. */
export async function ensureCsrfCookie(): Promise<void> {
  const origin = baseURL || '';
  await fetch(origin ? `${origin}/sanctum/csrf-cookie` : '/sanctum/csrf-cookie', {
    method: 'GET',
    credentials: 'include',
  });
}

api.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(e);
  }
);

export function getApiData<T>(res: { data: { data?: T } }): T | undefined {
  return res.data?.data;
}
