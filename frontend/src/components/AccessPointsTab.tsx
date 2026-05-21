import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Group,
  Loader,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconEdit, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { createAsset, deleteAsset, listAssets, updateAsset, type Asset } from "../api/client";

const CRYPTO_OPTIONS = ["Open", "WEP", "WPA2-PSK", "WPA3-PSK", "WPA-Enterprise", "WPA2-Enterprise", "WPA3-Enterprise"];
const CRYPTO_COLOR: Record<string, string> = {
  Open: "red", WEP: "orange", "WPA2-PSK": "yellow", "WPA3-PSK": "usfGreen",
  "WPA-Enterprise": "blue", "WPA2-Enterprise": "blue", "WPA3-Enterprise": "usfGreen",
};
const BANDS = ["2.4 GHz", "5 GHz", "6 GHz"];
const EAP_TYPES = ["PEAP", "EAP-TLS", "EAP-TTLS", "EAP-MD5", "EAP-FAST", "Other"];
const ATTACK_METHODS = [
  "None", "Handshake Capture", "PMKID", "PMKID-Clientless",
  "Pixie-Dust", "WPS Brute Force", "Evil Twin", "Deauth + Capture",
];
const MFP_OPTIONS = ["Not enforced", "Optional", "Required", "Unknown"];

interface APForm {
  ssid: string;
  bssid: string;
  channel: string;
  band: string;
  crypto: string;
  signal: string;
  psk: string;
  vendor: string;
  hidden: boolean;
  wps_enabled: boolean;
  eap_type: string;
  mfp: string;
  attack_method: string;
  client_count: string;
  notes: string;
}

const emptyForm = (): APForm => ({
  ssid: "", bssid: "", channel: "", band: "2.4 GHz", crypto: "WPA2-PSK",
  signal: "", psk: "", vendor: "", hidden: false, wps_enabled: false,
  eap_type: "", mfp: "Unknown", attack_method: "None", client_count: "", notes: "",
});

