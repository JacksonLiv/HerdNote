import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Code,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  createOplog,
  deleteOplog,
  listOplog,
  type Workstream,
} from "../api/client";
import { useWorkstreamTarget } from "./useWorkstreamTarget";

const EMPTY = {
  description: "",
  source_host: "",
  dest_host: "",
  tool: "",
  command: "",
  mitre_technique: "",
};

export function OplogTab({
  eid,
  workstreams,
  workstreamId,
}: {
  eid: string;
  workstreams: Workstream[];
  workstreamId?: string;
}) {
  const qc = useQueryClient();
  const wsT = useWorkstreamTarget(workstreams, workstreamId);
  const q = useQuery({
    queryKey: ["oplog", eid, workstreamId ?? "all"],
    queryFn: () => listOplog(eid, workstreamId),
  });
  const [f, setF] = useState({ ...EMPTY });
  const set = (p: Partial<typeof EMPTY>) => setF((s) => ({ ...s, ...p }));

  const invalidate = () => qc.invalidateQueries({ queryKey: ["oplog", eid] });
  const add = useMutation({
    mutationFn: () =>
      createOplog(eid, {
        description: f.description.trim(),
        workstream_id: wsT.wsId,
        source_host: f.source_host || null,
        dest_host: f.dest_host || null,
        tool: f.tool || null,
        command: f.command || null,
        mitre_technique: f.mitre_technique || null,
      }),
    onSuccess: () => {
      setF({ ...EMPTY });
      invalidate();
      notifications.show({ color: "usfGreen", message: "Logged." });
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteOplog(eid, id),
    onSuccess: invalidate,
  });

  return (
    <Stack>
      <Card withBorder padding="md" bg="dark.6">
        <Stack gap="xs">
          <Text fw={600} size="sm">
            Operation log — what was run, when, where (Ghostwriter-compatible)
          </Text>
          <Group grow>
            <TextInput
              label="Source host"
              value={f.source_host}
              onChange={(e) => set({ source_host: e.currentTarget.value })}
            />
            <TextInput
              label="Target host"
              value={f.dest_host}
              onChange={(e) => set({ dest_host: e.currentTarget.value })}
            />
            <TextInput
              label="Tool"
              value={f.tool}
              onChange={(e) => set({ tool: e.currentTarget.value })}
            />
            <TextInput
              label="MITRE ATT&CK"
              placeholder="T1003"
              value={f.mitre_technique}
              onChange={(e) => set({ mitre_technique: e.currentTarget.value })}
            />
          </Group>
          <Textarea
            label="Command"
            autosize
            minRows={1}
            value={f.command}
            onChange={(e) => set({ command: e.currentTarget.value })}
            styles={{ input: { fontFamily: "monospace" } }}
          />
          <TextInput
            label="Description"
            required
            placeholder="what you did / result"
            value={f.description}
            onChange={(e) => set({ description: e.currentTarget.value })}
          />
          {wsT.picker}
          <Button
            color="usfGreen"
            disabled={!f.description.trim() || !wsT.ready}
            loading={add.isPending}
            onClick={() => add.mutate()}
          >
            Log entry
          </Button>
        </Stack>
      </Card>

      {q.isLoading && <Loader />}
      {q.data && q.data.length === 0 && (
        <Text c="dimmed" ta="center">
          No entries yet.
        </Text>
      )}
      {q.data && q.data.length > 0 && (
        <Table withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Time</Table.Th>
              <Table.Th>Operator</Table.Th>
              <Table.Th>Path</Table.Th>
              <Table.Th>Command</Table.Th>
              <Table.Th>Description</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {q.data.map((e) => (
              <Table.Tr key={e.id}>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {new Date(e.ts).toLocaleString()}
                  </Text>
                </Table.Td>
                <Table.Td>{e.operator_name}</Table.Td>
                <Table.Td>
                  <Text size="xs">
                    {e.source_host ?? "—"} → {e.dest_host ?? "—"}
                  </Text>
                  {e.mitre_technique && (
                    <Badge size="xs" color="usfGreen">
                      {e.mitre_technique}
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  {e.command ? (
                    <Code>{e.command}</Code>
                  ) : (
                    <Text size="xs" c="dimmed">
                      —
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>{e.description}</Table.Td>
                <Table.Td>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={() => del.mutate(e.id)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
