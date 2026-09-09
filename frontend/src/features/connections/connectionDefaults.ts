export type ServerDbType = "postgresql" | "mysql" | "mssql";

export type ConnectionTab = "sqlite" | "server" | "upload";

export const SERVER_DB_OPTIONS: { value: ServerDbType; label: string; port: number }[] = [
  { value: "postgresql", label: "PostgreSQL", port: 5432 },
  { value: "mysql", label: "MySQL", port: 3306 },
  { value: "mssql", label: "SQL Server", port: 1433 },
];

export function defaultPortForDbType(dbType: ServerDbType): number {
  return SERVER_DB_OPTIONS.find((o) => o.value === dbType)?.port ?? 5432;
}
