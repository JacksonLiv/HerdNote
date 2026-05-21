import {
  ActionIcon,
  Badge,
  Button,
  Collapse,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconChevronDown, IconChevronRight, IconEdit, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  createAsset,
  deleteAsset,
  listAssets,
  updateAsset,
  type Asset,
  type AssetState,
} from "../api/client";

const ATTEMPT_STATES: { value: AssetState; label: string; color: string }[] = [
  { value: "untouched", label: "Planned", color: "gray" },
  { value: "enumerated", label: "Attempted", color: "blue" },
  { value: "exploited", label: "Bypassed", color: "orange" },
  { value: "compromised", label: "Accessed", color: "red" },
  { value: "cleaned", label: "N/A", color: "dark" },
];

const DOOR_STATES: { value: AssetState; label: string; color: string }[] = [
  { value: "untouched", label: "Not tried", color: "gray" },
  { value: "enumerated", label: "Identified", color: "blue" },
  { value: "exploited", label: "Bypassed", color: "orange" },
  { value: "compromised", label: "Accessed", color: "red" },
  { value: "cleaned", label: "N/A", color: "dark" },
];

const emptyForm = () => ({ name: "", notes_md: "" });

export function BuildingsTab({ eid, wsId }: { eid: string; wsId: string }) {
  const qc = useQueryClient();
  const qk = ["assets", eid, wsId];
  const invalidate = () => qc.invalidateQueries({ queryKey: ["assets", eid] });

  const q = useQuery({ queryKey: qk, queryFn: () => listAssets(eid, wsId) });
  const allAssets = q.data ?? [];

  const buildings = allAssets.filter((a) => a.type === "building");
  const floors = allAssets.filter((a) => a.type === "floor");
  const doors = allAssets.filter((a) => a.type === "door");
  const attempts = allAssets.filter((a) => a.type === "attempt");

  const floorsFor = (bid: string) => floors.filter((f) => f.parent_id === bid);
  const doorsFor = (fid: string) => doors.filter((d) => d.parent_id === fid);
  const attemptsFor = (did: string) => attempts.filter((a) => a.parent_id === did);

  const [expandedBuildings, setExpandedBuildings] = useState<Set<string>>(new Set());
  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set());
  const [expandedDoors, setExpandedDoors] = useState<Set<string>>(new Set());

  const toggleB = (id: string) => setExpandedBuildings((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleF = (id: string) => setExpandedFloors((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleD = (id: string) => setExpandedDoors((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const [modal, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState(emptyForm());
  const [modalType, setModalType] = useState<"building" | "floor" | "door" | "attempt">("building");
  const [parentId, setParentId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Asset | null>(null);

  const openAdd = (type: typeof modalType, pid?: string) => {
    setEditing(null); setForm(emptyForm()); setModalType(type); setParentId(pid ?? null); open();
  };
  const openEdit = (asset: Asset) => {
    setEditing(asset);
    setModalType(asset.type as typeof modalType);
    setParentId(asset.parent_id ?? null);
    setForm({ name: asset.identifier, notes_md: asset.notes_md ?? "" });
    open();
  };

  const save = useMutation({
    mutationFn: () => editing
      ? updateAsset(eid, editing.id, { identifier: form.name.trim(), notes_md: form.notes_md || null })
      : createAsset(eid, { type: modalType, identifier: form.name.trim(), workstream_ids: [wsId], parent_id: parentId, notes_md: form.notes_md || null }),
    onSuccess: () => { invalidate(); close(); },
  });

  const del = useMutation({ mutationFn: (id: string) => deleteAsset(eid, id), onSuccess: invalidate });

  const setState = useMutation({
    mutationFn: ({ id, state }: { id: string; state: AssetState }) => updateAsset(eid, id, { state }),
    onSuccess: invalidate,
  });

  const MODAL_TITLES = { building: "Building", floor: "Floor", door: "Door / Entry Point", attempt: "Attempt" };

  if (q.isLoading) return <Loader />;

  return (
    <Stack>
      <Group justify="space-between">
        <Text c="dimmed" size="sm">Physical access hierarchy: Building → Floor → Door → Attempt.</Text>
        <Button color="usfGold" c="dark.9" onClick={() => openAdd("building")}>+ Add Building</Button>
      </Group>

      {buildings.length === 0 ? (
        <Text c="dimmed" ta="center">No buildings added yet.</Text>
      ) : (
        <Stack gap={4}>
          {buildings.map((b) => (
            <Stack key={b.id} gap={0}>
              {/* Building row */}
              <Group style={{ padding: "8px 12px", background: "var(--mantine-color-dark-6)", borderRadius: 6 }} justify="space-between">
                <Group gap="sm" style={{ cursor: "pointer", flex: 1 }} onClick={() => toggleB(b.id)}>
                  <ActionIcon variant="transparent" size="sm">
                    {expandedBuildings.has(b.id) ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                  </ActionIcon>
                  <Text fw={700}>{b.identifier}</Text>
                  <Badge size="xs" color="grape">{floorsFor(b.id).length} floors</Badge>
                </Group>
                <Group gap={4}>
                  <Button size="xs" variant="subtle" onClick={() => { openAdd("floor", b.id); setExpandedBuildings((p) => new Set([...p, b.id])); }}>+ Floor</Button>
                  <ActionIcon size="sm" variant="subtle" onClick={() => openEdit(b)}><IconEdit size={14} /></ActionIcon>
                  <ActionIcon size="sm" color="red" variant="subtle" onClick={() => del.mutate(b.id)}><IconTrash size={14} /></ActionIcon>
                </Group>
              </Group>

              <Collapse in={expandedBuildings.has(b.id)}>
                <Stack gap={0} ml={20}>
                  {floorsFor(b.id).map((f) => (
                    <Stack key={f.id} gap={0}>
                      {/* Floor row */}
                      <Group style={{ padding: "6px 12px", background: "var(--mantine-color-dark-7)", borderRadius: 4, margin: "2px 0" }} justify="space-between">
                        <Group gap="sm" style={{ cursor: "pointer", flex: 1 }} onClick={() => toggleF(f.id)}>
                          <ActionIcon variant="transparent" size="xs">
                            {expandedFloors.has(f.id) ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
                          </ActionIcon>
                          <Text size="sm" fw={600}>{f.identifier}</Text>
                          <Badge size="xs" color="cyan" variant="light">{doorsFor(f.id).length} doors</Badge>
                        </Group>
                        <Group gap={4}>
                          <Button size="xs" variant="subtle" onClick={() => { openAdd("door", f.id); setExpandedFloors((p) => new Set([...p, f.id])); }}>+ Door</Button>
                          <ActionIcon size="xs" variant="subtle" onClick={() => openEdit(f)}><IconEdit size={12} /></ActionIcon>
                          <ActionIcon size="xs" color="red" variant="subtle" onClick={() => del.mutate(f.id)}><IconTrash size={12} /></ActionIcon>
                        </Group>
                      </Group>

                      <Collapse in={expandedFloors.has(f.id)}>
                        <Stack gap={0} ml={20}>
                          {doorsFor(f.id).map((d) => (
                            <Stack key={d.id} gap={0}>
                              {/* Door row */}
                              <Group style={{ padding: "6px 12px", background: "var(--mantine-color-dark-8)", borderRadius: 4, margin: "2px 0" }} justify="space-between">
                                <Group gap="sm" style={{ cursor: "pointer", flex: 1 }} onClick={() => toggleD(d.id)}>
                                  <ActionIcon variant="transparent" size="xs">
                                    {expandedDoors.has(d.id) ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
                                  </ActionIcon>
                                  <Text size="sm">{d.identifier}</Text>
                                  <Select
                                    size="xs"
                                    variant="unstyled"
                                    data={DOOR_STATES.map((s) => ({ value: s.value, label: s.label }))}
                                    value={d.state}
                                    onChange={(v) => v && setState.mutate({ id: d.id, state: v as AssetState })}
                                    allowDeselect={false}
                                    w={100}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </Group>
                                <Group gap={4}>
                                  <Button size="xs" variant="subtle" onClick={() => { openAdd("attempt", d.id); setExpandedDoors((p) => new Set([...p, d.id])); }}>+ Attempt</Button>
                                  <ActionIcon size="xs" variant="subtle" onClick={() => openEdit(d)}><IconEdit size={12} /></ActionIcon>
                                  <ActionIcon size="xs" color="red" variant="subtle" onClick={() => del.mutate(d.id)}><IconTrash size={12} /></ActionIcon>
                                </Group>
                              </Group>

                              <Collapse in={expandedDoors.has(d.id)}>
                                <Stack gap={0} ml={20}>
                                  {attemptsFor(d.id).map((a) => (
                                    <Group key={a.id} style={{ padding: "4px 12px" }} justify="space-between">
                                      <Group gap="sm">
                                        <Text size="xs" c="dimmed">›</Text>
                                        <Text size="sm">{a.identifier}</Text>
                                        <Select
                                          size="xs"
                                          variant="unstyled"
                                          data={ATTEMPT_STATES.map((s) => ({ value: s.value, label: s.label }))}
                                          value={a.state}
                                          onChange={(v) => v && setState.mutate({ id: a.id, state: v as AssetState })}
                                          allowDeselect={false}
                                          w={100}
                                        />
                                      </Group>
                                      <Group gap={4}>
                                        <ActionIcon size="xs" variant="subtle" onClick={() => openEdit(a)}><IconEdit size={12} /></ActionIcon>
                                        <ActionIcon size="xs" color="red" variant="subtle" onClick={() => del.mutate(a.id)}><IconTrash size={12} /></ActionIcon>
                                      </Group>
                                    </Group>
                                  ))}
                                  {attemptsFor(d.id).length === 0 && (
                                    <Text size="xs" c="dimmed" pl="sm">No attempts logged. Click "+ Attempt" to add one.</Text>
                                  )}
                                </Stack>
                              </Collapse>
                            </Stack>
                          ))}
                          {doorsFor(f.id).length === 0 && (
                            <Text size="xs" c="dimmed" pl="sm">No doors on this floor.</Text>
                          )}
                        </Stack>
                      </Collapse>
                    </Stack>
                  ))}
                  {floorsFor(b.id).length === 0 && (
                    <Text size="sm" c="dimmed" pl="sm">No floors added.</Text>
                  )}
                </Stack>
              </Collapse>
            </Stack>
          ))}
        </Stack>
      )}

      <Modal opened={modal} onClose={close} title={`${editing ? "Edit" : "Add"} ${MODAL_TITLES[modalType]}`} centered>
        <Stack>
          <TextInput
            label="Name / description"
            required
            placeholder={modalType === "building" ? "Main Campus" : modalType === "floor" ? "Floor 2 / Basement" : modalType === "door" ? "Server Room Door" : "Attempt 1"}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
          />
          <Textarea label="Notes" autosize minRows={2} value={form.notes_md} onChange={(e) => setForm({ ...form, notes_md: e.currentTarget.value })} />
          <Button color="usfGreen" disabled={!form.name.trim()} loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
