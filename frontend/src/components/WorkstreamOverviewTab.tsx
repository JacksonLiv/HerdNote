import {
  Badge,
  Card,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import {
  getDashboard,
  listAssets,
  listCompromisedUsers,
  type WorkstreamKind,
} from "../api/client";

const PRIV_COLOR: Record<string, string> = {
  domain_admin: "red", root: "red", local_admin: "orange",
  service: "blue", user: "gray", other: "gray",
};
const SEV_COLOR: Record<string, string> = {
  critical: "red", high: "orange", medium: "yellow", low: "usfGold", informational: "gray",
};

function Stat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <Card withBorder padding="sm">
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{label}</Text>
      <Text size="28px" fw={800} c={color}>{value}</Text>
    </Card>
  );
}

export function WorkstreamOverviewTab({
  eid,
  wsId,
  kind,
  name,
}: {
  eid: string;
  wsId: string;
  kind: WorkstreamKind;
  name: string;
}) {
  const dash = useQuery({ queryKey: ["dashboard", eid, wsId], queryFn: () => getDashboard(eid, wsId) });
  const assets = useQuery({ queryKey: ["assets", eid, wsId], queryFn: () => listAssets(eid, wsId) });
  const creds = useQuery({ queryKey: ["cusers", eid, wsId], queryFn: () => listCompromisedUsers(eid, wsId) });

  if (dash.isLoading) return <Loader />;
  if (!dash.data) return <Text c="red">Couldn't load overview.</Text>;

  const d = dash.data;
  const allAssets = assets.data ?? [];
  const allCreds = creds.data ?? [];

  return (
    <Stack gap="lg">
      <Title order={4}>{name} — Overview</Title>
      <OverviewByKind kind={kind} d={d} allAssets={allAssets} allCreds={allCreds} />
    </Stack>
  );
}

