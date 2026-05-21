import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
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

import {
  createCampaign,
  deleteCampaign,
  listCampaigns,
  updateCampaign,
  type CampaignStatus,
  type CampaignType,
  type SocialCampaign,
  type SocialCampaignInput,
} from "../api/client";

const CAMPAIGN_TYPES: { value: CampaignType; label: string }[] = [
  { value: "email", label: "Email phishing" },
  { value: "vishing", label: "Vishing" },
  { value: "smishing", label: "Smishing" },
  { value: "usb_drop", label: "USB drop" },
  { value: "other", label: "Other" },
];

const CAMPAIGN_STATUSES: { value: CampaignStatus; label: string; color: string }[] = [
  { value: "planned", label: "Planned", color: "gray" },
  { value: "active", label: "Active", color: "green" },
  { value: "complete", label: "Complete", color: "blue" },
];

const TYPE_COLOR: Record<CampaignType, string> = {
  email: "blue", vishing: "orange", smishing: "yellow", usb_drop: "red", other: "gray",
};

const emptyForm = (): SocialCampaignInput => ({
  name: "", campaign_type: "email", campaign_status: "planned",
  sent: null, clicked: null, submitted: null, mfa_bypassed: null, reported: null,
  pretext_md: null, from_address: null, landing_url: null, tool_ref: null,
  started_at: null, ended_at: null, notes_md: null,
});

