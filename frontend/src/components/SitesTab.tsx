import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  MultiSelect,
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
import { ASSET_STATE_COLOR } from "../theme";

const ENTRY_STATES: { value: AssetState; label: string }[] = [
  { value: "untouched", label: "Not visited" },
  { value: "enumerated", label: "Surveilled" },
  { value: "exploited", label: "Entry gained" },
  { value: "compromised", label: "Full access" },
  { value: "cleaned", label: "Cleaned" },
];

const ACCESS_CONTROL_SYSTEMS = ["HID", "Lenel", "Genetec", "Schlage", "Allegion", "ASSA ABLOY", "Keypad only", "None", "Other"];
const ENTRY_METHODS = [
  "Tailgating", "Lock pick", "Loiding / shimming", "Under-door tool",
  "Crash bar bypass", "Social engineering", "Unlocked door", "Badge clone", "None yet",
];
const GUARD_PRESENCE = ["None", "Roving patrol", "Static post", "Reception only", "Security desk"];
const CCTV_COVERAGE = ["None", "Partial", "Full", "Unknown"];
const SENSITIVE_AREAS = [
  "Server room", "MDF / IDF", "Executive floor", "Data center",
  "HR area", "Finance area", "Loading dock", "Roof", "Mail room",
];

interface SiteForm {
  name: string;
  address: string;
  floors: string;
  access_control: string;
  entry_method: string;
  guard_presence: string;
  cctv: string;
  sensitive_areas: string[];
  entry_notes: string;
  notes: string;
}

const emptyForm = (): SiteForm => ({
  name: "", address: "", floors: "", access_control: "Unknown",
  entry_method: "None yet", guard_presence: "Unknown",
  cctv: "Unknown", sensitive_areas: [], entry_notes: "", notes: "",
});

