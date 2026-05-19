import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  createArtifact,
  deleteArtifact,
  listArtifacts,
  updateArtifact,
  type ArtifactType,
  type Workstream,
} from "../api/client";
import { useWorkstreamTarget } from "./useWorkstreamTarget";

const TYPES: ArtifactType[] = [
  "account",
  "webshell",
  "persistence",
  "tool",
  "file",
  "config",
  "other",
];

export function ArtifactsTab({
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
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState({
    type: "webshell" as ArtifactType,
    description: "",
    notes: "",
  });

  const q = useQuery({
    queryKey: ["artifacts", eid, workstreamId ?? "all"],
    queryFn: () => listArtifacts(eid, workstreamId),
  });
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["artifacts", eid] });

  const add = useMutation({
    mutationFn: () =>
      createArtifact(eid, {
        type: form.type,
        description: form.description.trim(),
        notes: form.notes || null,
        workstream_id: wsT.wsId,
      }),
    onSuccess: () => {
      close();
      setForm({ type: "webshell", description: "", notes: "" });
      invalidate();
      notifications.show({ color: "usfGreen", message: "Artifact tracked." });
    },
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; removed: boolean }) =>
      updateArtifact(eid, v.id, { removed: v.removed }),
    onSuccess: invalidate,
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteArtifact(eid, id),
    onSuccess: invalidate,
  });

  const remaining = q.data?.filter((a) => !a.removed).length ?? 0;

  return (
    <Stack>
      <Group justify="space-between">
        <Text c="dimmed" size="sm">
          Things introduced into the environment — the cleanup list.{" "}
          {remaining > 0 && (
            <Badge color="orange" ml="xs">
              {remaining} to remove
            </Badge>
          )}
        </Text>
        <Button color="usfGold" c="dark.9" onClick={open}>
          + Track artifact
        </Button>
      </Group>

      {q.isLoading && <Loader />}
      {q.data && q.data.length === 0 && (
        <Text c="dimmed" ta="center">
          None yet.
        </Text>
      )}
      {q.data && q.data.length > 0 && (
        <Table highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Type</Table.Th>
              <Table.Th>Description</Table.Th>
              <Table.Th>Removed</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {q.data.map((a) => (
              <Table.Tr key={a.id}>
                <Table.Td>
                  <Badge variant="light">{a.type}</Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{a.description}</Text>
                  {a.notes && (
                    <Text size="xs" c="dimmed">
                      {a.notes}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Switch
                    checked={a.removed}
                    color="usfGreen"
                    onChange={(e) =>
                      toggle.mutate({ id: a.id, removed: e.currentTarget.checked })
                    }
                  />
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={() => del.mutate(a.id)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={opened} onClose={close} title="Track artifact" centered>
        <Stack>
          <Select
            label="Type"
            data={TYPES}
            value={form.type}
            allowDeselect={false}
            onChange={(v) =>
              setForm({ ...form, type: (v ?? "other") as ArtifactType })
            }
          />
          <TextInput
            label="Description"
            required
            placeholder="e.g. cmd.aspx uploaded to web01"
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.currentTarget.value })
            }
          />
          <Textarea
            label="Notes"
            autosize
            minRows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })}
          />
          {wsT.picker}
          <Button
            color="usfGreen"
            disabled={!form.description.trim() || !wsT.ready}
            loading={add.isPending}
            onClick={() => add.mutate()}
          >
            Save
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
