import { Select } from "@mantine/core";
import { useState, type ReactNode } from "react";

import type { Workstream } from "../api/client";

/**
 * "All = pick on add": when no workstream is active, creating something
 * forces the operator to choose one. When inside a workstream, it auto-tags.
 *
 * Returns the effective workstream id, a `ready` flag (false until chosen in
 * All view), and a `picker` Select element to drop into the create form.
 */
export function useWorkstreamTarget(
  workstreams: Workstream[],
  workstreamId?: string,
): { wsId: string | null; ready: boolean; picker: ReactNode } {
  const [picked, setPicked] = useState<string | null>(null);
  const inAll = !workstreamId;

  if (!inAll) {
    return { wsId: workstreamId as string, ready: true, picker: null };
  }
  return {
    wsId: picked,
    ready: picked !== null,
    picker: (
      <Select
        label="Workstream"
        description="Required — which workstream this belongs to"
        placeholder="Choose workstream"
        required
        data={workstreams.map((w) => ({ value: w.id, label: w.name }))}
        value={picked}
        onChange={setPicked}
      />
    ),
  };
}
