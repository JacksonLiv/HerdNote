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

import { createAsset, deleteAsset, listAssets, updateAsset, type AssetState } from "../api/client";

const SEG_STATES: { value: AssetState; label: string; color: string }[] = [
  { value: "untouched", label: "Not reached", color: "gray" },
  { value: "enumerated", label: "Discovered", color: "blue" },
  { value: "exploited", label: "Partial access", color: "yellow" },
  { value: "compromised", label: "Full access", color: "red" },
  { value: "cleaned", label: "N/A", color: "dark" },
];

const SEG_LABELS: { value: string; label: string; color: string }[] = [
  { value: "adequately_segmented", label: "Adequately segmented", color: "green" },
  { value: "partially_segmented", label: "Partially segmented", color: "yellow" },
  { value: "flat", label: "Flat / no segmentation", color: "red" },
  { value: "unknown", label: "Unknown", color: "gray" },
];

interface SegmentForm {
  cidr: string;
  vlan_id: string;
  label: string;
  reachable_from: string;
  blocked_by: string;
  notes: string;
}

const emptyForm = (): SegmentForm => ({ cidr: "", vlan_id: "", label: "unknown", reachable_from: "", blocked_by: "", notes: "" });

export function InternalSegmentsTab({ eid, wsId }: { eid: string; wsId: string }) {
  const qc = useQueryClient();
  const qk = ["assets", eid, wsId];
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState<SegmentForm>(emptyForm());

  const q = useQuery({ queryKey: qk, queryFn: () => listAssets(eid, wsId) });
  const segments = (q.data ?? []).filter((a) => a.type === "network");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["assets", eid] });

  const flatCount = segments.filter((s) => (s.meta as Record<string, unknown>).segmentation_label === "flat").length;
  const reachedCount = segments.filter((s) => ["exploited", "compromised"].includes(s.state)).length;

  const add = useMutation({
    mutationFn: () =>
      createAsset(eid, {
        identifier: form.cidr.trim(),
        type: "network",
        workstream_ids: [wsId],
        notes_md: form.notes || null,
        meta: {
          vlan_id: form.vlan_id || null,
          segmentation_label: form.label,
          reachable_from: form.reachable_from ? form.reachable_from.split(",").map((s) => s.trim()).filter(Boolean) : [],
          blocked_by: form.blocked_by || null,
        },
      }),
    onSuccess: () => { invalidate(); close(); setForm(emptyForm()); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteAsset(eid, id),
    onSuccess: invalidate,
  });

  const setState = useMutation({
    mutationFn: ({ id, state }: { id: string; state: AssetState }) => updateAsset(eid, id, { state }),
    onSuccess: invalidate,
  });

  if (q.isLoading) return <Loader />;

  return (
    <Stack>
      <Group justify="space-between">
        <Group gap="xs">
          <Text c="dimmed" size="sm">Network segments and VLANs mapped during the assessment.</Text>
          {flatCount > 0 && <Badge color="red" size="sm">{flatCount} flat</Badge>}
          {reachedCount > 0 && <Badge color="orange" size="sm">{reachedCount} reached</Badge>}
        </Group>
        <Button color="usfGold" c="dark.9" onClick={open}>+ Add Segment</Button>
      </Group>

      {segments.length === 0 ? (
        <Text c="dimmed" ta="center">No network segments recorded yet.</Text>
      ) : (
        <Table highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>CIDR / Range</Table.Th>
              <Table.Th>VLAN</Table.Th>
              <Table.Th>Segmentation</Table.Th>
              <Table.Th>Reachable from</Table.Th>
              <Table.Th>Blocked by</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {segments.map((s) => {
              const m = s.meta as Record<string, unknown>;
              const segLabel = SEG_LABELS.find((l) => l.value === String(m.segmentation_label ?? "unknown")) ?? SEG_LABELS[SEG_LABELS.length - 1];
              const reachable = Array.isArray(m.reachable_from) ? (m.reachable_from as string[]) : [];
              return (
                <Table.Tr key={s.id}>
                  <Table.Td><Text ff="monospace" size="sm" fw={600}>{s.identifier}</Text></Table.Td>
                  <Table.Td><Text size="sm" c="dimmed">{String(m.vlan_id ?? "—")}</Text></Table.Td>
                  <Table.Td><Badge size="sm" color={segLabel.color}>{segLabel.label}</Badge></Table.Td>
                  <Table.Td>
                    {reachable.length > 0 ? (
                      <Group gap={4}>
                        {reachable.slice(0, 2).map((r) => <Badge key={r} size="xs" variant="outline" ff="monospace">{r}</Badge>)}
                        {reachable.length > 2 && <Text size="xs" c="dimmed">+{reachable.length - 2}</Text>}
                      </Group>
                    ) : <Text size="xs" c="dimmed">—</Text>}
                  </Table.Td>
                  <Table.Td><Text size="sm" c="dimmed">{String(m.blocked_by ?? "—")}</Text></Table.Td>
                  <Table.Td>
                    <Select
                      size="xs"
                      data={SEG_STATES.map((st) => ({ value: st.value, label: st.label }))}
                      value={s.state}
                      onChange={(v) => v && setState.mutate({ id: s.id, state: v as AssetState })}
                      allowDeselect={false}
                      renderOption={({ option }) => {
                        const info = SEG_STATES.find((st) => st.value === option.value);
                        return <Badge color={info?.color ?? "gray"} size="sm">{option.label}</Badge>;
                      }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon color="red" variant="subtle" onClick={() => del.mutate(s.id)}>
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={opened} onClose={close} title="Add Network Segment" centered>
        <Stack>
          <TextInput label="CIDR / Range" required placeholder="10.10.20.0/24" value={form.cidr} onChange={(e) => setForm({ ...form, cidr: e.currentTarget.value })} />
          <Group grow>
            <TextInput label="VLAN ID / name" placeholder="VLAN 20 — Finance" value={form.vlan_id} onChange={(e) => setForm({ ...form, vlan_id: e.currentTarget.value })} />
            <Select label="Segmentation status" data={SEG_LABELS} value={form.label} onChange={(v) => setForm({ ...form, label: v ?? "unknown" })} allowDeselect={false} />
          </Group>
          <TextInput label="Reachable from (comma-separated CIDRs)" placeholder="10.0.0.0/8, 192.168.1.0/24" value={form.reachable_from} onChange={(e) => setForm({ ...form, reachable_from: e.currentTarget.value })} />
          <TextInput label="Blocked by (ACL/firewall name)" placeholder="ASA-FW-01, VLAN ACL..." value={form.blocked_by} onChange={(e) => setForm({ ...form, blocked_by: e.currentTarget.value })} />
          <Textarea label="Notes" autosize minRows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })} />
          <Button color="usfGreen" disabled={!form.cidr.trim()} loading={add.isPending} onClick={() => add.mutate()}>Save</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
