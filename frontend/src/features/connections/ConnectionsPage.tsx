import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Cloud,
  Database,
  FileSpreadsheet,
  HardDrive,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useToast } from "@/app/ToastContext";
import { ApiError } from "@/lib/api/client";
import { connectionsApi, schemaApi } from "@/lib/api/endpoints";
import type { Connection, ConnectionCreate, ConnectionTest } from "@/lib/api/types";
import { useConnection } from "@/features/connections/ConnectionContext";
import {
  defaultPortForDbType,
  SERVER_DB_OPTIONS,
  type ConnectionTab,
  type ServerDbType,
} from "@/features/connections/connectionDefaults";
import { OnboardingBanner } from "@/features/onboarding/OnboardingBanner";
import { useOnboardingStatus } from "@/features/onboarding/useOnboardingStatus";
import { formatDbType, formatRelativeTime } from "@/lib/utils";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";
import { QueryError } from "@/components/ui/QueryError";
import { PageListSkeleton } from "@/components/ui/Skeleton";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Tooltip } from "@/components/ui/Tooltip";
import { ConnectionAliasesSection } from "@/features/connections/ConnectionAliasesSection";
import { cn } from "@/lib/utils";

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const SOURCES: {
  id: ConnectionTab;
  title: string;
  description: string;
  icon: typeof Database;
}[] = [
  { id: "sqlite", title: "SQLite", description: "Local .db file on this machine", icon: HardDrive },
  { id: "server", title: "Server database", description: "PostgreSQL, MySQL, or SQL Server", icon: Cloud },
  { id: "upload", title: "Spreadsheet", description: "CSV or Excel imported locally", icon: FileSpreadsheet },
];

function TestResultBanner({ testState }: { testState: TestState }) {
  if (testState.status === "idle" || testState.status === "testing") return null;
  if (testState.status === "success") {
    return <Alert variant="success">{testState.message}</Alert>;
  }
  return <Alert variant="danger">{testState.message}</Alert>;
}

