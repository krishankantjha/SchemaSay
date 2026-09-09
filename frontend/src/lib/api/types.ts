export type User = {
  id: number;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
};

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  email: string;
  password: string;
  full_name?: string;
};

export type Connection = {
  id: number;
  user_id: number;
  name: string;
  db_type: string;
  host: string | null;
  port: number | null;
  username: string | null;
  database_name: string;
  created_at: string;
  updated_at: string;
};

export type ConnectionCreate = {
  name: string;
  db_type: string;
  database_name: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
};

export type ConnectionTest = {
  db_type: string;
  database_name: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
};

export type ConnectionTestResponse = {
  message: string;
};

export type SchemaColumnNode = {
  name: string;
  data_type: string;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  fk_references: string | null;
  is_nullable: boolean | null;
  null_ratio: number | null;
  distinct_count: number | null;
  sample_values: string[] | null;
  is_pii: boolean;
};

export type SchemaTableNode = {
  name: string;
  row_count: number | null;
  columns: SchemaColumnNode[];
};

export type SchemaTreeResponse = {
  connection_id: number;
  tables: SchemaTableNode[];
};

export type SchemaSyncResponse = {
  message: string;
  tables_synced: number;
  columns_synced: number;
  tables_profiled?: number;
};

export type ChartConfig = {
  chart_type: string;
  x_axis?: string | null;
  y_axis?: string | null;
  color_axis?: string | null;
};

export type QueryExplanation = {
  summary: string;
  assumptions: string[];
  tables_used: string[];
  joins: { from_column: string; to_column: string }[];
  confidence: number;
  warnings: string[];
  grounded: boolean;
  unknown_tables: string[];
  unknown_columns: string[];
  resolution_source: string | null;
  metric_id: number | null;
  metric_name: string | null;
  metric_label: string | null;
  learning_examples_used: number;
  llm_provider?: string | null;
  llm_model?: string | null;
};

export type QueryResponse = {
  sql: string;
  success: boolean;
  error: string | null;
  results: Record<string, unknown>[] | null;
  execution_duration_ms: number;
  chart_config: ChartConfig;
  explanation: QueryExplanation | null;
  correlation_id: string | null;
};

export type FeedbackCreate = {
  connection_id: number;
  rating: "thumbs_up" | "thumbs_down" | "corrected";
  question?: string;
  generated_sql?: string;
  corrected_sql?: string;
  comment?: string;
};

export type FeedbackResponse = {
  id: number;
  connection_id: number;
  rating: string;
  created_at: string;
};

export type ConnectionPolicy = {
  connection_id: number;
  blocked_tables: string[];
  blocked_columns: string[];
  require_high_confidence: boolean;
  min_confidence_threshold: number;
  block_pii_access: boolean;
  updated_at: string | null;
};

export type ConnectionPolicyUpdate = {
  blocked_tables: string[];
  blocked_columns: string[];
  require_high_confidence: boolean;
  min_confidence_threshold: number;
  block_pii_access: boolean;
};

export type AuditLog = {
  id: number;
  user_id: number;
  connection_id: number | null;
  question: string;
  sql_query: string;
  execution_duration_ms: number | null;
  status: string;
  error_message: string | null;
  correlation_id: string | null;
  confidence_score: number | null;
  grounded: boolean | null;
  tables_accessed: string[];
  row_count: number | null;
  resolution_source: string | null;
  metric_id: number | null;
  created_at: string;
};

export type AuditReplayResponse = {
  audit_id: number;
  sql: string;
  success: boolean;
  results: Record<string, unknown>[] | null;
  execution_duration_ms: number;
  error: string | null;
};

export type MetricDimension = {
  name: string;
  label: string;
  column_ref: string;
  dimension_type: "category" | "time";
};

export type Metric = {
  id: number;
  connection_id: number;
  name: string;
  label: string;
  description: string | null;
  sql_expression: string;
  base_table: string;
  default_filters: string | null;
  dimensions: MetricDimension[];
  created_at: string;
  updated_at: string;
};

export type MetricCreate = {
  connection_id: number;
  name: string;
  label: string;
  description?: string;
  sql_expression: string;
  base_table: string;
  default_filters?: string;
  dimensions?: MetricDimension[];
};

export type MetricUpdate = Partial<Omit<MetricCreate, "connection_id" | "name">>;

export type MetricPreviewResponse = {
  metric_id: number;
  metric_name: string;
  sql: string;
  match_score: number;
  dimensions_used: string[];
  assumptions: string[];
  results?: Record<string, unknown>[] | null;
  execution_duration_ms?: number | null;
};

export type FormatQueryResponse = {
  formatted_sql: string;
};

export type InsightRequest = {
  question: string;
  sql_query: string;
  columns: string[];
  rows: Record<string, unknown>[];
};

export type LLMUsageStats = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  execution_time_ms: number;
  provider?: string | null;
  model?: string | null;
};

export type InsightResponse = {
  insight: string;
  success: boolean;
  error: string | null;
  correlation_id: string | null;
  usage_stats: LLMUsageStats | null;
};
