const API_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

const REFRESH_KEY = "schemasay_refresh_token";

let accessToken: string | null = null;
let refreshHandler: (() => Promise<string | null>) | null = null;

export function getApiUrl(): string {
  return API_URL;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_KEY);
}

export function setRefreshToken(token: string | null): void {
  if (token) {
    sessionStorage.setItem(REFRESH_KEY, token);
  } else {
    sessionStorage.removeItem(REFRESH_KEY);
  }
}

export function setTokenRefreshHandler(handler: (() => Promise<string | null>) | null): void {
  refreshHandler = handler;
}

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  retry?: boolean;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, retry = true } = options;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (auth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && auth && retry && refreshHandler) {
    const newToken = await refreshHandler();
    if (newToken) {
      return apiRequest<T>(path, { ...options, retry: false });
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail =
      typeof payload.detail === "string"
        ? payload.detail
        : Array.isArray(payload.detail)
          ? payload.detail.map((e: { msg?: string }) => e.msg ?? "Validation error").join(", ")
          : "Request failed";
    throw new ApiError(response.status, detail);
  }

  return payload as T;
}

type FormRequestOptions = {
  method?: string;
  auth?: boolean;
  retry?: boolean;
};

export async function apiFormRequest<T>(
  path: string,
  formData: FormData,
  options: FormRequestOptions = {},
): Promise<T> {
  const { method = "POST", auth = true, retry = true } = options;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (auth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: formData,
  });

  if (response.status === 401 && auth && retry && refreshHandler) {
    const newToken = await refreshHandler();
    if (newToken) {
      return apiFormRequest<T>(path, formData, { ...options, retry: false });
    }
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail =
      typeof payload.detail === "string"
        ? payload.detail
        : Array.isArray(payload.detail)
          ? payload.detail.map((e: { msg?: string }) => e.msg ?? "Validation error").join(", ")
          : "Request failed";
    throw new ApiError(response.status, detail);
  }

  return payload as T;
}
