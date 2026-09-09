import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  Upload,
} from "lucide-react";
import { useToast } from "@/app/ToastContext";
import { ApiError } from "@/lib/api/client";
import { connectionsApi, schemaApi } from "@/lib/api/endpoints";
import type { ConnectionCreate, ConnectionTest } from "@/lib/api/types";
import { useConnection } from "@/features/connections/ConnectionContext";
import {
  defaultPortForDbType,
  SERVER_DB_OPTIONS,
  type ConnectionTab,
  type ServerDbType,
} from "@/features/connections/connectionDefaults";
import { OnboardingBanner } from "@/features/onboarding/OnboardingBanner";
import { useOnboardingStatus } from "@/features/onboarding/useOnboardingStatus";
import { formatDbType } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Badge } from "@/components/ui/Badge";
import { PasswordInput } from "@/components/ui/PasswordInput";

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const TABS: { id: ConnectionTab; label: string; icon: typeof Database }[] = [
  { id: "sqlite", label: "SQLite", icon: HardDrive },
  { id: "server", label: "Server DB", icon: Cloud },
  { id: "upload", label: "Upload", icon: FileSpreadsheet },
];

function TestResultBanner({ testState }: { testState: TestState }) {
  if (testState.status === "idle" || testState.status === "testing") return null;

  if (testState.status === "success") {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        {testState.message}
      </p>
    );
  }

  return (
    <p className="rounded-lg border border-danger/30 bg-[var(--color-danger-muted)] px-3 py-2 text-sm text-danger">
      {testState.message}
    </p>
  );
}

export function ConnectionsPage() {
  const { push: toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const isWelcome = searchParams.get("welcome") === "1";
  const { connections, activeConnectionId, setActiveConnectionId, refreshConnections } =
    useConnection();
  const { steps, tableCount } = useOnboardingStatus();

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

  function handleRemoveConnection(conn: (typeof connections)[number]) {
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
    createConnection.mutate(buildServerCreatePayload());
  }

  function handleUploadSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    uploadMutation.mutate();
  }

  const showPostConnectCta = justConnectedId !== null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <OnboardingBanner />

      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Connections</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {isWelcome
            ? "Step 1 of 3 — connect a data source. SchemaSay will cache your schema automatically."
            : "Connect a database, sync schema, then ask questions in plain English."}
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-danger/30 bg-[var(--color-danger-muted)] px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {showPostConnectCta ? (
        <Card className="border-success/30 bg-success/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-text-primary">Connection ready</p>
              <p className="mt-0.5 text-sm text-text-secondary">
                {tableCount > 0
                  ? `Schema cached with ${tableCount} table${tableCount === 1 ? "" : "s"}. Head to Ask to run your first question.`
                  : "Schema is syncing in the background. Run Sync if tables don't appear, then head to Ask."}
              </p>
            </div>
            {tableCount > 0 ? (
              <Link to="/ask">
                <Button>
                  Continue to Ask
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Button
                onClick={() => justConnectedId && void handleSync(justConnectedId, false)}
                disabled={syncingId === justConnectedId}
              >
                {syncingId === justConnectedId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sync now
              </Button>
            )}
          </div>
        </Card>
      ) : null}

      <div className="flex gap-1 rounded-lg border border-border-subtle bg-bg-surface p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={[
              "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              tab === id
                ? "bg-accent-muted text-accent shadow-sm"
                : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary",
            ].join(" ")}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {tab === "sqlite" ? (
        <Card>
          <CardHeader>
            <CardTitle>SQLite database</CardTitle>
            <CardDescription>Point to a local .db file using an absolute path.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSqliteSubmit} className="space-y-4">
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
            <TestResultBanner testState={sqliteTest} />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={!sqlitePath.trim() || sqliteTest.status === "testing"}
                onClick={handleSqliteTest}
              >
                {sqliteTest.status === "testing" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Test connection
              </Button>
              <Button type="submit" disabled={createConnection.isPending}>
                {createConnection.isPending ? "Connecting…" : "Save connection"}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {tab === "server" ? (
        <Card>
          <CardHeader>
            <CardTitle>Server database</CardTitle>
            <CardDescription>PostgreSQL, MySQL, or SQL Server over the network.</CardDescription>
          </CardHeader>
          <form onSubmit={handleServerSubmit} className="space-y-4">
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
                  className="h-10 w-full rounded-md border border-border-default bg-bg-elevated px-3 text-sm text-text-primary focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-accent/20"
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
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Test connection
              </Button>
              <Button type="submit" disabled={createConnection.isPending}>
                {createConnection.isPending ? "Connecting…" : "Save connection"}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {tab === "upload" ? (
        <Card>
          <CardHeader>
            <CardTitle>Upload spreadsheet</CardTitle>
            <CardDescription>CSV or Excel — imported into a local SQLite table.</CardDescription>
          </CardHeader>
          <form onSubmit={handleUploadSubmit} className="space-y-4">
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
              <Input
                id="upload-file"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                required
              />
            </div>
            <Button type="submit" disabled={uploadMutation.isPending || !uploadFile}>
              <Upload className="h-4 w-4" />
              {uploadMutation.isPending ? "Uploading…" : "Upload & connect"}
            </Button>
          </form>
        </Card>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Your connections</h2>
          <p className="mt-0.5 text-xs text-text-muted">
            Use <strong className="font-medium text-text-secondary">Remove</strong> to disconnect a
            database from SchemaSay.
          </p>
        </div>
        {!connections.length ? (
          <Card>
            <p className="text-sm text-text-muted">
              No connections yet. Pick a tab above to add your first data source.
            </p>
          </Card>
        ) : (
          connections.map((conn) => {
            const isActive = conn.id === activeConnectionId;
            const isNew = conn.id === justConnectedId;
            return (
              <Card
                key={conn.id}
                className={[
                  "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
                  isActive ? "border-accent/30" : "",
                ].join(" ")}
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
                    </div>
                    <p className="mt-0.5 truncate text-xs text-text-muted">{conn.database_name}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleSync(conn.id, false)}
                    disabled={syncingId === conn.id}
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${syncingId === conn.id ? "animate-spin" : ""}`}
                    />
                    Sync
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleSync(conn.id, true)}
                    disabled={syncingId === conn.id}
                  >
                    Deep sync
                  </Button>
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

      {!steps.sync && connections.length > 0 ? (
        <Card className="border-accent/20 bg-accent-muted/20">
          <p className="text-sm text-text-secondary">
            <strong className="text-text-primary">Step 2:</strong> Run{" "}
            <strong>Sync</strong> on your connection if tables don&apos;t appear in Ask. Use{" "}
            <strong>Deep sync</strong> to profile columns (null ratios, samples).
          </p>
        </Card>
      ) : null}
    </div>
  );
}
