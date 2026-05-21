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
import { AccessPointsTab } from "../components/AccessPointsTab";
import { AccessTab } from "../components/AccessTab";
import { ADDomainTab } from "../components/ADDomainTab";
import { AssetsTab } from "../components/AssetsTab";
import { CampaignsTab } from "../components/CampaignsTab";
import { CloudIAMTab } from "../components/CloudIAMTab";
import { CompromisedUsersTab } from "../components/CompromisedUsersTab";
import { DashboardTab } from "../components/DashboardTab";
import { ExternalReconTab } from "../components/ExternalReconTab";
import { FindingsTab } from "../components/FindingsTab";
import { InboxTab } from "../components/InboxTab";
import { InfraTab } from "../components/InfraTab";
import { BuildingsTab } from "../components/BuildingsTab";
import { InternalLootTab } from "../components/InternalLootTab";
import { InternalSegmentsTab } from "../components/InternalSegmentsTab";
import { LibraryTab } from "../components/LibraryTab";
import { MSELTab } from "../components/MSELTab";
import { NotesTab } from "../components/NotesTab";
import { OplogTab } from "../components/OplogTab";
import { PhysicalEvidenceTab } from "../components/PhysicalEvidenceTab";
import { PlaybookTab } from "../components/PlaybookTab";
import { SitesTab } from "../components/SitesTab";
import { TargetsTab } from "../components/TargetsTab";
import { WebEndpointsTab } from "../components/WebEndpointsTab";
import { WebHostsTab } from "../components/WebHostsTab";
import { WirelessClientsTab } from "../components/WirelessClientsTab";
import { WorkstreamOverviewTab } from "../components/WorkstreamOverviewTab";
import { useEngagementSync } from "../hooks/useEngagementSync";
import {
  KIND_TABS,
  tabLabel,
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
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
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

      <Group gap="sm" align="center">
        <Text size="sm" fw={600} c="dimmed">View:</Text>
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
            ? `${wsName} (${activeWs?.kind}). Dashboard stays global.`
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
  const [tab, setTab] = useState<string>("dashboard");
  useEffect(() => { setTab("dashboard"); }, [activeWs?.id]);
  const value = tab === "dashboard" || tabKeys.includes(tab as WorkstreamTabKey) ? tab : "dashboard";
  const kind = activeWs?.kind;

  return (
    <Tabs value={value} onChange={(v) => v && setTab(v)} color="usfGreen" keepMounted={false}>
      <Tabs.List>
        <Tabs.Tab value="dashboard">Dashboard</Tabs.Tab>
        {tabKeys.map((k) => (
          <Tabs.Tab key={k} value={k}>
            {kind ? tabLabel(kind, k) : k}
          </Tabs.Tab>
        ))}
      </Tabs.List>

      <Tabs.Panel value="dashboard" pt="md">
        <DashboardTab eid={engagementId} />
      </Tabs.Panel>

      {tabKeys.includes("overview") && activeWs && (
        <Tabs.Panel value="overview" pt="md">
          <WorkstreamOverviewTab
            eid={engagementId}
            wsId={activeWs.id}
            kind={activeWs.kind}
            name={activeWs.name}
          />
        </Tabs.Panel>
      )}

      {tabKeys.includes("playbook") && activeWs && (
        <Tabs.Panel value="playbook" pt="md">
          <PlaybookTab eid={engagementId} workstream={activeWs} />
        </Tabs.Panel>
      )}

      {tabKeys.includes("creds") && (
        <Tabs.Panel value="creds" pt="md">
          <CompromisedUsersTab
            eid={engagementId}
            workstreams={workstreams}
            workstreamId={wsId}
          />
        </Tabs.Panel>
      )}

      {tabKeys.includes("hosts") && (
        <Tabs.Panel value="hosts" pt="md">
          <AssetsTab eid={engagementId} workstreams={workstreams} workstreamId={wsId} />
        </Tabs.Panel>
      )}

      {tabKeys.includes("aps") && activeWs && (
        <Tabs.Panel value="aps" pt="md">
          <AccessPointsTab eid={engagementId} wsId={activeWs.id} />
        </Tabs.Panel>
      )}

      {tabKeys.includes("sites") && activeWs && (
        <Tabs.Panel value="sites" pt="md">
          <SitesTab eid={engagementId} wsId={activeWs.id} />
        </Tabs.Panel>
      )}

      {tabKeys.includes("targets") && activeWs && (
        <Tabs.Panel value="targets" pt="md">
          <TargetsTab eid={engagementId} wsId={activeWs.id} />
        </Tabs.Panel>
      )}

      {tabKeys.includes("campaigns") && activeWs && (
        <Tabs.Panel value="campaigns" pt="md">
          <CampaignsTab eid={engagementId} wsId={activeWs.id} />
        </Tabs.Panel>
      )}

      {tabKeys.includes("findings") && (
        <Tabs.Panel value="findings" pt="md">
          <FindingsTab eid={engagementId} workstreams={workstreams} workstreamId={wsId} workstreamKind={activeWs?.kind} />
        </Tabs.Panel>
      )}

      {tabKeys.includes("access") && (
        <Tabs.Panel value="access" pt="md">
          <AccessTab eid={engagementId} workstreams={workstreams} workstreamId={wsId} />
        </Tabs.Panel>
      )}

      {tabKeys.includes("notes") && (
        <Tabs.Panel value="notes" pt="md">
          <NotesTab eid={engagementId} workstreams={workstreams} workstreamId={wsId} />
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

      {tabKeys.includes("domain") && activeWs && (
        <Tabs.Panel value="domain" pt="md">
          <ADDomainTab eid={engagementId} ws={activeWs} />
        </Tabs.Panel>
      )}

      {tabKeys.includes("clients") && activeWs && (
        <Tabs.Panel value="clients" pt="md">
          <WirelessClientsTab eid={engagementId} wsId={activeWs.id} />
        </Tabs.Panel>
      )}

      {tabKeys.includes("recon") && activeWs && (
        <Tabs.Panel value="recon" pt="md">
          <ExternalReconTab eid={engagementId} wsId={activeWs.id} />
        </Tabs.Panel>
      )}

      {tabKeys.includes("endpoints") && activeWs && (
        <Tabs.Panel value="endpoints" pt="md">
          <WebEndpointsTab eid={engagementId} wsId={activeWs.id} />
        </Tabs.Panel>
      )}

      {tabKeys.includes("iam") && activeWs && (
        <Tabs.Panel value="iam" pt="md">
          <CloudIAMTab eid={engagementId} wsId={activeWs.id} />
        </Tabs.Panel>
      )}

      {tabKeys.includes("evidence") && activeWs && (
        <Tabs.Panel value="evidence" pt="md">
          <PhysicalEvidenceTab eid={engagementId} wsId={activeWs.id} />
        </Tabs.Panel>
      )}

      {tabKeys.includes("segments") && activeWs && (
        <Tabs.Panel value="segments" pt="md">
          <InternalSegmentsTab eid={engagementId} wsId={activeWs.id} />
        </Tabs.Panel>
      )}

      {tabKeys.includes("loot") && activeWs && (
        <Tabs.Panel value="loot" pt="md">
          <InternalLootTab eid={engagementId} wsId={activeWs.id} />
        </Tabs.Panel>
      )}

      {tabKeys.includes("infra") && (
        <Tabs.Panel value="infra" pt="md">
          <InfraTab eid={engagementId} />
        </Tabs.Panel>
      )}

      {tabKeys.includes("oplog") && (
        <Tabs.Panel value="oplog" pt="md">
          <OplogTab eid={engagementId} workstreams={workstreams} workstreamId={wsId} />
        </Tabs.Panel>
      )}

      {tabKeys.includes("web_hosts") && activeWs && (
        <Tabs.Panel value="web_hosts" pt="md">
          <WebHostsTab eid={engagementId} wsId={activeWs.id} />
        </Tabs.Panel>
      )}

      {tabKeys.includes("buildings") && activeWs && (
        <Tabs.Panel value="buildings" pt="md">
          <BuildingsTab eid={engagementId} wsId={activeWs.id} />
        </Tabs.Panel>
      )}

      {tabKeys.includes("msel") && activeWs && (
        <Tabs.Panel value="msel" pt="md">
          <MSELTab eid={engagementId} wsId={activeWs.id} />
        </Tabs.Panel>
      )}
    </Tabs>
  );
}