function OverviewByKind({
  kind,
  d,
  allAssets,
  allCreds,
}: {
  kind: WorkstreamKind;
  d: ReturnType<typeof getDashboard> extends Promise<infer T> ? T : never;
  allAssets: ReturnType<typeof listAssets> extends Promise<infer T> ? T : never;
  allCreds: ReturnType<typeof listCompromisedUsers> extends Promise<infer T> ? T : never;
}) {
  const daCount = allCreds.filter((c) => c.privilege === "domain_admin").length;
  const laCount = allCreds.filter((c) => c.privilege === "local_admin").length;
  const rootCount = allCreds.filter((c) => c.privilege === "root").length;
  const aps = allAssets.filter((a) => a.type === "ap");
  const sites = allAssets.filter((a) => a.type === "site");
  const targets = allAssets.filter((a) => a.type === "target");

  if (kind === "active_directory") {
    return (
      <Stack gap="lg">
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <Stat label="Hosts" value={d.asset_total} />
          <Stat label="Compromised hosts" value={d.compromised_hosts.length} color="red" />
          <Stat label="Captured accounts" value={allCreds.length} color="orange" />
          <Stat label="Findings" value={d.findings_total} />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 3 }}>
          <Stat label="Domain Admins" value={daCount} color={daCount > 0 ? "red" : undefined} />
          <Stat label="Local Admins" value={laCount} color={laCount > 0 ? "orange" : undefined} />
          <Stat label="Root" value={rootCount} color={rootCount > 0 ? "red" : undefined} />
        </SimpleGrid>
        {allCreds.length > 0 && <CredsTable creds={allCreds} />}
        <FindingsBySev d={d} />
      </Stack>
    );
  }

  if (kind === "wireless") {
    const cracked = aps.filter((a) => a.meta && (a.meta as Record<string, unknown>).psk).length;
    const byCrypto = aps.reduce<Record<string, number>>((acc, a) => {
      const c = String((a.meta as Record<string, unknown>).crypto ?? "Unknown");
      acc[c] = (acc[c] ?? 0) + 1;
      return acc;
    }, {});
    return (
      <Stack gap="lg">
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <Stat label="APs discovered" value={aps.length} />
          <Stat label="PSKs cracked" value={cracked} color={cracked > 0 ? "usfGreen" : undefined} />
          <Stat label="Creds captured" value={allCreds.length} color={allCreds.length > 0 ? "orange" : undefined} />
          <Stat label="Findings" value={d.findings_total} />
        </SimpleGrid>
        {Object.keys(byCrypto).length > 0 && (
          <Card withBorder padding="md">
            <Title order={5} mb="xs">APs by security type</Title>
            <Group gap="xs">
              {Object.entries(byCrypto).map(([crypto, count]) => (
                <Badge key={crypto} size="lg" variant="light">{crypto}: {count}</Badge>
              ))}
            </Group>
          </Card>
        )}
        <FindingsBySev d={d} />
      </Stack>
    );
  }

  if (kind === "physical") {
    const entriesGained = sites.filter((s) => s.state === "exploited" || s.state === "compromised").length;
    return (
      <Stack gap="lg">
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <Stat label="Sites targeted" value={sites.length} />
          <Stat label="Entries gained" value={entriesGained} color={entriesGained > 0 ? "red" : undefined} />
          <Stat label="Open artifacts" value={d.artifacts_open.length} color="usfGold" />
          <Stat label="Findings" value={d.findings_total} />
        </SimpleGrid>
        <FindingsBySev d={d} />
      </Stack>
    );
  }

  if (kind === "social") {
    return (
      <Stack gap="lg">
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <Stat label="Targets" value={targets.length} />
          <Stat label="Creds captured" value={allCreds.length} color={allCreds.length > 0 ? "orange" : undefined} />
          <Stat label="Findings" value={d.findings_total} />
          <Stat label="Compromised" value={targets.filter((t) => t.state === "compromised").length} color="red" />
        </SimpleGrid>
        {allCreds.length > 0 && <CredsTable creds={allCreds} />}
        <FindingsBySev d={d} />
      </Stack>
    );
  }

  if (kind === "inject") {
    return (
      <Stack gap="lg">
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <Stat label="Open injects" value={d.open_injects} color={d.open_injects > 0 ? "usfGold" : undefined} />
          <Stat label="Overdue" value={d.overdue_injects} color={d.overdue_injects > 0 ? "red" : undefined} />
          <Stat label="Findings" value={d.findings_total} />
          <Stat label="Open artifacts" value={d.artifacts_open.length} />
        </SimpleGrid>
      </Stack>
    );
  }

  if (kind === "web") {
    const apps = allAssets.filter((a) => a.type === "webapp");
    const endpoints = allAssets.filter((a) => a.type === "url");
    const vulnEndpoints = endpoints.filter((e) => {
      const status = String((e.meta as Record<string, unknown>).vuln_status ?? "");
      return status !== "not_tested" && status !== "not_vulnerable";
    }).length;
    return (
      <Stack gap="lg">
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <Stat label="Applications" value={apps.length} />
          <Stat label="Endpoints mapped" value={endpoints.length} />
          <Stat label="Vulnerable endpoints" value={vulnEndpoints} color={vulnEndpoints > 0 ? "red" : undefined} />
          <Stat label="Findings" value={d.findings_total} />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 2, sm: 3 }}>
          <Stat label="Captured creds" value={allCreds.length} color={allCreds.length > 0 ? "orange" : undefined} />
          <Stat label="Compromised hosts" value={d.compromised_hosts.length} color={d.compromised_hosts.length > 0 ? "red" : undefined} />
          <Stat label="Open findings" value={d.findings_open} color={d.findings_open > 0 ? "usfGold" : undefined} />
        </SimpleGrid>
        {allCreds.length > 0 && <CredsTable creds={allCreds} />}
        <FindingsBySev d={d} />
      </Stack>
    );
  }

  if (kind === "external") {
    const hosts = allAssets.filter((a) => a.type === "host");
    const domains = allAssets.filter((a) => a.type === "network");
    const compromised = d.compromised_hosts.length;
    return (
      <Stack gap="lg">
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <Stat label="External assets" value={hosts.length} />
          <Stat label="Domains / ranges" value={domains.length} />
          <Stat label="Compromised" value={compromised} color={compromised > 0 ? "red" : undefined} />
          <Stat label="Findings" value={d.findings_total} />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 2, sm: 3 }}>
          <Stat label="Captured creds" value={allCreds.length} color={allCreds.length > 0 ? "orange" : undefined} />
          <Stat label="Critical findings" value={d.findings_by_severity["critical"] ?? 0} color={(d.findings_by_severity["critical"] ?? 0) > 0 ? "red" : undefined} />
          <Stat label="Open findings" value={d.findings_open} color={d.findings_open > 0 ? "usfGold" : undefined} />
        </SimpleGrid>
        {allCreds.length > 0 && <CredsTable creds={allCreds} />}
        <FindingsBySev d={d} />
      </Stack>
    );
  }

  if (kind === "internal") {
    const hosts = allAssets.filter((a) => a.type === "host");
    const segments = allAssets.filter((a) => a.type === "network");
    const loot = allAssets.filter((a) => a.type === "loot");
    const highLoot = loot.filter((l) => (l.meta as Record<string, unknown>).sensitivity === "high").length;
    return (
      <Stack gap="lg">
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <Stat label="Hosts" value={hosts.length} />
          <Stat label="Compromised" value={d.compromised_hosts.length} color={d.compromised_hosts.length > 0 ? "red" : undefined} />
          <Stat label="Captured creds" value={allCreds.length} color={allCreds.length > 0 ? "orange" : undefined} />
          <Stat label="Findings" value={d.findings_total} />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 2, sm: 3 }}>
          <Stat label="Network segments" value={segments.length} />
          <Stat label="Loot items" value={loot.length} color={loot.length > 0 ? "usfGold" : undefined} />
          <Stat label="High-sensitivity loot" value={highLoot} color={highLoot > 0 ? "red" : undefined} />
        </SimpleGrid>
        {allCreds.length > 0 && <CredsTable creds={allCreds} />}
        <FindingsBySev d={d} />
      </Stack>
    );
  }

  if (kind === "cloud") {
    const resources = allAssets.filter((a) => a.type === "host" || a.type === "cloud");
    const iamEntities = allAssets.filter((a) => a.type === "iam_entity");
    const highRiskIAM = iamEntities.filter((e) => (e.meta as Record<string, unknown>).risk_level === "high").length;
    return (
      <Stack gap="lg">
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <Stat label="Cloud resources" value={resources.length} />
          <Stat label="IAM entities" value={iamEntities.length} />
          <Stat label="High-risk IAM" value={highRiskIAM} color={highRiskIAM > 0 ? "red" : undefined} />
          <Stat label="Findings" value={d.findings_total} />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 2, sm: 3 }}>
          <Stat label="Captured creds" value={allCreds.length} color={allCreds.length > 0 ? "orange" : undefined} />
          <Stat label="Critical findings" value={d.findings_by_severity["critical"] ?? 0} color={(d.findings_by_severity["critical"] ?? 0) > 0 ? "red" : undefined} />
          <Stat label="Open findings" value={d.findings_open} color={d.findings_open > 0 ? "usfGold" : undefined} />
        </SimpleGrid>
        {allCreds.length > 0 && <CredsTable creds={allCreds} />}
        <FindingsBySev d={d} />
      </Stack>
    );
  }

  // Default: other
  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <Stat label="Assets" value={d.asset_total} />
        <Stat label="Compromised" value={d.compromised_hosts.length} color="red" />
        <Stat label="Captured creds" value={allCreds.length} color={allCreds.length > 0 ? "orange" : undefined} />
        <Stat label="Findings" value={d.findings_total} />
      </SimpleGrid>
      {allCreds.length > 0 && <CredsTable creds={allCreds} />}
      <FindingsBySev d={d} />
    </Stack>
  );
}

