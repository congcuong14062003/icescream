import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000/api",
  withCredentials: true,
  timeout: 20_000,
});

const ACCESS_TOKEN_STORAGE_KEY = "icecream-access-token";

function readStoredAccessToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

let accessToken = readStoredAccessToken();
let refreshPromise = null;

export function setAccessToken(token) {
  accessToken = token || null;
  if (typeof window === "undefined") return;
  if (accessToken) {
    window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
  } else {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  }
}

export function getAccessToken() {
  return accessToken;
}

export function refreshAccessToken() {
  refreshPromise ||= axios
    .post(
      `${api.defaults.baseURL}/auth/refresh`,
      {},
      { withCredentials: true, timeout: api.defaults.timeout },
    )
    .then((response) => {
      const token = response.data.data.accessToken;
      setAccessToken(token);
      return token;
    })
    .catch((error) => {
      setAccessToken(null);
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthEndpoint = original?.url?.startsWith("/auth/");
    if (
      error.response?.status === 401 &&
      !original?._retry &&
      !isAuthEndpoint
    ) {
      original._retry = true;
      try {
        const token = await refreshAccessToken();
        original.headers ||= {};
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch {
        window.dispatchEvent(new Event("icecream:session-expired"));
      }
    }
    return Promise.reject(error);
  },
);

export function apiMessage(error, fallback = "Không thể thực hiện thao tác") {
  return error.response?.data?.message || error.message || fallback;
}

export async function downloadFile(url, filename) {
  const response = await api.get(url, { responseType: "blob" });
  const objectUrl = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export default api;
