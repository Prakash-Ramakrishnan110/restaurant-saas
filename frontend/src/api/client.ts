import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details: Record<string, any>;
  };
}

let inMemoryAccessToken: string | null = null;
let activeTenantId: string | null = null;

export const setAccessToken = (token: string | null) => {
  inMemoryAccessToken = token;
};

export const getAccessToken = (): string | null => {
  return inMemoryAccessToken;
};

export const setActiveTenantId = (tenantId: string | null) => {
  activeTenantId = tenantId;
};

export const getActiveTenantId = (): string | null => {
  return activeTenantId;
};

export const apiClient = axios.create({
  baseURL: "/api/v1",
  withCredentials: true, // Send httpOnly cookies (refresh token)
  headers: {
    "Content-Type": "application/json",
  },
});

// Single-flight refresh mutex
let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await axios.post<{ access: string }>(
        "/api/v1/auth/refresh/",
        {},
        { withCredentials: true }
      );
      const newAccess = response.data.access;
      setAccessToken(newAccess);
      return newAccess;
    } catch {
      setAccessToken(null);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

// Request interceptor: attach access token and tenant header
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (inMemoryAccessToken) {
    config.headers.set("Authorization", `Bearer ${inMemoryAccessToken}`);
  }
  if (activeTenantId) {
    config.headers.set("X-Tenant-ID", activeTenantId);
  }
  return config;
});

// Response interceptor: handle 401 with transparent single-flight refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorPayload>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!originalRequest) {
      return Promise.reject(normalizeApiError(error));
    }

    // Do not attempt refresh on login, refresh, or logout routes
    const isAuthRoute =
      originalRequest.url?.includes("/auth/login/") ||
      originalRequest.url?.includes("/auth/refresh/") ||
      originalRequest.url?.includes("/auth/logout/");

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      originalRequest._retry = true;
      const newAccess = await refreshAccessToken();
      if (newAccess) {
        originalRequest.headers.set("Authorization", `Bearer ${newAccess}`);
        return apiClient(originalRequest);
      }
    }

    return Promise.reject(normalizeApiError(error));
  }
);

export function normalizeApiError(error: AxiosError<any>): ApiErrorPayload {
  if (error.response?.data?.error) {
    return error.response.data as ApiErrorPayload;
  }

  // Fallback normalization
  return {
    error: {
      code: error.code || "NETWORK_ERROR",
      message:
        error.response?.data?.detail ||
        error.message ||
        "An unexpected network or server error occurred.",
      details: (error.response?.data as any) || {},
    },
  };
}
