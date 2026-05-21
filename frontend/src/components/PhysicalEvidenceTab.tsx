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
import { IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { createAsset, deleteAsset, listAssets } from "../api/client";

const EVIDENCE_TYPES: { value: string; label: string; color: string }[] = [
  { value: "badge_clone", label: "Badge clone", color: "red" },
  { value: "physical_document", label: "Physical document", color: "orange" },
  { value: "usb_media", label: "USB / media", color: "yellow" },
  { value: "photo_evidence", label: "Photo evidence", color: "blue" },
  { value: "key_copy", label: "Key copy", color: "red" },
  { value: "access_card", label: "Access card", color: "orange" },
  { value: "installed_implant", label: "Installed implant", color: "red" },
  { value: "network_tap", label: "Network tap", color: "red" },
  { value: "other", label: "Other", color: "gray" },
];

const SENSITIVITY_LEVELS = ["Public", "Internal", "Confidential", "Restricted"];

interface EvidenceForm {
  name: string;
  evidence_type: string;
  location: string;
  description: string;
  sensitivity: string;
  file_ref: string;
  in_scope_action: boolean;
}

const emptyForm = (): EvidenceForm => ({
  name: "", evidence_type: "photo_evidence", location: "", description: "",
  sensitivity: "Internal", file_ref: "", in_scope_action: true,
});

export function PhysicalEvidenceTab({ eid, wsId }: { eid: string; wsId: string }) {
  const qc = useQueryClient();
  const qk = ["assets", eid, wsId];
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState<EvidenceForm>(emptyForm());
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const q = useQuery({ queryKey: qk, queryFn: () => listAssets(eid, wsId) });
  const allEvidence = (q.data ?? []).filter((a) => a.type === "evidence");
  const evidence = allEvidence.filter((e) => {
    if (typeFilter === "all") return true;
    return (e.meta as Record<string, unknown>).evidence_type === typeFilter;
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["assets", eid] });

  const criticalCount = allEvidence.filter((e) => {
    const s = String((e.meta as Record<string, unknown>).sensitivity ?? "");
    return ["Confidential", "Restricted"].includes(s);
  }).length;

  const add = useMutation({
    mutationFn: () =>
      createAsset(eid, {
        identifier: form.name.trim(),
        type: "evidence",
        workstream_ids: [wsId],
        notes_md: form.description || null,
        meta: {
          evidence_type: form.evidence_type,
          location: form.location || null,
          sensitivity: form.sensitivity,
          file_ref: form.file_ref || null,
          in_scope_action: form.in_scope_action,
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
          <Text c="dimmed" size="sm">Evidence and artifacts obtained during the physical assessment.</Text>
          {criticalCount > 0 && <Badge color="red" size="sm">{criticalCount} confidential/restricted</Badge>}
        </Group>
        <Button color="usfGold" c="dark.9" onClick={open}>+ Add Evidence</Button>
      </Group>

      <Group gap="xs" wrap="wrap">
        <Badge size="md" variant={typeFilter === "all" ? "filled" : "outline"} color="usfGreen" style={{ cursor: "pointer" }} onClick={() => setTypeFilter("all")}>All</Badge>
        {EVIDENCE_TYPES.map((t) => (
          <Badge key={t.value} size="md" variant={typeFilter === t.value ? "filled" : "outline"} color={t.color} style={{ cursor: "pointer" }} onClick={() => setTypeFilter(t.value)}>
            {t.label}
          </Badge>
        ))}
      </Group>

      {evidence.length === 0 ? (
        <Text c="dimmed" ta="center">No evidence recorded yet.</Text>
      ) : (
        <Table highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Item</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Location</Table.Th>
              <Table.Th>Sensitivity</Table.Th>
              <Table.Th>File ref</Table.Th>
              <Table.Th>In scope</Table.Th>
              <Table.Th>Description</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {evidence.map((e) => {
              const m = e.meta as Record<string, unknown>;
              const typeInfo = EVIDENCE_TYPES.find((t) => t.value === String(m.evidence_type ?? "other")) ?? EVIDENCE_TYPES[EVIDENCE_TYPES.length - 1];
              const sens = String(m.sensitivity ?? "Internal");
              return (
                <Table.Tr key={e.id}>
                  <Table.Td><Text fw={600} size="sm">{e.identifier}</Text></Table.Td>
                  <Table.Td><Badge size="sm" color={typeInfo.color}>{typeInfo.label}</Badge></Table.Td>
                  <Table.Td><Text size="sm" c="dimmed">{String(m.location ?? "—")}</Text></Table.Td>
                  <Table.Td>
                    <Badge size="sm" color={["Confidential", "Restricted"].includes(sens) ? "red" : "gray"}>
                      {sens}
                    </Badge>
                  </Table.Td>
                  <Table.Td><Text size="xs" c="dimmed" ff="monospace">{String(m.file_ref ?? "—")}</Text></Table.Td>
                  <Table.Td>
                    <Badge size="xs" color={m.in_scope_action ? "green" : "orange"}>
                      {m.in_scope_action ? "Yes" : "No"}
                    </Badge>
                  </Table.Td>
                  <Table.Td><Text size="xs" c="dimmed" lineClamp={1}>{e.notes_md ?? "—"}</Text></Table.Td>
                  <Table.Td>
                    <ActionIcon color="red" variant="subtle" onClick={() => del.mutate(e.id)}>
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={opened} onClose={close} title="Add Evidence / Artifact" centered size="md">
        <Stack>
          <TextInput label="Item name / description" required placeholder="Admin badge clone, Finance spreadsheet..." value={form.name} onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} />
          <Group grow>
            <Select label="Type" data={EVIDENCE_TYPES} value={form.evidence_type} onChange={(v) => setForm({ ...form, evidence_type: v ?? "other" })} allowDeselect={false} />
            <Select label="Sensitivity" data={SENSITIVITY_LEVELS} value={form.sensitivity} onChange={(v) => setForm({ ...form, sensitivity: v ?? "Internal" })} allowDeselect={false} />
          </Group>
          <TextInput label="Location found / obtained" placeholder="3rd floor server room, reception desk..." value={form.location} onChange={(e) => setForm({ ...form, location: e.currentTarget.value })} />
          <TextInput label="Evidence file reference" placeholder="IMG_0042.jpg, exhibit-C.pdf..." value={form.file_ref} onChange={(e) => setForm({ ...form, file_ref: e.currentTarget.value })} />
          <Textarea label="Description / notes" autosize minRows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.currentTarget.value })} />
          <Checkbox label="In-scope authorized action" checked={form.in_scope_action} onChange={(e) => setForm({ ...form, in_scope_action: e.currentTarget.checked })} />
          <Button color="usfGreen" disabled={!form.name.trim()} loading={add.isPending} onClick={() => add.mutate()}>Save</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
