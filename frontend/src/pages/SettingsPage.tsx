import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconArrowLeft, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { addWorkstream, getEngagement, removeWorkstream } from "../api/client";
import { InfraTab } from "../components/InfraTab";

const KINDS = [
  "active_directory",
  "web",
  "external",
  "internal",
  "wireless",
  "cloud",
  "social",
  "physical",
  "inject",
  "other",
];

export function SettingsPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["engagement", id],
    queryFn: () => getEngagement(id),
    enabled: !!id,
  });
  const [name, setName] = useState("");
  const [kind, setKind] = useState("other");

  const add = useMutation({
    mutationFn: () => addWorkstream(id, { name: name.trim(), kind }),
    onSuccess: () => {
      setName("");
      setKind("other");
      qc.invalidateQueries({ queryKey: ["engagement", id] });
      notifications.show({ color: "usfGreen", message: "Workstream added." });
    },
  });
  const del = useMutation({
    mutationFn: (wsId: string) => removeWorkstream(id, wsId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["engagement", id] }),
  });

  if (q.isLoading) return <Loader />;
  if (!q.data) return <Text c="red">Engagement not found.</Text>;
  const e = q.data;

  return (
    <Stack gap="lg">
      <Group>
        <ActionIcon
          variant="subtle"
          onClick={() => navigate(`/engagements/${id}`)}
        >
          <IconArrowLeft size={18} />
        </ActionIcon>
        <div>
          <Title order={2}>Settings — {e.name}</Title>
          <Text c="dimmed" size="sm">
            Workstreams, team, infrastructure & client for this engagement.
          </Text>
        </div>
      </Group>

      <Tabs defaultValue="workstreams" color="usfGreen">
        <Tabs.List>
          <Tabs.Tab value="workstreams">Workstreams</Tabs.Tab>
          <Tabs.Tab value="team">Team</Tabs.Tab>
          <Tabs.Tab value="infra">Infrastructure</Tabs.Tab>
          <Tabs.Tab value="client">Client</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="workstreams" pt="md">
          <Card withBorder padding="md">
            <Group align="flex-end" mb="md">
              <TextInput
                label="New workstream"
                placeholder="e.g. Wireless"
                value={name}
                onChange={(ev) => setName(ev.currentTarget.value)}
              />
              <Select
                label="Kind"
                data={KINDS}
                value={kind}
                allowDeselect={false}
                onChange={(v) => setKind(v ?? "other")}
                w={180}
              />
              <Button
                color="usfGold"
                c="dark.9"
                disabled={!name.trim()}
                loading={add.isPending}
                onClick={() => add.mutate()}
              >
                Add
              </Button>
            </Group>
            <Stack gap="xs">
              {e.workstreams.map((w) => (
                <Group key={w.id} justify="space-between">
                  <Group gap="xs">
                    <Text fw={600}>{w.name}</Text>
                    <Badge variant="outline">{w.kind}</Badge>
                    <Text size="xs" c="dimmed">
                      {w.assignees.length
                        ? w.assignees.map((a) => a.display_name).join(", ")
                        : "unassigned"}
                    </Text>
                  </Group>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={() => del.mutate(w.id)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="team" pt="md">
          <Card withBorder padding="md">
            <Stack gap="xs">
              {e.members.map((m) => (
                <Group key={m.user.id} justify="space-between">
                  <Text>
                    {m.user.display_name}{" "}
                    <Text span c="dimmed" size="sm">
                      @{m.user.username}
                    </Text>
                  </Text>
                  <Badge
                    color={m.role === "lead" ? "usfGold" : "gray"}
                    c="dark.9"
                  >
                    {m.role}
                  </Badge>
                </Group>
              ))}
            </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="infra" pt="md">
          <InfraTab eid={id} />
        </Tabs.Panel>

        <Tabs.Panel value="client" pt="md">
          <Card withBorder padding="md">
            <Text>
              Client:{" "}
              <Text span fw={600}>
                {e.client ?? "—"}
              </Text>
            </Text>
            <Text size="xs" c="dimmed" mt="xs">
              Manage the client directory under Admin → Clients.
            </Text>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
