import { Tabs } from "@mantine/core";

import type { Workstream } from "../api/client";
import { ArtifactsTab } from "./ArtifactsTab";
import { OplogTab } from "./OplogTab";

/** Consolidated: cleanup artifacts + operation log (scoped). */
export function NotesTab({
  eid,
  workstreams,
  workstreamId,
}: {
  eid: string;
  workstreams: Workstream[];
  workstreamId?: string;
}) {
  return (
    <Tabs defaultValue="oplog" color="usfGreen" variant="outline">
      <Tabs.List mb="md">
        <Tabs.Tab value="oplog">Oplog</Tabs.Tab>
        <Tabs.Tab value="cleanup">Cleanup / artifacts</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="oplog">
        <OplogTab
          eid={eid}
          workstreams={workstreams}
          workstreamId={workstreamId}
        />
      </Tabs.Panel>
      <Tabs.Panel value="cleanup">
        <ArtifactsTab
          eid={eid}
          workstreams={workstreams}
          workstreamId={workstreamId}
        />
      </Tabs.Panel>
    </Tabs>
  );
}
