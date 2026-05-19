import {
  Badge,
  Button,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  Tabs,
  Text,
  Title,
} from "@mantine/core";
import { IconDownload, IconSettings } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { exportEngagement, getEngagement, type Workstream } from "../api/client";
import { AccessTab } from "../components/AccessTab";
import { AssetsTab } from "../components/AssetsTab";
import { DashboardTab } from "../components/DashboardTab";
import { FindingsTab } from "../components/FindingsTab";
import { InboxTab } from "../components/InboxTab";
import { LibraryTab } from "../components/LibraryTab";
import { NotesTab } from "../components/NotesTab";
import { PlaybookTab } from "../components/PlaybookTab";
import { useEngagementSync } from "../hooks/useEngagementSync";
import {
  KIND_TABS,
  TAB_LABEL,
  type WorkstreamTabKey,
} from "../lib/workstreamTabs";

const ALL = "__all__";
const ALL_TABS: WorkstreamTabKey[] = ["hosts", "findings", "access", "notes"];

export function EngagementPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  useEngagementSync(id);
  const [ws, setWs] = useState<string>(ALL);
  const q = useQuery({
    queryKey: ["engagement", id],
    queryFn: () => getEngagement(id),
    enabled: !!id,
  });

  if (q.isLoading) return <Loader />;
  if (q.isError || !q.data) return <Text c="red">Engagement not found.</Text>;
  const e = q.data;
  const wsId = ws === ALL ? undefined : ws;
  const activeWs = e.workstreams.find((w) => w.id === ws);
  const wsName = activeWs?.name ?? "All workstreams";
  const tabKeys = activeWs ? KIND_TABS[activeWs.kind] ?? [] : ALL_TABS;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>{e.name}</Title>
          <Text c="dimmed" size="sm">
            {e.client ?? "—"} · {e.type}
          </Text>
        </div>
        <Group gap="sm">
          <Badge size="lg" color="usfGreen" variant="light">
            {e.status}
          </Badge>
          <Button
            variant="default"
            leftSection={<IconSettings size={16} />}
            onClick={() => navigate(`/engagements/${id}/settings`)}
          >
            Settings
          </Button>
          <Button
            variant="default"
            leftSection={<IconDownload size={16} />}
            onClick={async () => {
              const data = await exportEngagement(e.id);
              const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: "application/json",
              });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `${e.name.replace(/\s+/g, "_")}_export.json`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            Export JSON
          </Button>
        </Group>
      </Group>

      {/* Workstream switcher — changes what every tab (except Dashboard) shows. */}
      <Group gap="sm" align="center">
        <Text size="sm" fw={600} c="dimmed">
          View:
        </Text>
        <SegmentedControl
          value={ws}
          onChange={(v) => setWs(v)}
          color="usfGreen"
          data={[
            { label: "All", value: ALL },
            ...e.workstreams.map((w) => ({ label: w.name, value: w.id })),
          ]}
        />
        <Text size="xs" c="dimmed">
          {wsId
            ? `Workstream tabs scoped to ${wsName} (${activeWs?.kind}). Dashboard stays global.`
            : "Showing everything across all workstreams."}
        </Text>
      </Group>

      <EngagementTabs
        engagementId={e.id}
        workstreams={e.workstreams}
        activeWs={activeWs ?? null}
        wsId={wsId}
        tabKeys={tabKeys}
      />
    </Stack>
  );
}

function EngagementTabs({
  engagementId,
  workstreams,
  activeWs,
  wsId,
  tabKeys,
}: {
  engagementId: string;
  workstreams: Workstream[];
  activeWs: Workstream | null;
  wsId: string | undefined;
  tabKeys: WorkstreamTabKey[];
}) {
  // Controlled: when the workstream (and therefore the available tab set)
  // changes, snap back to Dashboard so we never land on a tab that just got
  // hidden (e.g. Hosts when switching into the Inject workstream).
  const [tab, setTab] = useState<string>("dashboard");
  useEffect(() => {
    setTab("dashboard");
  }, [activeWs?.id]);
  const value = tab === "dashboard" || tabKeys.includes(tab as WorkstreamTabKey) ? tab : "dashboard";
  return (
    <Tabs value={value} onChange={(v) => v && setTab(v)} color="usfGreen" keepMounted={false}>
      <Tabs.List>
        <Tabs.Tab value="dashboard">Dashboard</Tabs.Tab>
        {tabKeys.map((k) => (
          <Tabs.Tab key={k} value={k}>
            {TAB_LABEL[k]}
          </Tabs.Tab>
        ))}
      </Tabs.List>

      <Tabs.Panel value="dashboard" pt="md">
        <DashboardTab eid={engagementId} />
      </Tabs.Panel>

      {tabKeys.includes("playbook") && activeWs && (
        <Tabs.Panel value="playbook" pt="md">
          <PlaybookTab eid={engagementId} workstream={activeWs} />
        </Tabs.Panel>
      )}

      {tabKeys.includes("hosts") && (
        <Tabs.Panel value="hosts" pt="md">
          <AssetsTab
            eid={engagementId}
            workstreams={workstreams}
            workstreamId={wsId}
          />
        </Tabs.Panel>
      )}

      {tabKeys.includes("findings") && (
        <Tabs.Panel value="findings" pt="md">
          <FindingsTab
            eid={engagementId}
            workstreams={workstreams}
            workstreamId={wsId}
          />
        </Tabs.Panel>
      )}

      {tabKeys.includes("access") && (
        <Tabs.Panel value="access" pt="md">
          <AccessTab
            eid={engagementId}
            workstreams={workstreams}
            workstreamId={wsId}
          />
        </Tabs.Panel>
      )}

      {tabKeys.includes("notes") && (
        <Tabs.Panel value="notes" pt="md">
          <NotesTab
            eid={engagementId}
            workstreams={workstreams}
            workstreamId={wsId}
          />
        </Tabs.Panel>
      )}

      {tabKeys.includes("inbox") && activeWs && (
        <Tabs.Panel value="inbox" pt="md">
          <InboxTab eid={engagementId} workstreamId={activeWs.id} />
        </Tabs.Panel>
      )}

      {tabKeys.includes("library") && (
        <Tabs.Panel value="library" pt="md">
          <LibraryTab eid={engagementId} />
        </Tabs.Panel>
      )}
    </Tabs>
  );
}

