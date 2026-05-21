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
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { createAsset, deleteAsset, listAssets, updateAsset, type AssetState } from "../api/client";

const CLIENT_STATES: { value: AssetState; label: string; color: string }[] = [
  { value: "untouched", label: "Observed", color: "gray" },
  { value: "enumerated", label: "Probed", color: "blue" },
  { value: "exploited", label: "Deauthed", color: "yellow" },
  { value: "compromised", label: "Captured", color: "red" },
  { value: "cleaned", label: "N/A", color: "dark" },
];

interface ClientForm {
  mac: string;
  vendor: string;
  associated_ap: string;
  signal: string;
  probes: string;
  notes: string;
}

const emptyForm = (): ClientForm => ({ mac: "", vendor: "", associated_ap: "", signal: "", probes: "", notes: "" });

export function WirelessClientsTab({ eid, wsId }: { eid: string; wsId: string }) {
  const qc = useQueryClient();
  const qk = ["assets", eid, wsId];
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState<ClientForm>(emptyForm());

  const q = useQuery({ queryKey: qk, queryFn: () => listAssets(eid, wsId) });
  const clients = (q.data ?? []).filter((a) => a.type === "client");
  const aps = (q.data ?? []).filter((a) => a.type === "ap");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["assets", eid] });

  const add = useMutation({
    mutationFn: () =>
      createAsset(eid, {
        identifier: form.mac.trim(),
        type: "client",
        workstream_ids: [wsId],
        notes_md: form.notes || null,
        meta: {
          vendor: form.vendor || null,
          associated_ap: form.associated_ap || null,
          signal: form.signal || null,
          probes: form.probes ? form.probes.split(",").map((s) => s.trim()).filter(Boolean) : [],
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
        <Text c="dimmed" size="sm">Wireless client stations observed during the assessment.</Text>
        <Button color="usfGold" c="dark.9" onClick={open}>+ Add Client</Button>
      </Group>

      {clients.length === 0 ? (
        <Text c="dimmed" ta="center">No clients recorded yet.</Text>
      ) : (
        <Table highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>MAC Address</Table.Th>
              <Table.Th>Vendor / OUI</Table.Th>
              <Table.Th>Associated AP</Table.Th>
              <Table.Th>Signal</Table.Th>
              <Table.Th>Probe Requests</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {clients.map((c) => {
              const m = c.meta as Record<string, unknown>;
              const probeList = Array.isArray(m.probes) ? (m.probes as string[]) : [];
              return (
                <Table.Tr key={c.id}>
                  <Table.Td><Text ff="monospace" size="sm" fw={600}>{c.identifier}</Text></Table.Td>
                  <Table.Td><Text size="sm" c="dimmed">{String(m.vendor ?? "—")}</Text></Table.Td>
                  <Table.Td><Text size="sm" ff="monospace">{String(m.associated_ap ?? "—")}</Text></Table.Td>
                  <Table.Td><Text size="sm">{String(m.signal ?? "—")}</Text></Table.Td>
                  <Table.Td>
                    {probeList.length > 0 ? (
                      <Group gap={4}>
                        {probeList.slice(0, 2).map((p) => <Badge key={p} size="xs" variant="outline">{p}</Badge>)}
                        {probeList.length > 2 && <Text size="xs" c="dimmed">+{probeList.length - 2}</Text>}
                      </Group>
                    ) : <Text size="xs" c="dimmed">—</Text>}
                  </Table.Td>
                  <Table.Td>
                    <Select
                      size="xs"
                      data={CLIENT_STATES.map((s) => ({ value: s.value, label: s.label }))}
                      value={c.state}
                      onChange={(v) => v && setState.mutate({ id: c.id, state: v as AssetState })}
                      allowDeselect={false}
                      renderOption={({ option }) => {
                        const info = CLIENT_STATES.find((s) => s.value === option.value);
                        return <Badge color={info?.color ?? "gray"} size="sm">{option.label}</Badge>;
                      }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon color="red" variant="subtle" onClick={() => del.mutate(c.id)}>
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={opened} onClose={close} title="Add Wireless Client" centered>
        <Stack>
          <TextInput label="MAC address" required placeholder="aa:bb:cc:dd:ee:ff" value={form.mac} onChange={(e) => setForm({ ...form, mac: e.currentTarget.value })} />
          <TextInput label="Vendor / OUI" placeholder="Apple, Intel..." value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.currentTarget.value })} />
          <Select
            label="Associated AP (BSSID)"
            data={aps.map((a) => ({ value: String(a.identifier), label: `${a.identifier} (${String((a.meta as Record<string, unknown>).bssid ?? "")})` }))}
            value={form.associated_ap || null}
            onChange={(v) => setForm({ ...form, associated_ap: v ?? "" })}
            clearable
            searchable
            placeholder="Select AP or type BSSID"
          />
          <TextInput label="Signal (dBm)" value={form.signal} onChange={(e) => setForm({ ...form, signal: e.currentTarget.value })} />
          <TextInput label="Probe requests (comma-separated SSIDs)" value={form.probes} onChange={(e) => setForm({ ...form, probes: e.currentTarget.value })} />
          <TextInput label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })} />
          <Button color="usfGreen" disabled={!form.mac.trim()} loading={add.isPending} onClick={() => add.mutate()}>Save</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
