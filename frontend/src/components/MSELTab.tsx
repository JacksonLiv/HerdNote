import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  NumberInput,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconCheck, IconEdit, IconLink, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  createMSELEntry,
  deleteMSELEntry,
  listInjects,
  listMSEL,
  updateMSELEntry,
  type MSELEntry,
} from "../api/client";

const COMPLETENESS_COLORS: Record<string, string> = {
  full: "green",
  partial: "yellow",
  minimal: "orange",
  none: "red",
};

export function MSELTab({ eid, wsId }: { eid: string; wsId: string }) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["msel", eid] });
    qc.invalidateQueries({ queryKey: ["injects", eid] });
  };

  const mselQ = useQuery({ queryKey: ["msel", eid, wsId], queryFn: () => listMSEL(eid, wsId) });
  const injectsQ = useQuery({ queryKey: ["injects", eid, wsId], queryFn: () => listInjects(eid, { workstreamId: wsId }) });

  const entries = mselQ.data ?? [];
  const injects = injectsQ.data ?? [];
  const totalPoints = entries.reduce((s, e) => s + e.point_value, 0);
  const deliveredEntries = entries.filter((e) => e.delivered_at);

  const [modal, { open, close }] = useDisclosure(false);
  const [editing, setEditing] = useState<MSELEntry | null>(null);
  const [form, setForm] = useState({
    inject_number: 1,
    title: "",
    scheduled_at: "",
    scenario_md: "",
    point_value: 10,
    expected_response_md: "",
  });

  const openNew = () => {
    setEditing(null);
    setForm({ inject_number: entries.length + 1, title: "", scheduled_at: "", scenario_md: "", point_value: 10, expected_response_md: "" });
    open();
  };
  const openEdit = (e: MSELEntry) => {
    setEditing(e);
    setForm({
      inject_number: e.inject_number,
      title: e.title,
      scheduled_at: e.scheduled_at ?? "",
      scenario_md: e.scenario_md ?? "",
      point_value: e.point_value,
      expected_response_md: e.expected_response_md ?? "",
    });
    open();
  };

  const save = useMutation({
    mutationFn: () => editing
      ? updateMSELEntry(eid, editing.id, {
          inject_number: form.inject_number,
          title: form.title.trim(),
          scheduled_at: form.scheduled_at || null,
          scenario_md: form.scenario_md || null,
          point_value: form.point_value,
          expected_response_md: form.expected_response_md || null,
        })
      : createMSELEntry(eid, {
          workstream_id: wsId,
          inject_number: form.inject_number,
          title: form.title.trim(),
          scheduled_at: form.scheduled_at || null,
          scenario_md: form.scenario_md || null,
          point_value: form.point_value,
          expected_response_md: form.expected_response_md || null,
        }),
    onSuccess: () => { invalidate(); close(); },
  });

  const del = useMutation({ mutationFn: (id: string) => deleteMSELEntry(eid, id), onSuccess: invalidate });

  const markDelivered = useMutation({
    mutationFn: (entryId: string) => updateMSELEntry(eid, entryId, { delivered_at: new Date().toISOString() }),
    onSuccess: invalidate,
  });

  // Link a MSEL entry to a matching inject (by inject_number)
  const linkInject = useMutation({
    mutationFn: ({ entryId, injectId }: { entryId: string; injectId: string }) =>
      updateMSELEntry(eid, entryId, { inject_id: injectId }),
    onSuccess: invalidate,
  });

  if (mselQ.isLoading) return <Loader />;

  return (
    <Stack>
      <Group justify="space-between">
        <Group gap="md">
          <Text c="dimmed" size="sm">Master Scenario Events List — planned injects for this exercise.</Text>
          <Badge color="blue">{totalPoints} pts total</Badge>
          <Badge color="green">{deliveredEntries.length}/{entries.length} delivered</Badge>
        </Group>
        <Button color="usfGold" c="dark.9" onClick={openNew}>+ Add Inject</Button>
      </Group>

      {entries.length === 0 ? (
        <Text c="dimmed" ta="center">No planned injects. Add entries to the MSEL before the exercise.</Text>
      ) : (
        <Table highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={50}>#</Table.Th>
              <Table.Th>Title</Table.Th>
              <Table.Th>Scheduled</Table.Th>
              <Table.Th w={60}>Points</Table.Th>
              <Table.Th>Linked Inject</Table.Th>
              <Table.Th>Delivered</Table.Th>
              <Table.Th>Score</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {entries.map((e) => {
              const linkedInject = e.inject_id ? injects.find((i) => i.id === e.inject_id) : null;
              const matchedByNumber = injects.find((i) => i.inject_number === e.inject_number && !e.inject_id);
              return (
                <Table.Tr key={e.id}>
                  <Table.Td>
                    <Text fw={700} size="sm">{e.inject_number}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>{e.title}</Text>
                    {e.scenario_md && <Text size="xs" c="dimmed" truncate maw={250}>{e.scenario_md.slice(0, 80)}</Text>}
                  </Table.Td>
                  <Table.Td>
                    {e.scheduled_at ? (
                      <Text size="xs" ff="monospace">{new Date(e.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
                    ) : "—"}
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm" color="blue">{e.point_value}</Badge>
                  </Table.Td>
                  <Table.Td>
                    {linkedInject ? (
                      <Badge size="sm" color="green" variant="light">{linkedInject.subject.slice(0, 30)}</Badge>
                    ) : matchedByNumber ? (
                      <Button size="xs" variant="subtle" leftSection={<IconLink size={12} />}
                        onClick={() => linkInject.mutate({ entryId: e.id, injectId: matchedByNumber.id })}>
                        Link #{e.inject_number}
                      </Button>
                    ) : "—"}
                  </Table.Td>
                  <Table.Td>
                    {e.delivered_at ? (
                      <Badge size="sm" color="green" leftSection={<IconCheck size={10} />}>
                        {new Date(e.delivered_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </Badge>
                    ) : (
                      <Button size="xs" variant="outline" color="usfGold"
                        onClick={() => markDelivered.mutate(e.id)}>
                        Mark delivered
                      </Button>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {linkedInject?.score_awarded != null ? (
                      <Group gap={4}>
                        <Badge size="sm" color={COMPLETENESS_COLORS[linkedInject.score_completeness ?? ""] ?? "gray"}>
                          {linkedInject.score_awarded}/{e.point_value}
                        </Badge>
                        {linkedInject.score_completeness && (
                          <Text size="xs" c="dimmed">{linkedInject.score_completeness}</Text>
                        )}
                      </Group>
                    ) : "—"}
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon size="sm" variant="subtle" onClick={() => openEdit(e)}><IconEdit size={14} /></ActionIcon>
                      <ActionIcon size="sm" color="red" variant="subtle" onClick={() => del.mutate(e.id)}><IconTrash size={14} /></ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={modal} onClose={close} title={editing ? "Edit MSEL Entry" : "Add MSEL Entry"} centered size="lg">
        <Stack>
          <Group grow>
            <NumberInput label="Inject #" required min={1} value={form.inject_number} onChange={(v) => setForm({ ...form, inject_number: Number(v) })} />
            <NumberInput label="Point value" required min={0} value={form.point_value} onChange={(v) => setForm({ ...form, point_value: Number(v) })} />
          </Group>
          <TextInput label="Title" required placeholder="Phishing — Credential Harvest" value={form.title} onChange={(e) => setForm({ ...form, title: e.currentTarget.value })} />
          <TextInput label="Scheduled time (ISO or HH:MM)" placeholder="2026-05-20T09:00:00" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.currentTarget.value })} />
          <Textarea label="Scenario" autosize minRows={3} value={form.scenario_md} onChange={(e) => setForm({ ...form, scenario_md: e.currentTarget.value })} placeholder="Describe what the white team will send or do..." />
          <Textarea label="Expected response" autosize minRows={3} value={form.expected_response_md} onChange={(e) => setForm({ ...form, expected_response_md: e.currentTarget.value })} placeholder="What should the blue team do? What earns full points?" />
          <Button color="usfGreen" disabled={!form.title.trim()} loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
