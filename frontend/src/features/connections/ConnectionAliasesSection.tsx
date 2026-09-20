import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Loader2, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useToast } from "@/app/ToastContext";
import { ApiError } from "@/lib/api/client";
import { connectionsApi, schemaApi } from "@/lib/api/endpoints";
import type { SchemaAlias, SchemaAliasSuggestion, SchemaAliasType } from "@/lib/api/types";
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
};

export function ConnectionAliasesSection({ connectionId }: ConnectionAliasesSectionProps) {
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

  const hasSchema = tableNames.length > 0;

  const suggestionsQuery = useQuery({
    queryKey: ["connection-alias-suggestions", connectionId],
    queryFn: () => connectionsApi.listAliasSuggestions(connectionId),
    enabled: hasSchema,
  });

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
      await queryClient.invalidateQueries({ queryKey: ["connection-alias-suggestions", connectionId] });
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
      await queryClient.invalidateQueries({ queryKey: ["connection-alias-suggestions", connectionId] });
      toast("Alias removed", "success");
    },
    onError: (err) => {
      toast(err instanceof ApiError ? err.detail : "Failed to remove alias", "error");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      aliasId,
      payload,
    }: {
      aliasId: number;
      payload: { alias_token: string; target_table: string; target_column?: string };
    }) => connectionsApi.updateAlias(connectionId, aliasId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["connection-aliases", connectionId] });
      await queryClient.invalidateQueries({ queryKey: ["connection-alias-suggestions", connectionId] });
      toast("Alias updated", "success");
    },
    onError: (err) => {
      toast(err instanceof ApiError ? err.detail : "Failed to update alias", "error");
    },
  });

  const addSuggestionMutation = useMutation({
    mutationFn: (suggestion: SchemaAliasSuggestion) =>
      connectionsApi.createAlias(connectionId, {
        alias_type: suggestion.alias_type,
        alias_token: suggestion.alias_token,
        target_table: suggestion.target_table,
        ...(suggestion.alias_type === "column" && suggestion.target_column
          ? { target_column: suggestion.target_column }
          : {}),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["connection-aliases", connectionId] });
      await queryClient.invalidateQueries({ queryKey: ["connection-alias-suggestions", connectionId] });
      toast("Suggested alias added", "success");
    },
    onError: (err) => {
      toast(err instanceof ApiError ? err.detail : "Failed to add suggested alias", "error");
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

  const aliases = aliasesQuery.data ?? [];
  const suggestions = suggestionsQuery.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business language aliases</CardTitle>
        <CardDescription>
          Map your business terms to the tables and columns in this data source so SchemaSay can
          understand natural-language questions more accurately.
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

          {suggestions.length > 0 ? (
            <div className="rounded-[var(--radius-md)] border border-accent/20 bg-accent-muted/15 p-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" aria-hidden />
                <p className="text-sm font-medium text-text-primary">Suggested after schema sync</p>
              </div>
              <ul className="mt-3 space-y-2">
                {suggestions.slice(0, 6).map((suggestion) => {
                  const targetKey =
                    suggestion.alias_type === "column" && suggestion.target_column
                      ? `${suggestion.target_table}.${suggestion.target_column}`
                      : suggestion.target_table;
                  return (
                    <li
                      key={`${suggestion.alias_type}-${suggestion.alias_token}-${targetKey}`}
                      className="flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-surface px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-text-primary">{suggestion.reason}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={addSuggestionMutation.isPending}
                        onClick={() => addSuggestionMutation.mutate(suggestion)}
                      >
                        Add
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
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
                      tableNames={tableNames}
                      tables={schemaQuery.data?.tables ?? []}
                      onDelete={() => deleteMutation.mutate(alias.id)}
                      onSave={(payload) => updateMutation.mutate({ aliasId: alias.id, payload })}
                      deleting={deleteMutation.isPending}
                      saving={updateMutation.isPending}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-text-muted">
              No aliases yet. Add one below or accept a suggestion so natural-language questions
              match your schema more reliably.
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
                  placeholder={aliasType === "table" ? "customer" : "order date"}
                  disabled={!hasSchema || createMutation.isPending}
                />
                <p className="mt-1 text-xs text-text-muted">
                  Spaces are fine — SchemaSay matches phrases like order date too.
                </p>
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
  tableNames,
  tables,
  onDelete,
  onSave,
  deleting,
  saving,
}: {
  alias: SchemaAlias;
  tableNames: string[];
  tables: { name: string; columns: { name: string }[] }[];
  onDelete: () => void;
  onSave: (payload: { alias_token: string; target_table: string; target_column?: string }) => void;
  deleting: boolean;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [aliasToken, setAliasToken] = useState(alias.alias_token);
  const [targetTable, setTargetTable] = useState(alias.target_table);
  const [targetColumn, setTargetColumn] = useState(alias.target_column ?? "");
  const columnOptions =
    tables.find((table) => table.name === targetTable)?.columns.map((column) => column.name) ?? [];

  useEffect(() => {
    if (!editing) {
      setAliasToken(alias.alias_token);
      setTargetTable(alias.target_table);
      setTargetColumn(alias.target_column ?? "");
    }
  }, [alias, editing]);

  const target =
    alias.alias_type === "column" && alias.target_column
      ? `${alias.target_table}.${alias.target_column}`
      : alias.target_table;

  function handleSave() {
    if (!aliasToken.trim() || !targetTable) return;
    if (alias.alias_type === "column" && !targetColumn) return;
    onSave({
      alias_token: aliasToken.trim(),
      target_table: targetTable,
      ...(alias.alias_type === "column" ? { target_column: targetColumn } : {}),
    });
    setEditing(false);
  }

  if (editing) {
    return (
      <tr className="border-t border-border-subtle bg-bg-elevated/40">
        <td className="px-3 py-2">
          <Input value={aliasToken} onChange={(event) => setAliasToken(event.target.value)} />
        </td>
        <td className="px-3 py-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={targetTable}
              onChange={(event) => setTargetTable(event.target.value)}
              className="control-base w-full px-2 py-1.5 text-sm"
            >
              {tableNames.map((table) => (
                <option key={table} value={table}>
                  {table}
                </option>
              ))}
            </select>
            {alias.alias_type === "column" ? (
              <select
                value={targetColumn}
                onChange={(event) => setTargetColumn(event.target.value)}
                className="control-base w-full px-2 py-1.5 text-sm"
              >
                {columnOptions.map((column) => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </td>
        <td className="px-3 py-2">
          <Badge variant="default">{alias.alias_type}</Badge>
        </td>
        <td className="px-3 py-2 text-right">
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={handleSave} disabled={saving} title="Save alias">
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving} title="Cancel">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </td>
      </tr>
    );
  }

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
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} disabled={saving} title="Edit alias">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} disabled={deleting} title="Remove alias">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
