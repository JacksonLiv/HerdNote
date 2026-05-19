import { Tabs } from "@mantine/core";

import type { Workstream } from "../api/client";
import { CompromisedUsersTab } from "./CompromisedUsersTab";
import { PathsTab } from "./PathsTab";

/** Consolidated: captured credentials + access paths/map (scoped). */
export function AccessTab({
  eid,
  workstreams,
  workstreamId,
}: {
  eid: string;
  workstreams: Workstream[];
  workstreamId?: string;
}) {
  return (
    <Tabs defaultValue="compromised" color="usfGreen" variant="outline">
      <Tabs.List mb="md">
        <Tabs.Tab value="compromised">Compromised users</Tabs.Tab>
        <Tabs.Tab value="paths">Access paths</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="compromised">
        <CompromisedUsersTab
          eid={eid}
          workstreams={workstreams}
          workstreamId={workstreamId}
        />
      </Tabs.Panel>
      <Tabs.Panel value="paths">
        <PathsTab
          eid={eid}
          workstreams={workstreams}
          workstreamId={workstreamId}
        />
      </Tabs.Panel>
    </Tabs>
  );
}