function pct(n: number | null, d: number | null): string {
  if (!n || !d) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

export function CampaignsTab({ eid, wsId }: { eid: string; wsId: string }) {
  const qc = useQueryClient();
  const qk = ["campaigns", eid, wsId];
  const [opened, { open, close }] = useDisclosure(false);
  const [editing, setEditing] = useState<SocialCampaign | null>(null);
  const [form, setForm] = useState<SocialCampaignInput>(emptyForm());

  const q = useQuery({ queryKey: qk, queryFn: () => listCampaigns(eid, wsId) });
  const campaigns = q.data ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: qk });

  const openNew = () => { setEditing(null); setForm(emptyForm()); open(); };
  const openEdit = (c: SocialCampaign) => {
    setEditing(c);
    setForm({
      name: c.name, campaign_type: c.campaign_type, campaign_status: c.campaign_status,
      sent: c.sent, clicked: c.clicked, submitted: c.submitted, mfa_bypassed: c.mfa_bypassed,
      reported: c.reported, pretext_md: c.pretext_md, from_address: c.from_address,
      landing_url: c.landing_url, tool_ref: c.tool_ref, notes_md: c.notes_md,
      started_at: c.started_at, ended_at: c.ended_at,
    });
    open();
  };

  const save = useMutation({
    mutationFn: () =>
      editing
        ? updateCampaign(eid, wsId, editing.id, form)
        : createCampaign(eid, wsId, form),
    onSuccess: () => { invalidate(); close(); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteCampaign(eid, wsId, id),
    onSuccess: invalidate,
  });

  if (q.isLoading) return <Loader />;

  const totalSent = campaigns.reduce((s, c) => s + (c.sent ?? 0), 0);
  const totalClicked = campaigns.reduce((s, c) => s + (c.clicked ?? 0), 0);
  const totalSubmitted = campaigns.reduce((s, c) => s + (c.submitted ?? 0), 0);
  const totalReported = campaigns.reduce((s, c) => s + (c.reported ?? 0), 0);

  return (
    <Stack>
      <Group justify="space-between">
        <Text c="dimmed" size="sm">Track phishing and social engineering campaigns.</Text>
        <Button color="usfGold" c="dark.9" onClick={openNew}>+ New Campaign</Button>
      </Group>

      {campaigns.length > 0 && (
        <SimpleGrid cols={{ base: 2, sm: 5 }}>
          <Card withBorder padding="sm">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Sent</Text>
            <Text size="xl" fw={800}>{totalSent}</Text>
          </Card>
          <Card withBorder padding="sm">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Clicked</Text>
            <Text size="xl" fw={800} c="yellow">{totalClicked} <Text span size="sm" c="dimmed">({pct(totalClicked, totalSent)})</Text></Text>
          </Card>
          <Card withBorder padding="sm">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Creds submitted</Text>
            <Text size="xl" fw={800} c="orange">{totalSubmitted} <Text span size="sm" c="dimmed">({pct(totalSubmitted, totalSent)})</Text></Text>
          </Card>
          <Card withBorder padding="sm">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Reported</Text>
            <Text size="xl" fw={800} c="green">{totalReported} <Text span size="sm" c="dimmed">({pct(totalReported, totalSent)})</Text></Text>
          </Card>
          <Card withBorder padding="sm">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Campaigns</Text>
            <Text size="xl" fw={800}>{campaigns.length}</Text>
          </Card>
        </SimpleGrid>
      )}

      {campaigns.length === 0 ? (
        <Text c="dimmed" ta="center">No campaigns yet.</Text>
      ) : (
        <Table highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Campaign</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>From</Table.Th>
              <Table.Th>Sent</Table.Th>
              <Table.Th>Click %</Table.Th>
              <Table.Th>Creds %</Table.Th>
              <Table.Th>MFA bypassed</Table.Th>
              <Table.Th>Reported</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {campaigns.map((c) => {
              const statusInfo = CAMPAIGN_STATUSES.find((s) => s.value === c.campaign_status) ?? CAMPAIGN_STATUSES[0];
              return (
                <Table.Tr key={c.id}>
                  <Table.Td><Text fw={600}>{c.name}</Text></Table.Td>
                  <Table.Td>
                    <Badge color={TYPE_COLOR[c.campaign_type]} size="sm">
                      {CAMPAIGN_TYPES.find((t) => t.value === c.campaign_type)?.label ?? c.campaign_type}
                    </Badge>
                  </Table.Td>
                  <Table.Td><Badge size="sm" color={statusInfo.color}>{statusInfo.label}</Badge></Table.Td>
                  <Table.Td><Text size="xs" ff="monospace" c="dimmed">{c.from_address ?? "—"}</Text></Table.Td>
                  <Table.Td>{c.sent ?? "—"}</Table.Td>
                  <Table.Td>{pct(c.clicked, c.sent)}</Table.Td>
                  <Table.Td>{pct(c.submitted, c.sent)}</Table.Td>
                  <Table.Td>{c.mfa_bypassed ?? "—"}</Table.Td>
                  <Table.Td>{c.reported ?? "—"}</Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon size="sm" variant="subtle" onClick={() => openEdit(c)}>
                        <IconEdit size={14} />
                      </ActionIcon>
                      <ActionIcon size="sm" color="red" variant="subtle" onClick={() => del.mutate(c.id)}>
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

      <Modal opened={opened} onClose={close} title={editing ? "Edit Campaign" : "New Campaign"} centered size="lg">
        <Stack>
          <Group grow>
            <TextInput label="Campaign name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} />
            <Select label="Status" data={CAMPAIGN_STATUSES.map((s) => ({ value: s.value, label: s.label }))} value={form.campaign_status ?? "planned"} onChange={(v) => setForm({ ...form, campaign_status: (v ?? "planned") as CampaignStatus })} allowDeselect={false} />
          </Group>
          <Group grow>
            <Select label="Type" data={CAMPAIGN_TYPES} value={form.campaign_type ?? "email"} onChange={(v) => setForm({ ...form, campaign_type: (v ?? "email") as CampaignType })} allowDeselect={false} />
            <TextInput label="From address / sender" placeholder="it-helpdesk@corp.com" value={form.from_address ?? ""} onChange={(e) => setForm({ ...form, from_address: e.currentTarget.value || null })} />
          </Group>
          <Group grow>
            <TextInput label="Landing page URL" placeholder="https://..." value={form.landing_url ?? ""} onChange={(e) => setForm({ ...form, landing_url: e.currentTarget.value || null })} />
            <TextInput label="Tool reference (GoPhish ID, etc.)" value={form.tool_ref ?? ""} onChange={(e) => setForm({ ...form, tool_ref: e.currentTarget.value || null })} />
          </Group>
          <Textarea label="Pretext / lure description" autosize minRows={2} value={form.pretext_md ?? ""} onChange={(e) => setForm({ ...form, pretext_md: e.currentTarget.value || null })} placeholder="Who was impersonated, what was the scenario..." />
          <SimpleGrid cols={2}>
            <NumberInput label="Sent" value={form.sent ?? ""} onChange={(v) => setForm({ ...form, sent: v === "" ? null : Number(v) })} min={0} />
            <NumberInput label="Clicked" value={form.clicked ?? ""} onChange={(v) => setForm({ ...form, clicked: v === "" ? null : Number(v) })} min={0} />
            <NumberInput label="Creds submitted" value={form.submitted ?? ""} onChange={(v) => setForm({ ...form, submitted: v === "" ? null : Number(v) })} min={0} />
            <NumberInput label="MFA bypassed" value={form.mfa_bypassed ?? ""} onChange={(v) => setForm({ ...form, mfa_bypassed: v === "" ? null : Number(v) })} min={0} />
            <NumberInput label="Reported (detected)" value={form.reported ?? ""} onChange={(v) => setForm({ ...form, reported: v === "" ? null : Number(v) })} min={0} />
          </SimpleGrid>
          <Textarea label="Notes" autosize minRows={2} value={form.notes_md ?? ""} onChange={(e) => setForm({ ...form, notes_md: e.currentTarget.value || null })} />
          <Button color="usfGreen" disabled={!form.name.trim()} loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
