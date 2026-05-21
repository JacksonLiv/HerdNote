import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconEdit, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { patchWorkstream, type Workstream } from "../api/client";

interface DomainInfo {
  forest: string;
  domain: string;
  netbios: string;
  functional_level: string;
  dc_fqdn: string;
  user_count: string;
  computer_count: string;
  notes: string;
}

interface DomainTrust {
  id: string;
  trusted_domain: string;
  direction: string;
  type: string;
  transitive: string;
  sid_filtering: string;
  notes: string;
}

interface ADCSInfo {
  ca_name: string;
  ca_server: string;
  web_enrollment: string;
  vuln_templates: string;
}

interface PasswordPolicy {
  min_length: string;
  lockout_threshold: string;
  lockout_duration: string;
  complexity: string;
  notes: string;
}

function emptyInfo(): DomainInfo {
  return { forest: "", domain: "", netbios: "", functional_level: "", dc_fqdn: "", user_count: "", computer_count: "", notes: "" };
}
function emptyTrust(): DomainTrust {
  return { id: crypto.randomUUID(), trusted_domain: "", direction: "Bidirectional", type: "Forest", transitive: "Yes", sid_filtering: "Enabled", notes: "" };
}
function emptyADCS(): ADCSInfo {
  return { ca_name: "", ca_server: "", web_enrollment: "No", vuln_templates: "" };
}
function emptyPolicy(): PasswordPolicy {
  return { min_length: "", lockout_threshold: "", lockout_duration: "", complexity: "Yes", notes: "" };
}

const FUNC_LEVELS = ["2008 R2", "2012", "2012 R2", "2016", "2019", "2022"];
const TRUST_DIRECTIONS = ["Inbound", "Outbound", "Bidirectional"];
const TRUST_TYPES = ["Forest", "External", "Realm", "Shortcut"];

