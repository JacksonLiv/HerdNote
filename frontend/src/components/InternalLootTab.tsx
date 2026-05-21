import {
  ActionIcon,
  Badge,
  Button,
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
import { IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { createAsset, deleteAsset, listAssets } from "../api/client";

const LOOT_TYPES: { value: string; label: string; color: string }[] = [
  { value: "credentials_file", label: "Credentials file", color: "red" },
  { value: "pii", label: "PII / Personal data", color: "red" },
  { value: "financial", label: "Financial data", color: "orange" },
  { value: "source_code", label: "Source code", color: "yellow" },
  { value: "database_dump", label: "Database dump", color: "red" },
  { value: "ssh_key", label: "SSH / private key", color: "red" },
  { value: "config_file", label: "Config file", color: "yellow" },
  { value: "backup", label: "Backup file", color: "orange" },
  { value: "other", label: "Other", color: "gray" },
];

const SENSITIVITY_LEVELS: { value: string; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "green" },
  { value: "medium", label: "Medium", color: "yellow" },
  { value: "high", label: "High", color: "red" },
];

interface LootForm {
  name: string;
  loot_type: string;
  source_host: string;
  path: string;
  sensitivity: string;
  description: string;
}

const emptyForm = (): LootForm => ({ name: "", loot_type: "credentials_file", source_host: "", path: "", sensitivity: "high", description: "" });

export function InternalLootTab({ eid, wsId }: { eid: string; wsId: string }) {
  const qc = useQueryClient();
  const qk = ["assets", eid, wsId];
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState<LootForm>(emptyForm());
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const q = useQuery({ queryKey: qk, queryFn: () => listAssets(eid, wsId) });
  const allLoot = (q.data ?? []).filter((a) => a.type === "loot");
  const loot = allLoot.filter((l) => {
    if (typeFilter === "all") return true;
    return (l.meta as Record<string, unknown>).loot_type === typeFilter;
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["assets", eid] });

  const highCount = allLoot.filter((l) => (l.meta as Record<string, unknown>).sensitivity === "high").length;

  const add = useMutation({
    mutationFn: () =>
      createAsset(eid, {
        identifier: form.name.trim(),
        type: "loot",
        workstream_ids: [wsId],
        notes_md: form.description || null,
        meta: {
          loot_type: form.loot_type,
          source_host: form.source_host || null,
          path: form.path || null,
          sensitivity: form.sensitivity,
        },
      }),
    onSuccess: () => { invalidate(); close(); setForm(emptyForm()); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteAsset(eid, id),
    onSuccess: invalidate,
  });

  if (q.isLoading) return <Loader />;

  return (
    <Stack>
      <Group justify="space-between">
        <Group gap="xs">
          <Text c="dimmed" size="sm">Sensitive data and files observed during post-exploitation.</Text>
          {highCount > 0 && <Badge color="red" size="sm">{highCount} high sensitivity</Badge>}
        </Group>
        <Button color="usfGold" c="dark.9" onClick={open}>+ Add Loot</Button>
      </Group>

      <Group gap="xs" wrap="wrap">
        <Badge size="md" variant={typeFilter === "all" ? "filled" : "outline"} color="usfGreen" style={{ cursor: "pointer" }} onClick={() => setTypeFilter("all")}>All</Badge>
        {LOOT_TYPES.map((t) => (
          <Badge key={t.value} size="md" variant={typeFilter === t.value ? "filled" : "outline"} color={t.color} style={{ cursor: "pointer" }} onClick={() => setTypeFilter(t.value)}>
            {t.label}
          </Badge>
        ))}
      </Group>

      {loot.length === 0 ? (
        <Text c="dimmed" ta="center">No loot recorded yet.</Text>
      ) : (
        <Table highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Item</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Source host</Table.Th>
              <Table.Th>Path</Table.Th>
              <Table.Th>Sensitivity</Table.Th>
              <Table.Th>Notes</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loot.map((l) => {
              const m = l.meta as Record<string, unknown>;
              const typeInfo = LOOT_TYPES.find((t) => t.value === String(m.loot_type ?? "other")) ?? LOOT_TYPES[LOOT_TYPES.length - 1];
              const sens = SENSITIVITY_LEVELS.find((s) => s.value === String(m.sensitivity ?? "high")) ?? SENSITIVITY_LEVELS[2];
              return (
                <Table.Tr key={l.id}>
                  <Table.Td><Text fw={600} size="sm">{l.identifier}</Text></Table.Td>
                  <Table.Td><Badge size="sm" color={typeInfo.color}>{typeInfo.label}</Badge></Table.Td>
                  <Table.Td><Text size="sm" ff="monospace" c="dimmed">{String(m.source_host ?? "—")}</Text></Table.Td>
                  <Table.Td><Text size="xs" ff="monospace" c="dimmed" lineClamp={1}>{String(m.path ?? "—")}</Text></Table.Td>
                  <Table.Td><Badge size="sm" color={sens.color}>{sens.label}</Badge></Table.Td>
                  <Table.Td><Text size="xs" c="dimmed" lineClamp={1}>{l.notes_md ?? "—"}</Text></Table.Td>
                  <Table.Td>
                    <ActionIcon color="red" variant="subtle" onClick={() => del.mutate(l.id)}>
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={opened} onClose={close} title="Add Loot" centered size="md">
        <Stack>
          <TextInput label="Item name / description" required placeholder="SAM database, /etc/shadow, finance_2024.xlsx..." value={form.name} onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} />
          <Group grow>
            <Select label="Type" data={LOOT_TYPES} value={form.loot_type} onChange={(v) => setForm({ ...form, loot_type: v ?? "other" })} allowDeselect={false} />
            <Select label="Sensitivity" data={SENSITIVITY_LEVELS} value={form.sensitivity} onChange={(v) => setForm({ ...form, sensitivity: v ?? "high" })} allowDeselect={false} />
          </Group>
          <Group grow>
            <TextInput label="Source host" placeholder="10.10.20.5, DC01..." value={form.source_host} onChange={(e) => setForm({ ...form, source_host: e.currentTarget.value })} />
            <TextInput label="Path / location" placeholder="C:\Windows\System32\config\SAM" value={form.path} onChange={(e) => setForm({ ...form, path: e.currentTarget.value })} />
          </Group>
          <Textarea label="Notes" autosize minRows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.currentTarget.value })} />
          <Button color="usfGreen" disabled={!form.name.trim()} loading={add.isPending} onClick={() => add.mutate()}>Save</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
