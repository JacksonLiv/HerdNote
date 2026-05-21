import {
  ActionIcon,
  Badge,
  Card,
  Group,
  Loader,
  Modal,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { IconEye } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { getDashboard, revealSecret } from "../api/client";
import { ASSET_STATE_COLOR } from "../theme";

const SEV_ORDER = ["critical", "high", "medium", "low", "informational"];
const SEV_COLOR: Record<string, string> = {
  critical: "red",
  high: "orange",
  medium: "yellow",
  low: "usfGold",
  informational: "gray",
};
const PRIV_COLOR: Record<string, string> = {
  domain_admin: "red",
  root: "red",
  local_admin: "orange",
  service: "blue",
  user: "gray",
  other: "gray",
};

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Card withBorder padding="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
        {label}
      </Text>
      <Text size="28px" fw={800} c={color}>
        {value}
      </Text>
    </Card>
  );
}

export function DashboardTab({
  eid,
  workstreamId,
}: {
  eid: string;
  workstreamId?: string;
}) {
  const [revealed, setRevealed] = useState<{ user: string; secret: string } | null>(null);
  const reveal = useMutation({ mutationFn: (id: string) => revealSecret(eid, id) });

  const q = useQuery({
    queryKey: ["dashboard", eid, workstreamId ?? "all"],
    queryFn: () => getDashboard(eid, workstreamId),
  });

  if (q.isLoading) return <Loader />;
  if (!q.data) return <Text c="red">Couldn’t load dashboard.</Text>;
  const d = q.data;

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }}>
        <Stat label="Hosts" value={d.asset_total} />
        <Stat
          label="Compromised hosts"
          value={d.compromised_hosts.length}
          color="red"
        />
        <Stat
          label="Compromised users"
          value={d.compromised_users.length}
          color="orange"
        />
        <Stat label="Open artifacts" value={d.artifacts_open.length} color="usfGold" />
        <Stat label="Findings" value={d.findings_total} />
        <Stat
          label={d.overdue_injects > 0 ? `Open injects (${d.overdue_injects} overdue)` : "Open injects"}
          value={d.open_injects}
          color={d.overdue_injects > 0 ? "red" : undefined}
        />
      </SimpleGrid>

      <Card withBorder padding="md">
        <Group justify="space-between" mb="xs">
          <Title order={5}>Findings by severity</Title>
          <Text size="xs" c="dimmed">
            {d.findings_open} open / draft
          </Text>
        </Group>
        <Group gap="xs">
          {SEV_ORDER.map((s) => (
            <Badge key={s} color={SEV_COLOR[s]} variant="filled" size="lg">
              {s}: {d.findings_by_severity[s] ?? 0}
            </Badge>
          ))}
        </Group>
      </Card>

      <Card withBorder padding="md">
        <Title order={5} mb="xs">
          Hosts ({d.hosts.length})
        </Title>
        {d.hosts.length === 0 ? (
          <Text c="dimmed" size="sm">
            No hosts yet — add them on the Hosts tab.
          </Text>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Identifier</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>State</Table.Th>
                <Table.Th>OS</Table.Th>
                <Table.Th>Scope</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {d.hosts.map((h) => (
                <Table.Tr key={h.id}>
                  <Table.Td>
                    <Text ff="monospace">{h.identifier}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {h.type}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={ASSET_STATE_COLOR[h.state]}>{h.state}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {h.os ?? "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {h.in_scope ? (
                      <Badge variant="light" color="usfGreen">
                        in
                      </Badge>
                    ) : (
                      <Badge variant="light" color="gray">
                        out
                      </Badge>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Card withBorder padding="md">
          <Title order={5} mb="xs">
            Compromised hosts
          </Title>
          {d.compromised_hosts.length === 0 ? (
            <Text c="dimmed" size="sm">
              None yet.
            </Text>
          ) : (
            <Table>
              <Table.Tbody>
                {d.compromised_hosts.map((h) => (
                  <Table.Tr key={h.id}>
                    <Table.Td>
                      <Text ff="monospace">{h.identifier}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={ASSET_STATE_COLOR[h.state]}>{h.state}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {h.type}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>

        <Card withBorder padding="md">
          <Group justify="space-between" mb="xs">
            <Title order={5}>Captured credentials</Title>
            <Badge variant="light" color="usfGreen">
              shared across team
            </Badge>
          </Group>
          {d.compromised_users.length === 0 ? (
            <Text c="dimmed" size="sm">
              None yet.
            </Text>
          ) : (
            <Table>
              <Table.Tbody>
                {d.compromised_users.map((c) => (
                  <Table.Tr key={c.id}>
                    <Table.Td>
                      <Text ff="monospace">
                        {c.domain ? `${c.domain}\\` : ""}
                        {c.username}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={PRIV_COLOR[c.privilege] ?? "gray"}>
                        {c.privilege}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {c.has_secret ? (
                        <ActionIcon
                          variant="subtle"
                          color="usfGreen"
                          size="sm"
                          loading={reveal.isPending}
                          onClick={async () => {
                            const secret = await reveal.mutateAsync(c.id);
                            setRevealed({ user: c.username, secret });
                          }}
                        >
                          <IconEye size={14} />
                        </ActionIcon>
                      ) : (
                        <Text size="xs" c="dimmed">no secret</Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>
      </SimpleGrid>

      <Card withBorder padding="md">
        <Title order={5} mb="xs">
          Open artifacts (cleanup)
        </Title>
        {d.artifacts_open.length === 0 ? (
          <Text c="dimmed" size="sm">
            Nothing to clean up.
          </Text>
        ) : (
          <Stack gap={4}>
            {d.artifacts_open.map((a) => (
              <Group key={a.id} gap="xs">
                <Badge variant="light">{a.type}</Badge>
                <Text size="sm">{a.description}</Text>
              </Group>
            ))}
          </Stack>
        )}
      </Card>

      {d.workstreams.length > 0 && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {d.workstreams.map((w) => (
            <Card key={w.id} withBorder padding="md">
              <Group justify="space-between">
                <Text fw={700}>{w.name}</Text>
                <Badge variant="outline">{w.kind}</Badge>
              </Group>
              <Group gap="lg" mt="xs">
                <Text size="sm">
                  {w.asset_count} hosts
                </Text>
                <Text size="sm" c="red">
                  {w.compromised_count} owned
                </Text>
                <Text size="sm">
                  {w.finding_count} findings
                </Text>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}

      <Modal
        opened={revealed !== null}
        onClose={() => setRevealed(null)}
        title={`Secret for ${revealed?.user ?? ""}`}
        centered
      >
        <Card withBorder>
          <Text ff="monospace" style={{ wordBreak: "break-all" }}>
            {revealed?.secret}
          </Text>
        </Card>
      </Modal>
    </Stack>
  );
}