export function ADDomainTab({ eid, ws }: { eid: string; ws: Workstream }) {
  const qc = useQueryClient();
  const meta = (ws.meta ?? {}) as Record<string, unknown>;
  const info: DomainInfo = (meta.ad_domain_info as DomainInfo) ?? emptyInfo();
  const trusts: DomainTrust[] = (meta.ad_trusts as DomainTrust[]) ?? [];
  const adcs: ADCSInfo = (meta.ad_cs as ADCSInfo) ?? emptyADCS();
  const policy: PasswordPolicy = (meta.ad_password_policy as PasswordPolicy) ?? emptyPolicy();

  const [infoForm, setInfoForm] = useState<DomainInfo>(info);
  const [trustForm, setTrustForm] = useState<DomainTrust>(emptyTrust());
  const [adcsForm, setAdcsForm] = useState<ADCSInfo>(adcs);
  const [policyForm, setPolicyForm] = useState<PasswordPolicy>(policy);
  const [trustOpened, { open: openTrust, close: closeTrust }] = useDisclosure(false);
  const [editingTrust, setEditingTrust] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      patchWorkstream(eid, ws.id, { meta: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["engagement", eid] }),
  });

  const saveTrust = () => {
    const updated = editingTrust
      ? trusts.map((t) => (t.id === editingTrust ? trustForm : t))
      : [...trusts, { ...trustForm, id: crypto.randomUUID() }];
    save.mutate({ ad_trusts: updated });
    closeTrust();
    setEditingTrust(null);
    setTrustForm(emptyTrust());
  };

  const deleteTrust = (id: string) => {
    save.mutate({ ad_trusts: trusts.filter((t) => t.id !== id) });
  };

  const openEditTrust = (t: DomainTrust) => {
    setTrustForm(t);
    setEditingTrust(t.id);
    openTrust();
  };

  return (
    <Stack gap="lg">
      {/* Domain Info */}
      <Card withBorder>
        <Title order={5} mb="sm">Domain Information</Title>
        <SimpleGrid cols={{ base: 2, sm: 3 }} mb="sm">
          <TextInput label="Forest" value={infoForm.forest} onChange={(e) => setInfoForm({ ...infoForm, forest: e.currentTarget.value })} onBlur={() => save.mutate({ ad_domain_info: infoForm })} />
          <TextInput label="Domain (FQDN)" value={infoForm.domain} onChange={(e) => setInfoForm({ ...infoForm, domain: e.currentTarget.value })} onBlur={() => save.mutate({ ad_domain_info: infoForm })} />
          <TextInput label="NetBIOS Name" value={infoForm.netbios} onChange={(e) => setInfoForm({ ...infoForm, netbios: e.currentTarget.value })} onBlur={() => save.mutate({ ad_domain_info: infoForm })} />
          <Select label="Functional Level" data={FUNC_LEVELS} value={infoForm.functional_level || null} onChange={(v) => { const u = { ...infoForm, functional_level: v ?? "" }; setInfoForm(u); save.mutate({ ad_domain_info: u }); }} clearable />
          <TextInput label="Primary DC (FQDN)" value={infoForm.dc_fqdn} onChange={(e) => setInfoForm({ ...infoForm, dc_fqdn: e.currentTarget.value })} onBlur={() => save.mutate({ ad_domain_info: infoForm })} />
          <TextInput label="Notes" value={infoForm.notes} onChange={(e) => setInfoForm({ ...infoForm, notes: e.currentTarget.value })} onBlur={() => save.mutate({ ad_domain_info: infoForm })} />
        </SimpleGrid>
        <Group gap="md">
          <TextInput label="User count" value={infoForm.user_count} onChange={(e) => setInfoForm({ ...infoForm, user_count: e.currentTarget.value })} onBlur={() => save.mutate({ ad_domain_info: infoForm })} style={{ width: 120 }} />
          <TextInput label="Computer count" value={infoForm.computer_count} onChange={(e) => setInfoForm({ ...infoForm, computer_count: e.currentTarget.value })} onBlur={() => save.mutate({ ad_domain_info: infoForm })} style={{ width: 140 }} />
        </Group>
      </Card>

      {/* Domain Trusts */}
      <Card withBorder>
        <Group justify="space-between" mb="sm">
          <Title order={5}>Domain Trusts</Title>
          <Button size="xs" color="usfGold" c="dark.9" leftSection={<IconPlus size={14} />} onClick={() => { setTrustForm(emptyTrust()); setEditingTrust(null); openTrust(); }}>
            Add Trust
          </Button>
        </Group>
        {trusts.length === 0 ? (
          <Text c="dimmed" size="sm">No trusts recorded.</Text>
        ) : (
          <Table withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Trusted Domain</Table.Th>
                <Table.Th>Direction</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Transitive</Table.Th>
                <Table.Th>SID Filtering</Table.Th>
                <Table.Th>Notes</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {trusts.map((t) => (
                <Table.Tr key={t.id}>
                  <Table.Td><Text ff="monospace" size="sm">{t.trusted_domain}</Text></Table.Td>
                  <Table.Td><Badge size="sm" color="blue">{t.direction}</Badge></Table.Td>
                  <Table.Td><Text size="sm">{t.type}</Text></Table.Td>
                  <Table.Td><Text size="sm">{t.transitive}</Text></Table.Td>
                  <Table.Td>
                    <Badge size="sm" color={t.sid_filtering === "Disabled" ? "red" : "green"}>
                      {t.sid_filtering}
                    </Badge>
                  </Table.Td>
                  <Table.Td><Text size="xs" c="dimmed" lineClamp={1}>{t.notes || "—"}</Text></Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon size="sm" variant="subtle" onClick={() => openEditTrust(t)}><IconEdit size={13} /></ActionIcon>
                      <ActionIcon size="sm" color="red" variant="subtle" onClick={() => deleteTrust(t.id)}><IconTrash size={13} /></ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Password Policy + AD CS side-by-side */}
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <Card withBorder>
          <Title order={5} mb="sm">Password Policy</Title>
          <Stack gap="xs">
            <Group grow>
              <TextInput label="Min length" value={policyForm.min_length} onChange={(e) => setPolicyForm({ ...policyForm, min_length: e.currentTarget.value })} onBlur={() => save.mutate({ ad_password_policy: policyForm })} />
              <TextInput label="Lockout threshold" value={policyForm.lockout_threshold} onChange={(e) => setPolicyForm({ ...policyForm, lockout_threshold: e.currentTarget.value })} onBlur={() => save.mutate({ ad_password_policy: policyForm })} />
            </Group>
            <Group grow>
              <TextInput label="Lockout duration" value={policyForm.lockout_duration} onChange={(e) => setPolicyForm({ ...policyForm, lockout_duration: e.currentTarget.value })} onBlur={() => save.mutate({ ad_password_policy: policyForm })} />
              <Select label="Complexity" data={["Yes", "No"]} value={policyForm.complexity} onChange={(v) => { const u = { ...policyForm, complexity: v ?? "Yes" }; setPolicyForm(u); save.mutate({ ad_password_policy: u }); }} allowDeselect={false} />
            </Group>
            <TextInput label="Notes" value={policyForm.notes} onChange={(e) => setPolicyForm({ ...policyForm, notes: e.currentTarget.value })} onBlur={() => save.mutate({ ad_password_policy: policyForm })} />
          </Stack>
        </Card>

        <Card withBorder>
          <Title order={5} mb="sm">AD Certificate Services</Title>
          <Stack gap="xs">
            <TextInput label="CA Name" value={adcsForm.ca_name} onChange={(e) => setAdcsForm({ ...adcsForm, ca_name: e.currentTarget.value })} onBlur={() => save.mutate({ ad_cs: adcsForm })} />
            <TextInput label="CA Server" value={adcsForm.ca_server} onChange={(e) => setAdcsForm({ ...adcsForm, ca_server: e.currentTarget.value })} onBlur={() => save.mutate({ ad_cs: adcsForm })} />
            <Select label="Web Enrollment" data={["Yes", "No", "Unknown"]} value={adcsForm.web_enrollment} onChange={(v) => { const u = { ...adcsForm, web_enrollment: v ?? "No" }; setAdcsForm(u); save.mutate({ ad_cs: u }); }} allowDeselect={false} />
            <TextInput label="Vulnerable templates (comma-separated)" value={adcsForm.vuln_templates} onChange={(e) => setAdcsForm({ ...adcsForm, vuln_templates: e.currentTarget.value })} onBlur={() => save.mutate({ ad_cs: adcsForm })} placeholder="ESC1, ESC8..." />
            {adcsForm.vuln_templates && (
              <Group gap="xs" mt={4}>
                {adcsForm.vuln_templates.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
                  <Badge key={t} color="red" size="sm">{t}</Badge>
                ))}
              </Group>
            )}
          </Stack>
        </Card>
      </SimpleGrid>

      {/* Trust modal */}
      <Modal opened={trustOpened} onClose={closeTrust} title={editingTrust ? "Edit Trust" : "Add Domain Trust"} centered size="md">
        <Stack>
          <TextInput label="Trusted domain" required value={trustForm.trusted_domain} onChange={(e) => setTrustForm({ ...trustForm, trusted_domain: e.currentTarget.value })} />
          <Group grow>
            <Select label="Direction" data={TRUST_DIRECTIONS} value={trustForm.direction} onChange={(v) => setTrustForm({ ...trustForm, direction: v ?? "Bidirectional" })} allowDeselect={false} />
            <Select label="Type" data={TRUST_TYPES} value={trustForm.type} onChange={(v) => setTrustForm({ ...trustForm, type: v ?? "Forest" })} allowDeselect={false} />
          </Group>
          <Group grow>
            <Select label="Transitive" data={["Yes", "No"]} value={trustForm.transitive} onChange={(v) => setTrustForm({ ...trustForm, transitive: v ?? "Yes" })} allowDeselect={false} />
            <Select label="SID Filtering" data={["Enabled", "Disabled"]} value={trustForm.sid_filtering} onChange={(v) => setTrustForm({ ...trustForm, sid_filtering: v ?? "Enabled" })} allowDeselect={false} />
          </Group>
          {trustForm.sid_filtering === "Disabled" && (
            <Badge color="red" size="lg">SID filtering disabled — potential attack path!</Badge>
          )}
          <TextInput label="Notes" value={trustForm.notes} onChange={(e) => setTrustForm({ ...trustForm, notes: e.currentTarget.value })} />
          <Button color="usfGreen" disabled={!trustForm.trusted_domain.trim()} loading={save.isPending} onClick={saveTrust}>Save</Button>
        </Stack>
      </Modal>

      <Divider />
      <Text size="xs" c="dimmed">All fields autosave on blur.</Text>
    </Stack>
  );
}