export function SitesTab({ eid, wsId }: { eid: string; wsId: string }) {
  const qc = useQueryClient();
  const qk = ["assets", eid, wsId];
  const [opened, { open, close }] = useDisclosure(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [form, setForm] = useState<SiteForm>(emptyForm());

  const q = useQuery({ queryKey: qk, queryFn: () => listAssets(eid, wsId) });
  const sites = (q.data ?? []).filter((a) => a.type === "site");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["assets", eid] });

  const entriesGained = sites.filter((s) => ["exploited", "compromised"].includes(s.state)).length;
  const criticalAccess = sites.filter((s) => {
    const areas = (s.meta as Record<string, unknown>).sensitive_areas as string[] | undefined;
    return areas?.some((a) => ["Server room", "Data center", "Executive floor"].includes(a));
  }).length;

  const buildMeta = () => ({
    address: form.address || null,
    floors: form.floors || null,
    access_control: form.access_control,
    entry_method: form.entry_method,
    guard_presence: form.guard_presence,
    cctv: form.cctv,
    sensitive_areas: form.sensitive_areas,
    entry_notes: form.entry_notes || null,
  });

  const openNew = () => { setEditing(null); setForm(emptyForm()); open(); };
  const openEdit = (site: Asset) => {
    const m = site.meta as Record<string, unknown>;
    setEditing(site);
    setForm({
      name: site.identifier,
      address: String(m.address ?? ""),
      floors: String(m.floors ?? ""),
      access_control: String(m.access_control ?? "Unknown"),
      entry_method: String(m.entry_method ?? "None yet"),
      guard_presence: String(m.guard_presence ?? "Unknown"),
      cctv: String(m.cctv ?? "Unknown"),
      sensitive_areas: (m.sensitive_areas as string[]) ?? [],
      entry_notes: String(m.entry_notes ?? ""),
      notes: site.notes_md ?? "",
    });
    open();
  };

  const add = useMutation({
    mutationFn: () =>
      editing
        ? updateAsset(eid, editing.id, { identifier: form.name.trim(), notes_md: form.notes || null, meta: buildMeta() })
        : createAsset(eid, { identifier: form.name.trim(), type: "site", workstream_ids: [wsId], notes_md: form.notes || null, meta: buildMeta() }),
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

  if (q.isLoading) return <Loader />;

  return (
    <Stack>
      <Group justify="space-between">
        <Group gap="xs">
          <Text c="dimmed" size="sm">Physical locations targeted in this assessment.</Text>
          {entriesGained > 0 && <Badge color="red" size="sm">{entriesGained} entries gained</Badge>}
          {criticalAccess > 0 && <Badge color="red" size="sm">{criticalAccess} critical areas accessed</Badge>}
        </Group>
        <Button color="usfGold" c="dark.9" onClick={openNew}>+ Add Site</Button>
      </Group>

      {sites.length === 0 ? (
        <Text c="dimmed" ta="center">No sites yet.</Text>
      ) : (
        <Table highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Site</Table.Th>
              <Table.Th>Address</Table.Th>
              <Table.Th>Access Control</Table.Th>
              <Table.Th>Entry Method</Table.Th>
              <Table.Th>Guards / CCTV</Table.Th>
              <Table.Th>Sensitive Areas</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sites.map((s) => {
              const m = s.meta as Record<string, unknown>;
              const areas = (m.sensitive_areas as string[]) ?? [];
              return (
                <Table.Tr key={s.id}>
                  <Table.Td><Text fw={600}>{s.identifier}</Text></Table.Td>
                  <Table.Td><Text size="sm" c="dimmed">{String(m.address ?? "—")}</Text></Table.Td>
                  <Table.Td><Text size="sm">{String(m.access_control ?? "—")}</Text></Table.Td>
                  <Table.Td>
                    <Badge size="sm" color={String(m.entry_method) === "None yet" ? "gray" : "orange"}>
                      {String(m.entry_method ?? "—")}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">{String(m.guard_presence ?? "—")} · {String(m.cctv ?? "—")}</Text>
                  </Table.Td>
                  <Table.Td>
                    {areas.length > 0 ? (
                      <Group gap={4}>
                        {areas.slice(0, 2).map((a) => (
                          <Badge key={a} size="xs" color={["Server room", "Data center"].includes(a) ? "red" : "orange"}>
                            {a}
                          </Badge>
                        ))}
                        {areas.length > 2 && <Text size="xs" c="dimmed">+{areas.length - 2}</Text>}
                      </Group>
                    ) : <Text size="xs" c="dimmed">—</Text>}
                  </Table.Td>
                  <Table.Td>
                    <Select
                      size="xs"
                      data={ENTRY_STATES}
                      value={s.state}
                      onChange={(v) => v && setState.mutate({ id: s.id, state: v as AssetState })}
                      allowDeselect={false}
                      renderOption={({ option }) => (
                        <Badge color={ASSET_STATE_COLOR[option.value as AssetState]} size="sm">{option.label}</Badge>
                      )}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon size="sm" variant="subtle" onClick={() => openEdit(s)}>
                        <IconEdit size={14} />
                      </ActionIcon>
                      <ActionIcon size="sm" color="red" variant="subtle" onClick={() => del.mutate(s.id)}>
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

      <Modal opened={opened} onClose={close} title={editing ? "Edit Site" : "Add Site"} centered size="lg">
        <Stack>
          <TextInput label="Site name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} />
          <Group grow>
            <TextInput label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.currentTarget.value })} />
            <TextInput label="Floors / levels" value={form.floors} onChange={(e) => setForm({ ...form, floors: e.currentTarget.value })} />
          </Group>
          <Group grow>
            <Select label="Access control system" data={ACCESS_CONTROL_SYSTEMS} value={form.access_control} onChange={(v) => setForm({ ...form, access_control: v ?? "Unknown" })} allowDeselect={false} />
            <Select label="Entry method used" data={ENTRY_METHODS} value={form.entry_method} onChange={(v) => setForm({ ...form, entry_method: v ?? "None yet" })} allowDeselect={false} />
          </Group>
          <Group grow>
            <Select label="Guard presence" data={GUARD_PRESENCE} value={form.guard_presence} onChange={(v) => setForm({ ...form, guard_presence: v ?? "Unknown" })} allowDeselect={false} />
            <Select label="CCTV coverage" data={CCTV_COVERAGE} value={form.cctv} onChange={(v) => setForm({ ...form, cctv: v ?? "Unknown" })} allowDeselect={false} />
          </Group>
          <MultiSelect
            label="Sensitive areas accessed"
            data={SENSITIVE_AREAS}
            value={form.sensitive_areas}
            onChange={(v) => setForm({ ...form, sensitive_areas: v })}
            placeholder="Select all that apply..."
          />
          <Textarea label="Entry method detail" autosize minRows={2} value={form.entry_notes} onChange={(e) => setForm({ ...form, entry_notes: e.currentTarget.value })} placeholder="How specifically was entry gained..." />
          <TextInput label="Key observations" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })} />
          <Button color="usfGreen" disabled={!form.name.trim()} loading={add.isPending} onClick={() => add.mutate()}>Save</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
