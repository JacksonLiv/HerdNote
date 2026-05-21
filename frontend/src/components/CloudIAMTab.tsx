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

const ENTITY_TYPES = [
  "IAM User", "IAM Role", "Service Account", "Instance Profile",
  "Function Role", "Managed Policy", "Permission Boundary",
  "Service Control Policy", "Conditional Access Policy", "Other",
];
const PROVIDERS = ["AWS", "Azure", "GCP"];
const RISK_LEVELS: { value: string; label: string; color: string }[] = [
  { value: "none", label: "No risk", color: "gray" },
  { value: "overpermissive", label: "Overpermissive", color: "yellow" },
  { value: "privilege_escalation", label: "Priv esc path", color: "orange" },
  { value: "cross_account", label: "Cross-account", color: "blue" },
  { value: "public_assume", label: "Public assume", color: "red" },
  { value: "admin_equivalent", label: "Admin equivalent", color: "red" },
];

interface IAMForm {
  name: string;
  entity_type: string;
  provider: string;
  account_id: string;
  permissions: string;
  risk: string;
  notes: string;
}

const emptyForm = (): IAMForm => ({ name: "", entity_type: "IAM Role", provider: "AWS", account_id: "", permissions: "", risk: "none", notes: "" });

export function CloudIAMTab({ eid, wsId }: { eid: string; wsId: string }) {
  const qc = useQueryClient();
  const qk = ["assets", eid, wsId];
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState<IAMForm>(emptyForm());
  const [riskFilter, setRiskFilter] = useState<string>("all");

  const q = useQuery({ queryKey: qk, queryFn: () => listAssets(eid, wsId) });
  const allEntities = (q.data ?? []).filter((a) => a.type === "iam_entity");
  const entities = allEntities.filter((e) => {
    if (riskFilter === "all") return true;
    return (e.meta as Record<string, unknown>).risk === riskFilter;
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["assets", eid] });

  const highRisk = allEntities.filter((e) => {
    const r = String((e.meta as Record<string, unknown>).risk ?? "none");
    return ["privilege_escalation", "public_assume", "admin_equivalent"].includes(r);
  }).length;

  const add = useMutation({
    mutationFn: () =>
      createAsset(eid, {
        identifier: form.name.trim(),
        type: "iam_entity",
        workstream_ids: [wsId],
        notes_md: form.notes || null,
        meta: {
          entity_type: form.entity_type,
          provider: form.provider,
          account_id: form.account_id || null,
          permissions: form.permissions || null,
          risk: form.risk,
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
          <Text c="dimmed" size="sm">IAM identities, roles, and policies discovered during the assessment.</Text>
          {highRisk > 0 && <Badge color="red" size="sm">{highRisk} high-risk</Badge>}
        </Group>
        <Button color="usfGold" c="dark.9" onClick={open}>+ Add IAM Entity</Button>
      </Group>

      <Group gap="xs">
        <Badge size="md" variant={riskFilter === "all" ? "filled" : "outline"} color="usfGreen" style={{ cursor: "pointer" }} onClick={() => setRiskFilter("all")}>All</Badge>
        {RISK_LEVELS.filter((r) => r.value !== "none").map((r) => (
          <Badge key={r.value} size="md" variant={riskFilter === r.value ? "filled" : "outline"} color={r.color} style={{ cursor: "pointer" }} onClick={() => setRiskFilter(r.value)}>
            {r.label}
          </Badge>
        ))}
      </Group>

      {entities.length === 0 ? (
        <Text c="dimmed" ta="center">No IAM entities recorded yet.</Text>
      ) : (
        <Table highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name / ARN</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Provider</Table.Th>
              <Table.Th>Account / Tenant</Table.Th>
              <Table.Th>Key Permissions</Table.Th>
              <Table.Th>Risk</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {entities.map((e) => {
              const m = e.meta as Record<string, unknown>;
              const risk = RISK_LEVELS.find((r) => r.value === String(m.risk ?? "none")) ?? RISK_LEVELS[0];
              return (
                <Table.Tr key={e.id}>
                  <Table.Td><Text ff="monospace" size="sm" fw={600} lineClamp={1}>{e.identifier}</Text></Table.Td>
                  <Table.Td><Text size="sm">{String(m.entity_type ?? "—")}</Text></Table.Td>
                  <Table.Td><Badge size="sm" color="blue" variant="light">{String(m.provider ?? "—")}</Badge></Table.Td>
                  <Table.Td><Text size="xs" c="dimmed" ff="monospace">{String(m.account_id ?? "—")}</Text></Table.Td>
                  <Table.Td><Text size="xs" c="dimmed" lineClamp={1}>{String(m.permissions ?? "—")}</Text></Table.Td>
                  <Table.Td><Badge size="sm" color={risk.color}>{risk.label}</Badge></Table.Td>
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

      <Modal opened={opened} onClose={close} title="Add IAM Entity" centered size="md">
        <Stack>
          <TextInput label="Name / ARN" required placeholder="arn:aws:iam::123:role/AdminRole" value={form.name} onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} />
          <Group grow>
            <Select label="Provider" data={PROVIDERS} value={form.provider} onChange={(v) => setForm({ ...form, provider: v ?? "AWS" })} allowDeselect={false} />
            <Select label="Entity type" data={ENTITY_TYPES} value={form.entity_type} onChange={(v) => setForm({ ...form, entity_type: v ?? "IAM Role" })} allowDeselect={false} />
          </Group>
          <TextInput label="Account / Tenant / Project ID" value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.currentTarget.value })} />
          <TextInput label="Key permissions" placeholder="s3:*, iam:PassRole, AdministratorAccess..." value={form.permissions} onChange={(e) => setForm({ ...form, permissions: e.currentTarget.value })} />
          <Select label="Risk level" data={RISK_LEVELS.map((r) => ({ value: r.value, label: r.label }))} value={form.risk} onChange={(v) => setForm({ ...form, risk: v ?? "none" })} allowDeselect={false} />
          <Textarea label="Notes / CLI evidence" autosize minRows={2} ff="monospace" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })} placeholder="aws iam get-role --role-name ..." />
          <Button color="usfGreen" disabled={!form.name.trim()} loading={add.isPending} onClick={() => add.mutate()}>Save</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
