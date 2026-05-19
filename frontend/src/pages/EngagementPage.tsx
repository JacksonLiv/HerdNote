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
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { exportEngagement, getEngagement } from "../api/client";
import { AccessTab } from "../components/AccessTab";
import { AssetsTab } from "../components/AssetsTab";
import { DashboardTab } from "../components/DashboardTab";
import { FindingsTab } from "../components/FindingsTab";
import { NotesTab } from "../components/NotesTab";
import { useEngagementSync } from "../hooks/useEngagementSync";

const ALL = "__all__";

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
  const wsName =
    e.workstreams.find((w) => w.id === ws)?.name ?? "All workstreams";

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
          onChange={setWs}
          color="usfGreen"
          data={[
            { label: "All", value: ALL },
            ...e.workstreams.map((w) => ({ label: w.name, value: w.id })),
          ]}
        />
        <Text size="xs" c="dimmed">
          {wsId
            ? `Hosts / Findings / Access / Notes are scoped to ${wsName}. Dashboard stays global.`
            : "Showing everything across all workstreams."}
        </Text>
      </Group>

      <Tabs defaultValue="dashboard" color="usfGreen" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="dashboard">Dashboard</Tabs.Tab>
          <Tabs.Tab value="hosts">Hosts</Tabs.Tab>
          <Tabs.Tab value="findings">Findings</Tabs.Tab>
          <Tabs.Tab value="access">Access</Tabs.Tab>
          <Tabs.Tab value="notes">Notes</Tabs.Tab>
        </Tabs.List>

        {/* Dashboard is always global (every workstream). */}
        <Tabs.Panel value="dashboard" pt="md">
          <DashboardTab eid={e.id} />
        </Tabs.Panel>

        <Tabs.Panel value="hosts" pt="md">
          <AssetsTab
            eid={e.id}
            workstreams={e.workstreams}
            workstreamId={wsId}
          />
        </Tabs.Panel>

        <Tabs.Panel value="findings" pt="md">
          <FindingsTab
            eid={e.id}
            workstreams={e.workstreams}
            workstreamId={wsId}
          />
        </Tabs.Panel>

        <Tabs.Panel value="access" pt="md">
          <AccessTab
            eid={e.id}
            workstreams={e.workstreams}
            workstreamId={wsId}
          />
        </Tabs.Panel>

        <Tabs.Panel value="notes" pt="md">
          <NotesTab
            eid={e.id}
            workstreams={e.workstreams}
            workstreamId={wsId}
          />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