function ConnectionTestPipeline({ testState }: { testState: TestState }) {
  const steps = [
    { id: "reach", label: "Reachable" },
    { id: "auth", label: "Authenticated" },
    { id: "db", label: "Database found" },
  ];
  const statusFor = (index: number): "pending" | "running" | "pass" | "fail" => {
    if (testState.status === "idle") return "pending";
    if (testState.status === "testing") return index === 0 ? "running" : "pending";
    if (testState.status === "success") return "pass";
    return index === 0 ? "fail" : "pending";
  };

  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0" aria-label="Connection validation">
      {steps.map((step, index) => {
        const status = statusFor(index);
        return (
          <li key={step.id} className="flex min-w-0 items-center gap-2 sm:flex-1">
            {index > 0 ? (
              <span
                className={cn(
                  "hidden h-px flex-1 sm:block",
                  status === "pass" || testState.status === "success" ? "bg-success/50" : "bg-border-subtle",
                )}
                aria-hidden
              />
            ) : null}
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border text-[10px]",
                  status === "pass" && "border-success/40 bg-[var(--color-success-muted)] text-success",
                  status === "running" && "border-accent/40 bg-accent-muted text-accent",
                  status === "fail" && "border-danger/40 bg-[var(--color-danger-muted)] text-danger",
                  status === "pending" && "border-border-subtle text-text-muted",
                )}
              >
                {status === "pass" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                ) : status === "running" ? (
                  <Loader2 className="h-3 w-3 motion-safe:animate-spin" aria-hidden />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-border-default" aria-hidden />
                )}
              </span>
              <span
                className={cn(
                  "text-xs",
                  status === "running" ? "font-medium text-text-primary" : status === "pass" ? "text-text-secondary" : "text-text-muted",
                )}
              >
                {step.label}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function ConnectionsPage() {
  const { push: toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const isWelcome = searchParams.get("welcome") === "1";
  const {
    connections,
    activeConnectionId,
    setActiveConnectionId,
    refreshConnections,
    isLoading: connectionsLoading,
    isError: connectionsError,
  } = useConnection();
  const { steps, tableCount, hasSchema } = useOnboardingStatus();

  const [tab, setTab] = useState<ConnectionTab>("sqlite");
  const [error, setError] = useState("");
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [justConnectedId, setJustConnectedId] = useState<number | null>(null);

  const [sqliteName, setSqliteName] = useState("");
  const [sqlitePath, setSqlitePath] = useState("");
  const [sqliteTest, setSqliteTest] = useState<TestState>({ status: "idle" });

  const [serverName, setServerName] = useState("");
  const [serverDbType, setServerDbType] = useState<ServerDbType>("postgresql");
  const [serverHost, setServerHost] = useState("localhost");
  const [serverPort, setServerPort] = useState(String(defaultPortForDbType("postgresql")));
  const [serverUsername, setServerUsername] = useState("");
  const [serverPassword, setServerPassword] = useState("");
  const [serverDatabase, setServerDatabase] = useState("");
  const [serverTest, setServerTest] = useState<TestState>({ status: "idle" });

  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  function handleServerTypeChange(next: ServerDbType) {
    setServerDbType(next);
    setServerPort(String(defaultPortForDbType(next)));
    setServerTest({ status: "idle" });
  }

  function buildSqlitePayload(): ConnectionTest {
    return { db_type: "sqlite", database_name: sqlitePath.trim() };
  }

  function buildServerPayload(): ConnectionTest {
    return {
      db_type: serverDbType,
      host: serverHost.trim(),
      port: Number(serverPort),
      username: serverUsername.trim(),
      password: serverPassword,
      database_name: serverDatabase.trim(),
    };
  }

  function buildServerCreatePayload(): ConnectionCreate {
    return {
      name: serverName.trim(),
      ...buildServerPayload(),
    };
  }

  async function runTest(payload: ConnectionTest, setTest: (s: TestState) => void) {
    setError("");
    setTest({ status: "testing" });
    try {
      const res = await connectionsApi.test(payload);
      setTest({ status: "success", message: res.message });
    } catch (err) {
      setTest({
        status: "error",
        message: err instanceof ApiError ? err.detail : "Connection test failed",
      });
    }
  }

  const createConnection = useMutation({
    mutationFn: (payload: ConnectionCreate) => connectionsApi.create(payload),
    onSuccess: async (conn) => {
      setJustConnectedId(conn.id);
      setActiveConnectionId(conn.id);
      await refreshConnections();
      await queryClient.invalidateQueries({ queryKey: ["schema-tree", conn.id] });
      setSqliteName("");
      setSqlitePath("");
      setServerName("");
      setServerHost("localhost");
      setServerPort(String(defaultPortForDbType(serverDbType)));
      setServerUsername("");
      setServerPassword("");
      setServerDatabase("");
      setSqliteTest({ status: "idle" });
      setServerTest({ status: "idle" });
      toast("Connection added", "success");
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.detail : "Failed to create connection"),
  });

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!uploadFile) throw new Error("Choose a file");
      return connectionsApi.upload(uploadName, uploadFile);
    },
    onSuccess: async (conn) => {
      setJustConnectedId(conn.id);
      setUploadName("");
      setUploadFile(null);
      setActiveConnectionId(conn.id);
      await refreshConnections();
      await queryClient.invalidateQueries({ queryKey: ["schema-tree", conn.id] });
      toast("Connection added", "success");
    },
    onError: (err) => setError(err instanceof ApiError ? err.detail : "Upload failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => connectionsApi.delete(id),
    onSuccess: async () => {
      setJustConnectedId(null);
      await queryClient.invalidateQueries({ queryKey: ["connections"] });
      await refreshConnections();
      toast("Connection removed", "success");
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.detail : "Failed to remove connection");
      toast("Could not remove connection", "error");
    },
  });

  function handleRemoveConnection(conn: Connection) {
    const isUpload = conn.db_type === "file_upload";
    const message = isUpload
      ? `Remove "${conn.name}"? This deletes the uploaded file from SchemaSay and clears the cached schema.`
      : `Remove "${conn.name}"? This disconnects it from SchemaSay. Your original database file on disk is not deleted.`;

    if (!window.confirm(message)) return;
    deleteMutation.mutate(conn.id);
  }

  async function handleSync(connectionId: number, profile: boolean) {
    setError("");
    setSyncingId(connectionId);
    try {
      await schemaApi.sync(connectionId, profile);
      await queryClient.invalidateQueries({ queryKey: ["schema-tree", connectionId] });
      toast(profile ? "Deep sync complete" : "Schema synced", "success");
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Sync failed");
      toast("Sync failed", "error");
    } finally {
      setSyncingId(null);
    }
  }

  function handleSqliteTest(e: FormEvent) {
    e.preventDefault();
    void runTest(buildSqlitePayload(), setSqliteTest);
  }

  function handleSqliteSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (sqliteTest.status !== "success") {
      setError("Test the SQLite file before saving the connection.");
      return;
    }
    createConnection.mutate({
      name: sqliteName.trim(),
      db_type: "sqlite",
      database_name: sqlitePath.trim(),
    });
  }

  function handleServerTest(e: FormEvent) {
    e.preventDefault();
    void runTest(buildServerPayload(), setServerTest);
  }

  function handleServerSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (serverTest.status !== "success") {
      setError("Test the server connection before saving.");
      return;
    }
    createConnection.mutate(buildServerCreatePayload());
  }

  function handleUploadSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    uploadMutation.mutate();
  }

  const showPostConnectCta = justConnectedId !== null;
  const sqliteCanSave = sqliteTest.status === "success" && sqliteName.trim().length > 0;
  const serverCanSave =
    serverTest.status === "success" &&
    serverName.trim().length > 0 &&
    serverHost.trim().length > 0 &&
    serverDatabase.trim().length > 0;

  return (
    <PageShell width="narrow">
      <OnboardingBanner />

      <PageHeader
        title="Connections"
        description={
          isWelcome
            ? "Step 1 of 3 — connect a data source, test it, then sync schema before asking questions."
            : "Guided setup for a database or spreadsheet. Test, validate, then sync schema."
        }
      />

      {error ? <Alert variant="danger">{error}</Alert> : null}

      {showPostConnectCta ? (
        <Card className="border-success/30 bg-success/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-text-primary">Connection ready</p>
              <p className="mt-0.5 text-sm text-text-secondary">
                {tableCount > 0
                  ? `Schema cached with ${tableCount} table${tableCount === 1 ? "" : "s"}. Explore your schema, then ask your first question.`
                  : "Run Sync to load your schema, then explore tables before asking questions."}
              </p>
            </div>
            {tableCount > 0 ? (
              <Link to="/schema">
                <Button>
                  Explore schema
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Button
                onClick={() => justConnectedId && void handleSync(justConnectedId, false)}
                disabled={syncingId === justConnectedId}
              >
                {syncingId === justConnectedId ? (
                  <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sync now
              </Button>
            )}
          </div>
        </Card>
      ) : null}

      <section>
        <p className="type-meta mb-3">Choose a source</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {SOURCES.map(({ id, title, description, icon: Icon }) => {
            const selected = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "rounded-[var(--radius-md)] border p-4 text-left transition-colors",
                  selected
                    ? "border-accent/40 bg-accent-muted/40 shadow-sm"
                    : "border-border-subtle bg-bg-surface hover:border-border-default hover:bg-bg-elevated",
                )}
              >
                <Icon className={cn("icon-md", selected ? "text-accent" : "text-text-muted")} strokeWidth={2} aria-hidden />
                <p className="mt-2 text-sm font-medium text-text-primary">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-text-muted">{description}</p>
              </button>
            );
          })}
        </div>
      </section>

      {tab === "sqlite" ? (
        <Card>
          <CardHeader>
            <CardTitle>SQLite database</CardTitle>
            <CardDescription>Point to a local .db file using an absolute path, then test before saving.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSqliteSubmit} className="space-y-4">
            <SetupSteps current={sqliteTest.status === "success" ? 2 : sqlitePath.trim() ? 1 : 0} labels={["Configure", "Test", "Save"]} />
            <div>
              <Label htmlFor="sqlite-name">Connection name</Label>
              <Input
                id="sqlite-name"
                value={sqliteName}
                onChange={(e) => setSqliteName(e.target.value)}
                placeholder="My analytics DB"
                required
              />
            </div>
            <div>
              <Label htmlFor="sqlite-path">File path</Label>
              <Input
                id="sqlite-path"
                value={sqlitePath}
                onChange={(e) => {
                  setSqlitePath(e.target.value);
                  setSqliteTest({ status: "idle" });
                }}
                placeholder="C:\data\sample.db"
                required
              />
            </div>
            <ConnectionTestPipeline testState={sqliteTest} />
            <TestResultBanner testState={sqliteTest} />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={!sqlitePath.trim() || sqliteTest.status === "testing"}
                onClick={handleSqliteTest}
              >
                {sqliteTest.status === "testing" ? (
                  <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
                ) : null}
                Test connection
              </Button>
              <Tooltip content={sqliteCanSave ? "Save this validated connection" : "Test successfully before saving"}>
                <span>
                  <Button type="submit" disabled={!sqliteCanSave || createConnection.isPending}>
                    {createConnection.isPending ? "Connecting…" : "Save connection"}
                  </Button>
                </span>
              </Tooltip>
            </div>
          </form>
        </Card>
      ) : null}

      {tab === "server" ? (
        <Card>
          <CardHeader>
            <CardTitle>Server database</CardTitle>
            <CardDescription>PostgreSQL, MySQL, or SQL Server. Test credentials before they are stored.</CardDescription>
          </CardHeader>
          <form onSubmit={handleServerSubmit} className="space-y-4">
            <SetupSteps current={serverTest.status === "success" ? 2 : serverHost.trim() ? 1 : 0} labels={["Configure", "Test", "Save"]} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="server-name">Connection name</Label>
                <Input
                  id="server-name"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="Production warehouse"
                  required
                />
              </div>
              <div>
                <Label htmlFor="server-type">Database type</Label>
                <select
                  id="server-type"
                  value={serverDbType}
                  onChange={(e) => handleServerTypeChange(e.target.value as ServerDbType)}
                  className="control-base w-full px-3 text-sm"
                >
                  {SERVER_DB_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <div>
                <Label htmlFor="server-host">Host</Label>
                <Input
                  id="server-host"
                  value={serverHost}
                  onChange={(e) => {
                    setServerHost(e.target.value);
                    setServerTest({ status: "idle" });
                  }}
                  placeholder="localhost"
                  required
                />
              </div>
              <div>
                <Label htmlFor="server-port">Port</Label>
                <Input
                  id="server-port"
                  type="number"
                  min={1}
                  max={65535}
                  value={serverPort}
                  onChange={(e) => {
                    setServerPort(e.target.value);
                    setServerTest({ status: "idle" });
                  }}
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="server-user">Username</Label>
                <Input
                  id="server-user"
                  value={serverUsername}
                  onChange={(e) => {
                    setServerUsername(e.target.value);
                    setServerTest({ status: "idle" });
                  }}
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <Label htmlFor="server-password">Password</Label>
                <PasswordInput
                  id="server-password"
                  value={serverPassword}
                  onChange={(e) => {
                    setServerPassword(e.target.value);
                    setServerTest({ status: "idle" });
                  }}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="server-database">Database name</Label>
              <Input
                id="server-database"
                value={serverDatabase}
                onChange={(e) => {
                  setServerDatabase(e.target.value);
                  setServerTest({ status: "idle" });
                }}
                placeholder="analytics"
                required
              />
            </div>
            <ConnectionTestPipeline testState={serverTest} />
            <TestResultBanner testState={serverTest} />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={
                  !serverHost.trim() ||
                  !serverDatabase.trim() ||
                  !serverUsername.trim() ||
                  serverTest.status === "testing"
                }
                onClick={handleServerTest}
              >
                {serverTest.status === "testing" ? (
                  <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
                ) : null}
                Test connection
              </Button>
              <Tooltip content={serverCanSave ? "Save this validated connection" : "Test successfully before saving"}>
                <span>
                  <Button type="submit" disabled={!serverCanSave || createConnection.isPending}>
                    {createConnection.isPending ? "Connecting…" : "Save connection"}
                  </Button>
                </span>
              </Tooltip>
            </div>
          </form>
        </Card>
      ) : null}

      {tab === "upload" ? (
        <Card>
          <CardHeader>
            <CardTitle>Upload spreadsheet</CardTitle>
            <CardDescription>CSV or Excel — imported into a local SQLite table. Max 10 MB.</CardDescription>
          </CardHeader>
          <form onSubmit={handleUploadSubmit} className="space-y-4">
            <SetupSteps current={uploadFile ? 1 : 0} labels={["Name", "Choose file", "Upload"]} />
            <div>
              <Label htmlFor="upload-name">Connection name</Label>
              <Input
                id="upload-name"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="Sales data"
                required
              />
            </div>
            <div>
              <Label htmlFor="upload-file">File</Label>
              <FileDropzone
                id="upload-file"
                file={uploadFile}
                onFile={setUploadFile}
                disabled={uploadMutation.isPending}
              />
            </div>
            <Button type="submit" disabled={uploadMutation.isPending || !uploadFile || !uploadName.trim()}>
              {uploadMutation.isPending ? "Uploading…" : "Upload & connect"}
            </Button>
          </form>
        </Card>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="type-heading">Your connections</h2>
          <p className="mt-0.5 text-xs text-text-muted">
            Status shows whether schema is cached. Remove disconnects SchemaSay without deleting your original database.
          </p>
        </div>
        {connectionsError ? (
          <QueryError
            message="Could not load your connections."
            onRetry={() => void refreshConnections()}
          />
        ) : connectionsLoading ? (
          <PageListSkeleton rows={3} />
        ) : !connections.length ? (
          <Card>
            <p className="text-sm text-text-muted">
              No connections yet. Pick a source above to add your first data source.
            </p>
          </Card>
        ) : (
          connections.map((conn) => {
            const isActive = conn.id === activeConnectionId;
            const isNew = conn.id === justConnectedId;
            return (
              <Card
                key={conn.id}
                className={cn(
                  "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
                  isActive && "border-accent/30",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-muted">
                    <Database className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-text-primary">{conn.name}</span>
                      <Badge variant="accent">{formatDbType(conn.db_type)}</Badge>
                      {isActive ? <Badge>Active</Badge> : null}
                      {isNew ? <Badge variant="accent">New</Badge> : null}
                      <ConnectionSchemaBadge connectionId={conn.id} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-text-muted">
                      {conn.database_name}
                      {conn.updated_at ? ` · ${formatRelativeTime(conn.updated_at)}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Tooltip content="Refresh tables and columns">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleSync(conn.id, false)}
                      disabled={syncingId === conn.id}
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${syncingId === conn.id ? "motion-safe:animate-spin" : ""}`}
                      />
                      Sync
                    </Button>
                  </Tooltip>
                  <Tooltip content="Also profile null ratios and samples">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleSync(conn.id, true)}
                      disabled={syncingId === conn.id}
                    >
                      Deep sync
                    </Button>
                  </Tooltip>
                  {!isActive ? (
                    <Button variant="ghost" size="sm" onClick={() => setActiveConnectionId(conn.id)}>
                      Use
                    </Button>
                  ) : null}
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleRemoveConnection(conn)}
                    disabled={deleteMutation.isPending}
                    title="Remove this connection from SchemaSay"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </section>

      {activeConnectionId ? (
        <ConnectionAliasesSection
          connectionId={activeConnectionId}
          connectionName={connections.find((conn) => conn.id === activeConnectionId)?.name ?? "this connection"}
        />
      ) : null}

      {!hasSchema && connections.length > 0 ? (
        <Card className="border-accent/20 bg-accent-muted/20">
          <p className="text-sm text-text-secondary">
            <strong className="text-text-primary">Next:</strong> Run{" "}
            <strong>Sync</strong> on your connection to load tables for the schema explorer. Use{" "}
            <strong>Deep sync</strong> to profile columns (null ratios, samples).
          </p>
        </Card>
      ) : !steps.explore && hasSchema ? (
        <Card className="border-accent/20 bg-accent-muted/20">
          <p className="text-sm text-text-secondary">
            <strong className="text-text-primary">Next:</strong> Open the{" "}
            <Link to="/schema" className="font-medium text-accent">
              schema explorer
            </Link>{" "}
            to browse tables and columns before asking questions.
          </p>
        </Card>
      ) : null}
    </PageShell>
  );
}

function SetupSteps({ current, labels }: { current: number; labels: string[] }) {
  return (
    <ol className="flex items-center gap-2 text-[11px]" aria-label="Setup steps">
      {labels.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} className="flex items-center gap-2">
            {index > 0 ? <span className="h-px w-4 bg-border-subtle" aria-hidden /> : null}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-medium",
                done && "bg-[var(--color-success-muted)] text-success",
                active && "bg-accent-muted text-accent",
                !done && !active && "bg-bg-elevated text-text-muted",
              )}
            >
              {index + 1}. {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ConnectionSchemaBadge({ connectionId }: { connectionId: number }) {
  const { data } = useQuery({
    queryKey: ["schema-tree", connectionId],
    queryFn: () => schemaApi.tree(connectionId),
    staleTime: 60_000,
  });
  const count = data?.tables.length ?? 0;
  if (count > 0) {
    return (
      <Badge variant="success">
        {count} table{count === 1 ? "" : "s"}
      </Badge>
    );
  }
  return <Badge>Needs sync</Badge>;
}
