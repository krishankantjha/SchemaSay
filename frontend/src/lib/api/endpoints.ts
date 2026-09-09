import { apiFormRequest, apiRequest } from "./client";
import type {
  AuditLog,
  AuditReplayResponse,
  Connection,
  ConnectionCreate,
  ConnectionTest,
  ConnectionTestResponse,
  ConnectionPolicy,
  ConnectionPolicyUpdate,
  FeedbackCreate,
  FeedbackResponse,
  FormatQueryResponse,
  InsightRequest,
  InsightResponse,
  LoginRequest,
  Metric,
  MetricCreate,
  MetricPreviewResponse,
  MetricUpdate,
  QueryResponse,
  RegisterRequest,
  SchemaSyncResponse,
  SchemaTreeResponse,
  TokenResponse,
  User,
} from "./types";

export const authApi = {
  login: (payload: LoginRequest) =>
    apiRequest<TokenResponse>("/auth/login", { method: "POST", body: payload, auth: false }),

  register: (payload: RegisterRequest) =>
    apiRequest<User>("/auth/register", { method: "POST", body: payload, auth: false }),

  refresh: (refreshToken: string) =>
    apiRequest<TokenResponse>("/auth/refresh", {
      method: "POST",
      body: { refresh_token: refreshToken },
      auth: false,
    }),

  logout: () => apiRequest<{ message: string }>("/auth/logout", { method: "POST" }),

  me: () => apiRequest<User>("/auth/me"),
};

export const connectionsApi = {
  list: () => apiRequest<Connection[]>("/connections/"),

  test: (payload: ConnectionTest) =>
    apiRequest<ConnectionTestResponse>("/connections/test", { method: "POST", body: payload }),

  create: (payload: ConnectionCreate) =>
    apiRequest<Connection>("/connections/", { method: "POST", body: payload }),

  delete: (id: number) => apiRequest<{ message: string }>(`/connections/${id}`, { method: "DELETE" }),

  upload: (name: string, file: File) => {
    const form = new FormData();
    form.append("name", name);
    form.append("file", file);
    return apiFormRequest<Connection>("/connections/upload", form);
  },

  getPolicy: (connectionId: number) =>
    apiRequest<ConnectionPolicy>(`/connections/${connectionId}/policy`),

  updatePolicy: (connectionId: number, payload: ConnectionPolicyUpdate) =>
    apiRequest<ConnectionPolicy>(`/connections/${connectionId}/policy`, {
      method: "PUT",
      body: payload,
    }),
};

export const schemaApi = {
  sync: (connectionId: number, profile = false) =>
    apiRequest<SchemaSyncResponse>(`/schema/${connectionId}/sync?profile=${profile}`, {
      method: "POST",
    }),

  tree: (connectionId: number) =>
    apiRequest<SchemaTreeResponse>(`/schema/${connectionId}/tree`),
};

export const assistantApi = {
  query: (connectionId: number, question: string) =>
    apiRequest<QueryResponse>("/assistant/query", {
      method: "POST",
      body: { connection_id: connectionId, question },
    }),

  executeRaw: (connectionId: number, sql: string) =>
    apiRequest<QueryResponse>("/assistant/execute-raw", {
      method: "POST",
      body: { connection_id: connectionId, sql_query: sql },
    }),
};

export const queryApi = {
  format: (sql: string) =>
    apiRequest<FormatQueryResponse>("/query/format", {
      method: "POST",
      body: { sql_query: sql },
    }),
};

export const insightsApi = {
  generate: (payload: InsightRequest) =>
    apiRequest<InsightResponse>("/insights/generate", { method: "POST", body: payload }),
};

export const feedbackApi = {
  create: (payload: FeedbackCreate) =>
    apiRequest<FeedbackResponse>("/feedback/", { method: "POST", body: payload }),
};

export const metricsApi = {
  list: (connectionId: number) =>
    apiRequest<Metric[]>(`/metrics/?connection_id=${connectionId}`),

  create: (payload: MetricCreate) =>
    apiRequest<Metric>("/metrics/", { method: "POST", body: payload }),

  update: (metricId: number, payload: MetricUpdate) =>
    apiRequest<Metric>(`/metrics/${metricId}`, { method: "PUT", body: payload }),

  delete: (metricId: number) =>
    apiRequest<{ message: string }>(`/metrics/${metricId}`, { method: "DELETE" }),

  preview: (
    metricId: number,
    body: { question?: string; execute?: boolean },
  ) =>
    apiRequest<MetricPreviewResponse>(`/metrics/${metricId}/preview`, {
      method: "POST",
      body,
    }),
};

export const auditApi = {
  list: (params?: { page?: number; limit?: number; connection_id?: number; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.connection_id) q.set("connection_id", String(params.connection_id));
    if (params?.status) q.set("status", params.status);
    const qs = q.toString();
    return apiRequest<AuditLog[]>(`/audit/${qs ? `?${qs}` : ""}`);
  },

  get: (auditId: number) => apiRequest<AuditLog>(`/audit/${auditId}`),

  replay: (auditId: number) =>
    apiRequest<AuditReplayResponse>(`/audit/${auditId}/replay`, { method: "POST" }),
};