export function AccessPointsTab({ eid, wsId }: { eid: string; wsId: string }) {
  const qc = useQueryClient();
  const qk = ["assets", eid, wsId];
  const [opened, { open, close }] = useDisclosure(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [form, setForm] = useState<APForm>(emptyForm());

  const q = useQuery({ queryKey: qk, queryFn: () => listAssets(eid, wsId) });
  const aps = (q.data ?? []).filter((a) => a.type === "ap");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["assets", eid] });

  const wpsCount = aps.filter((a) => (a.meta as Record<string, unknown>).wps_enabled).length;
  const openCount = aps.filter((a) => String((a.meta as Record<string, unknown>).crypto) === "Open").length;
  const crackedCount = aps.filter((a) => (a.meta as Record<string, unknown>).psk).length;

  const buildMeta = () => ({
    bssid: form.bssid || null,
    channel: form.channel ? Number(form.channel) : null,
    band: form.band,
    crypto: form.crypto,
    signal: form.signal || null,
    psk: form.psk || null,
    vendor: form.vendor || null,
    hidden: form.hidden,
    wps_enabled: form.wps_enabled,
    eap_type: form.eap_type || null,
    mfp: form.mfp,
    attack_method: form.attack_method,
    client_count: form.client_count ? Number(form.client_count) : null,
  });

  const openNew = () => { setEditing(null); setForm(emptyForm()); open(); };
  const openEdit = (ap: Asset) => {
    const m = ap.meta as Record<string, unknown>;
    setEditing(ap);
    setForm({
      ssid: ap.identifier,
      bssid: String(m.bssid ?? ""),
      channel: String(m.channel ?? ""),
      band: String(m.band ?? "2.4 GHz"),
      crypto: String(m.crypto ?? "WPA2-PSK"),
      signal: String(m.signal ?? ""),
      psk: String(m.psk ?? ""),
      vendor: String(m.vendor ?? ""),
      hidden: !!m.hidden,
      wps_enabled: !!m.wps_enabled,
      eap_type: String(m.eap_type ?? ""),
      mfp: String(m.mfp ?? "Unknown"),
      attack_method: String(m.attack_method ?? "None"),
      client_count: String(m.client_count ?? ""),
      notes: ap.notes_md ?? "",
    });
    open();
  };

  const add = useMutation({
    mutationFn: () =>
      editing
        ? updateAsset(eid, editing.id, { identifier: form.ssid.trim(), notes_md: form.notes || null, meta: buildMeta() })
        : createAsset(eid, { identifier: form.ssid.trim(), type: "ap", workstream_ids: [wsId], notes_md: form.notes || null, meta: buildMeta() }),
    onSuccess: () => { invalidate(); close(); setForm(emptyForm()); setEditing(null); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteAsset(eid, id),
    onSuccess: invalidate,
  });

  const isEnterprise = (crypto: string) => crypto.includes("Enterprise");

  if (q.isLoading) return <Loader />;

  return (
    <Stack>
      <Group justify="space-between">
        <Group gap="xs">
          <Text c="dimmed" size="sm">Wireless access points discovered during the assessment.</Text>
          {openCount > 0 && <Badge color="red" size="sm">{openCount} Open</Badge>}
          {wpsCount > 0 && <Badge color="orange" size="sm">{wpsCount} WPS</Badge>}
          {crackedCount > 0 && <Badge color="usfGreen" size="sm">{crackedCount} cracked</Badge>}
        </Group>
        <Button color="usfGold" c="dark.9" onClick={openNew}>+ Add AP</Button>
      </Group>

      {aps.length === 0 ? (
        <Text c="dimmed" ta="center">No access points yet.</Text>
      ) : (
        <Table highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>SSID</Table.Th>
              <Table.Th>BSSID</Table.Th>
              <Table.Th>Ch / Band</Table.Th>
              <Table.Th>Security</Table.Th>
              <Table.Th>Signal</Table.Th>
              <Table.Th>Flags</Table.Th>
              <Table.Th>Attack</Table.Th>
              <Table.Th>PSK</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {aps.map((ap) => {
              const m = ap.meta as Record<string, unknown>;
              return (
                <Table.Tr key={ap.id}>
                  <Table.Td>
                    <Group gap={4}>
                      <Text fw={600} ff="monospace">{ap.identifier}</Text>
                      {!!m.hidden && <Badge size="xs" color="gray" variant="outline">hidden</Badge>}
                    </Group>
                  </Table.Td>
                  <Table.Td><Text ff="monospace" size="xs" c="dimmed">{String(m.bssid ?? "—")}</Text></Table.Td>
                  <Table.Td><Text size="sm">{String(m.channel ?? "—")} · {String(m.band ?? "")}</Text></Table.Td>
                  <Table.Td>
                    <Stack gap={2}>
                      <Badge color={CRYPTO_COLOR[String(m.crypto)] ?? "gray"} size="sm">{String(m.crypto ?? "—")}</Badge>
                      {!!m.eap_type && <Badge size="xs" color="blue" variant="outline">{String(m.eap_type)}</Badge>}
                    </Stack>
                  </Table.Td>
                  <Table.Td><Text size="sm">{String(m.signal ?? "—")}</Text></Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {!!m.wps_enabled && <Badge size="xs" color="orange">WPS</Badge>}
                      {String(m.mfp) !== "Required" && String(m.mfp) !== "Unknown" && <Badge size="xs" color="yellow">MFP: {String(m.mfp)}</Badge>}
                      {!!m.vendor && <Text size="xs" c="dimmed">{String(m.vendor)}</Text>}
                    </Group>
                  </Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{String(m.attack_method ?? "None")}</Text></Table.Td>
                  <Table.Td>
                    {m.psk ? (
                      <Badge color="usfGreen" variant="light" size="sm">cracked</Badge>
                    ) : (
                      <Text size="xs" c="dimmed">—</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon size="sm" variant="subtle" onClick={() => openEdit(ap)}>
                        <IconEdit size={14} />
                      </ActionIcon>
                      <ActionIcon size="sm" color="red" variant="subtle" onClick={() => del.mutate(ap.id)}>
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

      <Modal opened={opened} onClose={close} title={editing ? "Edit Access Point" : "Add Access Point"} centered size="lg">
        <Stack>
          <Group grow>
            <TextInput label="SSID" required value={form.ssid} onChange={(e) => setForm({ ...form, ssid: e.currentTarget.value })} />
            <TextInput label="BSSID" placeholder="aa:bb:cc:dd:ee:ff" value={form.bssid} onChange={(e) => setForm({ ...form, bssid: e.currentTarget.value })} />
          </Group>
          <Group grow>
            <TextInput label="Vendor / OUI" placeholder="Cisco, Ubiquiti..." value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.currentTarget.value })} />
            <NumberInput label="Channel" value={form.channel ? Number(form.channel) : ""} onChange={(v) => setForm({ ...form, channel: String(v) })} min={1} max={196} />
          </Group>
          <Group grow>
            <Select label="Band" data={BANDS} value={form.band} onChange={(v) => setForm({ ...form, band: v ?? "2.4 GHz" })} allowDeselect={false} />
            <TextInput label="Signal (dBm)" value={form.signal} onChange={(e) => setForm({ ...form, signal: e.currentTarget.value })} />
          </Group>
          <Group grow>
            <Select label="Security" data={CRYPTO_OPTIONS} value={form.crypto} onChange={(v) => setForm({ ...form, crypto: v ?? "WPA2-PSK" })} allowDeselect={false} />
            <Select label="MFP (802.11w)" data={MFP_OPTIONS} value={form.mfp} onChange={(v) => setForm({ ...form, mfp: v ?? "Unknown" })} allowDeselect={false} />
          </Group>
          {isEnterprise(form.crypto) && (
            <Select label="EAP Type" data={EAP_TYPES} value={form.eap_type || null} onChange={(v) => setForm({ ...form, eap_type: v ?? "" })} clearable />
          )}
          <Select label="Attack method used" data={ATTACK_METHODS} value={form.attack_method} onChange={(v) => setForm({ ...form, attack_method: v ?? "None" })} allowDeselect={false} />
          <TextInput label="PSK / Password (if cracked)" value={form.psk} onChange={(e) => setForm({ ...form, psk: e.currentTarget.value })} />
          <Group>
            <NumberInput label="Client count (observed)" value={form.client_count ? Number(form.client_count) : ""} onChange={(v) => setForm({ ...form, client_count: String(v) })} min={0} style={{ width: 160 }} />
          </Group>
          <Group>
            <Checkbox label="Hidden SSID" checked={form.hidden} onChange={(e) => setForm({ ...form, hidden: e.currentTarget.checked })} />
            <Checkbox label="WPS enabled" checked={form.wps_enabled} onChange={(e) => setForm({ ...form, wps_enabled: e.currentTarget.checked })} />
          </Group>
          <TextInput label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })} />
          <Button color="usfGreen" disabled={!form.ssid.trim()} loading={add.isPending} onClick={() => add.mutate()}>Save</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