function FindingsBySev({ d }: { d: { findings_by_severity: Record<string, number>; findings_open: number } }) {
  const SEV_ORDER = ["critical", "high", "medium", "low", "informational"];
  return (
    <Card withBorder padding="md">
      <Group justify="space-between" mb="xs">
        <Title order={5}>Findings by severity</Title>
        <Text size="xs" c="dimmed">{d.findings_open} open / draft</Text>
      </Group>
      <Group gap="xs">
        {SEV_ORDER.map((s) => (
          <Badge key={s} color={SEV_COLOR[s]} variant="filled" size="lg">
            {s}: {d.findings_by_severity[s] ?? 0}
          </Badge>
        ))}
      </Group>
    </Card>
  );
}

function CredsTable({ creds }: { creds: { id: string; username: string; domain: string | null; privilege: string; has_secret: boolean }[] }) {
  return (
    <Card withBorder padding="md">
      <Title order={5} mb="xs">Captured credentials ({creds.length})</Title>
      <Table>
        <Table.Tbody>
          {creds.slice(0, 10).map((c) => (
            <Table.Tr key={c.id}>
              <Table.Td><Text ff="monospace" size="sm">{c.domain ? `${c.domain}\\` : ""}{c.username}</Text></Table.Td>
              <Table.Td><Badge color={PRIV_COLOR[c.privilege] ?? "gray"} size="sm">{c.privilege}</Badge></Table.Td>
              <Table.Td>
                {c.has_secret ? <Badge size="xs" color="usfGreen" variant="outline">secret</Badge> : <Text size="xs" c="dimmed">no secret</Text>}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {creds.length > 10 && <Text size="xs" c="dimmed" mt="xs">…and {creds.length - 10} more (see Credentials tab)</Text>}
    </Card>
  );
}
