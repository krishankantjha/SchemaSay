import type { QueryClient } from "@tanstack/react-query";
import { schemaApi } from "@/lib/api/endpoints";

/**
 * Refresh schema cache after a new connection is registered.
 * Backend also auto-syncs; this ensures the UI sees tables immediately.
 */
export async function autoSyncConnectionSchema(
  queryClient: QueryClient,
  connectionId: number,
): Promise<{ ok: true; tableCount: number } | { ok: false; error: unknown }> {
  try {
    await schemaApi.sync(connectionId, false);
    await queryClient.invalidateQueries({ queryKey: ["schema-tree", connectionId] });
    const tree = await queryClient.fetchQuery({
      queryKey: ["schema-tree", connectionId],
      queryFn: () => schemaApi.tree(connectionId),
    });
    return { ok: true, tableCount: tree.tables.length };
  } catch (error) {
    await queryClient.invalidateQueries({ queryKey: ["schema-tree", connectionId] });
    return { ok: false, error };
  }
}
