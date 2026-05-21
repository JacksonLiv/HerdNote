import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconEdit, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { createAsset, deleteAsset, listAssets, updateAsset, type Asset, type AssetState } from "../api/client";

const TARGET_STATES: { value: AssetState; label: string; color: string }[] = [
  { value: "untouched", label: "Identified", color: "gray" },
  { value: "enumerated", label: "Profiled", color: "blue" },
  { value: "exploited", label: "Targeted", color: "yellow" },
  { value: "compromised", label: "Compromised", color: "red" },
  { value: "cleaned", label: "N/A", color: "dark" },
];

const ACCESS_LEVELS = [
  "Standard user", "Privileged", "IT admin", "Executive", "Finance", "Third-party",
];

interface TargetForm {
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  access_level: string;
  linkedin_url: string;
  osint_notes: string;
}

const emptyForm = (): TargetForm => ({
  name: "", email: "", phone: "", role: "", department: "",
  access_level: "Standard user", linkedin_url: "", osint_notes: "",
});

export function TargetsTab({ eid, wsId }: { eid: string; wsId: string }) {
  const qc = useQueryClient();
  const qk = ["assets", eid, wsId];
  const [opened, { open, close }] = useDisclosure(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [form, setForm] = useState<TargetForm>(emptyForm());

  const q = useQuery({ queryKey: qk, queryFn: () => listAssets(eid, wsId) });
  const targets = (q.data ?? []).filter((a) => a.type === "target");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["assets", eid] });

  const clickedCount = targets.filter((t) => (t.meta as Record<string, unknown>).clicked).length;
  const submittedCount = targets.filter((t) => (t.meta as Record<string, unknown>).submitted_creds).length;
  const reportedCount = targets.filter((t) => (t.meta as Record<string, unknown>).reported).length;

  const buildMeta = (existing?: Record<string, unknown>) => ({
    ...(existing ?? {}),
    email: form.email || null,
    phone: form.phone || null,
    role: form.role || null,
    department: form.department || null,
    access_level: form.access_level,
    linkedin_url: form.linkedin_url || null,
    osint_notes: form.osint_notes || null,
    ...(!existing ? { opened: false, clicked: false, submitted_creds: false, reported: false } : {}),
  });

  const openNew = () => { setEditing(null); setForm(emptyForm()); open(); };
  const openEdit = (t: Asset) => {
    const m = t.meta as Record<string, unknown>;
    setEditing(t);
    setForm({
      name: t.identifier,
      email: String(m.email ?? ""),
      phone: String(m.phone ?? ""),
      role: String(m.role ?? ""),
      department: String(m.department ?? ""),
      access_level: String(m.access_level ?? "Standard user"),
      linkedin_url: String(m.linkedin_url ?? ""),
      osint_notes: String(m.osint_notes ?? ""),
    });
    open();
  };

  const add = useMutation({
    mutationFn: () =>
      editing
        ? updateAsset(eid, editing.id, { identifier: form.name.trim(), meta: buildMeta(editing.meta as Record<string, unknown>) })
        : createAsset(eid, { identifier: form.name.trim(), type: "target", workstream_ids: [wsId], meta: buildMeta() }),
    onSuccess: () => { invalidate(); close(); setForm(emptyForm()); setEditing(null); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteAsset(eid, id),
    onSuccess: invalidate,
  });

  const setState = useMutation({
    mutationFn: ({ id, state }: { id: string; state: AssetState }) =>
      updateAsset(eid, id, { state }),
    onSuccess: invalidate,
  });

  const toggleMeta = useMutation({
    mutationFn: ({ id, field, value, currentMeta }: { id: string; field: string; value: boolean; currentMeta: Record<string, unknown> }) =>
      updateAsset(eid, id, { meta: { ...currentMeta, [field]: value } }),
    onSuccess: invalidate,
  });

  if (q.isLoading) return <Loader />;

  return (
    <Stack>
      <Group justify="space-between">
        <Group gap="xs">
          <Text c="dimmed" size="sm">People and accounts targeted in this social engineering assessment.</Text>
          {clickedCount > 0 && <Badge color="yellow" size="sm">{clickedCount} clicked</Badge>}
          {submittedCount > 0 && <Badge color="orange" size="sm">{submittedCount} submitted creds</Badge>}
          {reportedCount > 0 && <Badge color="green" size="sm">{reportedCount} reported</Badge>}
        </Group>
        <Button color="usfGold" c="dark.9" onClick={openNew}>+ Add Target</Button>
      </Group>

      {targets.length === 0 ? (
        <Text c="dimmed" ta="center">No targets yet.</Text>
      ) : (
        <Table highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Role / Dept</Table.Th>
              <Table.Th>Access level</Table.Th>
              <Table.Th>Opened</Table.Th>
              <Table.Th>Clicked</Table.Th>
              <Table.Th>Submitted</Table.Th>
              <Table.Th>Reported</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {targets.map((t) => {
              const m = t.meta as Record<string, unknown>;
              return (
                <Table.Tr key={t.id}>
                  <Table.Td><Text fw={600}>{t.identifier}</Text></Table.Td>
                  <Table.Td><Text size="sm" ff="monospace">{String(m.email ?? "—")}</Text></Table.Td>
                  <Table.Td>
                    <Stack gap={0}>
                      <Text size="sm">{String(m.role ?? "—")}</Text>
                      <Text size="xs" c="dimmed">{String(m.department ?? "")}</Text>
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="xs" color={String(m.access_level ?? "").includes("admin") || String(m.access_level ?? "").includes("Executive") ? "orange" : "gray"}>
                      {String(m.access_level ?? "—")}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Checkbox checked={!!m.opened} onChange={(e) => toggleMeta.mutate({ id: t.id, field: "opened", value: e.currentTarget.checked, currentMeta: m })} />
                  </Table.Td>
                  <Table.Td>
                    <Checkbox checked={!!m.clicked} onChange={(e) => toggleMeta.mutate({ id: t.id, field: "clicked", value: e.currentTarget.checked, currentMeta: m })} />
                  </Table.Td>
                  <Table.Td>
                    <Checkbox checked={!!m.submitted_creds} onChange={(e) => toggleMeta.mutate({ id: t.id, field: "submitted_creds", value: e.currentTarget.checked, currentMeta: m })} />
                  </Table.Td>
                  <Table.Td>
                    <Checkbox checked={!!m.reported} onChange={(e) => toggleMeta.mutate({ id: t.id, field: "reported", value: e.currentTarget.checked, currentMeta: m })} />
                  </Table.Td>
                  <Table.Td>
                    <Select
                      size="xs"
                      data={TARGET_STATES.map((s) => ({ value: s.value, label: s.label }))}
                      value={t.state}
                      onChange={(v) => v && setState.mutate({ id: t.id, state: v as AssetState })}
                      allowDeselect={false}
                      renderOption={({ option }) => {
                        const info = TARGET_STATES.find((s) => s.value === option.value);
                        return <Badge color={info?.color ?? "gray"} size="sm">{option.label}</Badge>;
                      }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon size="sm" variant="subtle" onClick={() => openEdit(t)}>
                        <IconEdit size={14} />
                      </ActionIcon>
                      <ActionIcon size="sm" color="red" variant="subtle" onClick={() => del.mutate(t.id)}>
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={opened} onClose={close} title={editing ? "Edit Target" : "Add Target"} centered size="md">
        <Stack>
          <TextInput label="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} />
          <Group grow>
            <TextInput label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.currentTarget.value })} />
            <TextInput label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.currentTarget.value })} />
          </Group>
          <Group grow>
            <TextInput label="Role / title" value={form.role} onChange={(e) => setForm({ ...form, role: e.currentTarget.value })} />
            <TextInput label="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.currentTarget.value })} />
          </Group>
          <Group grow>
            <Select label="Access level" data={ACCESS_LEVELS} value={form.access_level} onChange={(v) => setForm({ ...form, access_level: v ?? "Standard user" })} allowDeselect={false} />
            <TextInput label="LinkedIn URL" placeholder="linkedin.com/in/..." value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.currentTarget.value })} />
          </Group>
          <Textarea label="OSINT notes" autosize minRows={2} value={form.osint_notes} onChange={(e) => setForm({ ...form, osint_notes: e.currentTarget.value })} placeholder="Breach hits, email format confirmed, mail security posture..." />
          <Button color="usfGreen" disabled={!form.name.trim()} loading={add.isPending} onClick={() => add.mutate()}>Save</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
