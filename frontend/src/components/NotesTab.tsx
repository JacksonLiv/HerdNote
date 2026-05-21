import { Tabs } from "@mantine/core";

import type { Workstream } from "../api/client";
import { ArtifactsTab } from "./ArtifactsTab";
import { OplogTab } from "./OplogTab";
import { ScratchNotesTab } from "./ScratchNotesTab";

/** Oplog + cleanup artifacts + free-form scratch notes. */
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
    <Tabs defaultValue="scratch" color="usfGreen" variant="outline">
      <Tabs.List mb="md">
        <Tabs.Tab value="scratch">Notes</Tabs.Tab>
        <Tabs.Tab value="oplog">Oplog</Tabs.Tab>
        <Tabs.Tab value="cleanup">Cleanup / Artifacts</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="scratch">
        {workstreamId ? (
          <ScratchNotesTab eid={eid} wsId={workstreamId} />
        ) : (
          <ScratchNotesTab eid={eid} wsId={workstreams[0]?.id ?? ""} />
        )}
      </Tabs.Panel>
      <Tabs.Panel value="oplog">
        <OplogTab eid={eid} workstreams={workstreams} workstreamId={workstreamId} />
      </Tabs.Panel>
      <Tabs.Panel value="cleanup">
        <ArtifactsTab eid={eid} workstreams={workstreams} workstreamId={workstreamId} />
      </Tabs.Panel>
    </Tabs>
  );
}
