import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Loader2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/app/ToastContext";
import { ApiError } from "@/lib/api/client";
import { connectionsApi, schemaApi } from "@/lib/api/endpoints";
import type { SchemaAlias, SchemaAliasType } from "@/lib/api/types";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { QueryError } from "@/components/ui/QueryError";
import { PageListSkeleton } from "@/components/ui/Skeleton";

type ConnectionAliasesSectionProps = {
  connectionId: number;
  connectionName: string;
};

export function ConnectionAliasesSection({
  connectionId,
  connectionName,
}: ConnectionAliasesSectionProps) {
  const { push: toast } = useToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [aliasType, setAliasType] = useState<SchemaAliasType>("table");
  const [aliasToken, setAliasToken] = useState("");
  const [targetTable, setTargetTable] = useState("");
  const [targetColumn, setTargetColumn] = useState("");

  const aliasesQuery = useQuery({
    queryKey: ["connection-aliases", connectionId],
    queryFn: () => connectionsApi.listAliases(connectionId),
  });

  const schemaQuery = useQuery({
    queryKey: ["schema-tree", connectionId],
    queryFn: () => schemaApi.tree(connectionId),
  });

  const tableNames = useMemo(
    () => schemaQuery.data?.tables.map((table) => table.name) ?? [],
    [schemaQuery.data],
  );

  const columnOptions = useMemo(() => {
    const table = schemaQuery.data?.tables.find((entry) => entry.name === targetTable);
    return table?.columns.map((column) => column.name) ?? [];
  }, [schemaQuery.data, targetTable]);

  useEffect(() => {
    if (!targetTable && tableNames.length > 0) {
      setTargetTable(tableNames[0]);
    }
  }, [tableNames, targetTable]);

  useEffect(() => {
    if (aliasType === "column" && columnOptions.length > 0 && !columnOptions.includes(targetColumn)) {
      setTargetColumn(columnOptions[0]);
    }
    if (aliasType === "table") {
      setTargetColumn("");
    }
  }, [aliasType, columnOptions, targetColumn]);

  const createMutation = useMutation({
    mutationFn: () =>
      connectionsApi.createAlias(connectionId, {
        alias_type: aliasType,
        alias_token: aliasToken.trim(),
        target_table: targetTable,
        ...(aliasType === "column" ? { target_column: targetColumn } : {}),
      }),
    onSuccess: async () => {
      setAliasToken("");
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["connection-aliases", connectionId] });
      toast("Alias added", "success");
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.detail : "Failed to add alias");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (aliasId: number) => connectionsApi.deleteAlias(connectionId, aliasId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["connection-aliases", connectionId] });
      toast("Alias removed", "success");
    },
    onError: (err) => {
      toast(err instanceof ApiError ? err.detail : "Failed to remove alias", "error");
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!aliasToken.trim()) {
      setError("Enter the word people might say in a question.");
      return;
    }
    if (!targetTable) {
      setError("Choose a target table from your synced schema.");
      return;
    }
    if (aliasType === "column" && !targetColumn) {
      setError("Choose a target column.");
      return;
    }
    createMutation.mutate();
  }

  const hasSchema = tableNames.length > 0;
  const aliases = aliasesQuery.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business language aliases</CardTitle>
        <CardDescription>
          Teach SchemaSay how {connectionName} talks about data. Map terms like{" "}
          <span className="font-medium text-text-primary">buyer</span> to real tables and columns.
        </CardDescription>
      </CardHeader>

      {aliasesQuery.isError ? (
        <QueryError
          message="Could not load aliases."
          onRetry={() => void aliasesQuery.refetch()}
        />
      ) : aliasesQuery.isLoading ? (
        <PageListSkeleton rows={2} />
      ) : (
        <div className="space-y-4">
          {!hasSchema ? (
            <Alert variant="warning">
              Sync schema for this connection before adding aliases. Aliases must point at tables and
              columns from your cached schema.
            </Alert>
          ) : null}

          {aliases.length > 0 ? (
            <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border-subtle">
              <table className="min-w-full text-sm">
                <thead className="bg-bg-elevated text-left text-xs text-text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">When someone says</th>
                    <th className="px-3 py-2 font-medium">Maps to</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {aliases.map((alias) => (
                    <AliasRow
                      key={alias.id}
                      alias={alias}
                      onDelete={() => deleteMutation.mutate(alias.id)}
                      deleting={deleteMutation.isPending}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-text-muted">
              No aliases yet. Add one below so natural-language questions match your schema more
              reliably.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 border-t border-border-subtle pt-4">
            <p className="text-sm font-medium text-text-primary">Add alias</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="alias-type">Alias type</Label>
                <select
                  id="alias-type"
                  value={aliasType}
                  onChange={(event) => setAliasType(event.target.value as SchemaAliasType)}
                  className="control-base w-full px-3 text-sm"
                  disabled={!hasSchema || createMutation.isPending}
                >
                  <option value="table">Table</option>
                  <option value="column">Column</option>
                </select>
              </div>
              <div>
                <Label htmlFor="alias-token">When someone says</Label>
                <Input
                  id="alias-token"
                  value={aliasToken}
                  onChange={(event) => setAliasToken(event.target.value)}
                  placeholder={aliasType === "table" ? "buyer" : "income"}
                  disabled={!hasSchema || createMutation.isPending}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="alias-target-table">Use table</Label>
                <select
                  id="alias-target-table"
                  value={targetTable}
                  onChange={(event) => setTargetTable(event.target.value)}
                  className="control-base w-full px-3 text-sm"
                  disabled={!hasSchema || createMutation.isPending}
                >
                  {tableNames.map((table) => (
                    <option key={table} value={table}>
                      {table}
                    </option>
                  ))}
                </select>
              </div>
              {aliasType === "column" ? (
                <div>
                  <Label htmlFor="alias-target-column">Use column</Label>
                  <select
                    id="alias-target-column"
                    value={targetColumn}
                    onChange={(event) => setTargetColumn(event.target.value)}
                    className="control-base w-full px-3 text-sm"
                    disabled={!hasSchema || createMutation.isPending}
                  >
                    {columnOptions.map((column) => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>

            {error ? <Alert variant="danger">{error}</Alert> : null}

            <Button type="submit" disabled={!hasSchema || createMutation.isPending}>
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add alias
            </Button>
          </form>
        </div>
      )}
    </Card>
  );
}

function AliasRow({
  alias,
  onDelete,
  deleting,
}: {
  alias: SchemaAlias;
  onDelete: () => void;
  deleting: boolean;
}) {
  const target =
    alias.alias_type === "column" && alias.target_column
      ? `${alias.target_table}.${alias.target_column}`
      : alias.target_table;

  return (
    <tr className="border-t border-border-subtle">
      <td className="px-3 py-2 font-medium text-text-primary">{alias.alias_token}</td>
      <td className="px-3 py-2 text-text-secondary">
        <span className="inline-flex items-center gap-1.5">
          <ArrowRight className="h-3.5 w-3.5 text-text-muted" aria-hidden />
          {target}
        </span>
      </td>
      <td className="px-3 py-2">
        <Badge variant="default">{alias.alias_type}</Badge>
      </td>
      <td className="px-3 py-2 text-right">
        <Button variant="ghost" size="sm" onClick={onDelete} disabled={deleting} title="Remove alias">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}
