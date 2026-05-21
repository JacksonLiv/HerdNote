import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Collapse,
  Code,
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
import { IconChevronDown, IconChevronRight, IconEdit, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  bulkCreateWebSubdomains,
  createWebHost,
  createWebSubdomain,
  deleteWebHost,
  deleteWebSubdomain,
  listWebHosts,
  listWebSubdomains,
  updateWebHost,
  updateWebSubdomain,
  type SubdomainAuth,
  type SubdomainState,
  type WebHost,
  type WebSubdomain,
} from "../api/client";

const STATES: { value: SubdomainState; label: string; color: string }[] = [
  { value: "untouched", label: "Untouched", color: "gray" },
  { value: "enumerated", label: "Enumerated", color: "blue" },
  { value: "exploited", label: "Exploited", color: "yellow" },
  { value: "compromised", label: "Compromised", color: "red" },
  { value: "cleaned", label: "Cleaned", color: "dark" },
];

const AUTH_OPTIONS: { value: SubdomainAuth; label: string }[] = [
  { value: "unknown", label: "Unknown" },
  { value: "none", label: "None" },
  { value: "basic", label: "Basic" },
  { value: "form", label: "Form" },
  { value: "sso", label: "SSO" },
  { value: "mfa", label: "MFA" },
  { value: "cert", label: "Cert" },
  { value: "api_key", label: "API Key" },
];

export function WebHostsTab({ eid, wsId }: { eid: string; wsId: string }) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["web-hosts", eid] });
    qc.invalidateQueries({ queryKey: ["web-subdomains", eid] });
  };

  const hostsQ = useQuery({ queryKey: ["web-hosts", eid, wsId], queryFn: () => listWebHosts(eid, wsId) });
  const subdomainsQ = useQuery({ queryKey: ["web-subdomains", eid, wsId], queryFn: () => listWebSubdomains(eid, { wsId }) });

  const [expandedHosts, setExpandedHosts] = useState<Set<string>>(new Set());
  const [editingHost, setEditingHost] = useState<WebHost | null>(null);
  const [hostForm, setHostForm] = useState({ fqdn: "", ip: "", in_scope: true, notes_md: "" });
  const [hostModal, { open: openHostModal, close: closeHostModal }] = useDisclosure(false);

  const [addSubModal, { open: openSubModal, close: closeSubModal }] = useDisclosure(false);
  const [editingSubdomain, setEditingSubdomain] = useState<WebSubdomain | null>(null);
  const [subHostId, setSubHostId] = useState<string>("");
  const [subForm, setSubForm] = useState({ fqdn: "", ip: "", status_code: "" as string | number, title: "", tech: "", auth: "unknown" as SubdomainAuth, notes_md: "" });

  const [bulkModal, { open: openBulkModal, close: closeBulkModal }] = useDisclosure(false);
  const [bulkHostId, setBulkHostId] = useState<string>("");
  const [bulkText, setBulkText] = useState("");

  const hosts = hostsQ.data ?? [];
  const allSubs = subdomainsQ.data ?? [];

  const subsForHost = (hostId: string) => allSubs.filter((s) => s.host_id === hostId);

  const toggle = (hid: string) => {
    setExpandedHosts((prev) => {
      const next = new Set(prev);
      if (next.has(hid)) next.delete(hid);
      else next.add(hid);
      return next;
    });
  };

  const openNewHost = () => { setEditingHost(null); setHostForm({ fqdn: "", ip: "", in_scope: true, notes_md: "" }); openHostModal(); };
  const openEditHost = (h: WebHost) => { setEditingHost(h); setHostForm({ fqdn: h.fqdn, ip: h.ip ?? "", in_scope: h.in_scope, notes_md: h.notes_md ?? "" }); openHostModal(); };

  const openAddSub = (hostId: string) => { setEditingSubdomain(null); setSubHostId(hostId); setSubForm({ fqdn: "", ip: "", status_code: "", title: "", tech: "", auth: "unknown", notes_md: "" }); openSubModal(); };
  const openEditSub = (s: WebSubdomain) => {
    setEditingSubdomain(s);
    setSubHostId(s.host_id);
    setSubForm({ fqdn: s.fqdn, ip: s.ip ?? "", status_code: s.status_code ?? "", title: s.title ?? "", tech: s.tech ?? "", auth: s.auth, notes_md: s.notes_md ?? "" });
    openSubModal();
  };

  const openBulk = (hostId: string) => { setBulkHostId(hostId); setBulkText(""); openBulkModal(); };

  const saveHost = useMutation({
    mutationFn: () => editingHost
      ? updateWebHost(eid, editingHost.id, { fqdn: hostForm.fqdn.trim(), ip: hostForm.ip || null, in_scope: hostForm.in_scope, notes_md: hostForm.notes_md || null })
      : createWebHost(eid, { fqdn: hostForm.fqdn.trim(), ip: hostForm.ip || null, in_scope: hostForm.in_scope, workstream_id: wsId }),
    onSuccess: () => { invalidate(); closeHostModal(); },
  });

  const delHost = useMutation({ mutationFn: (id: string) => deleteWebHost(eid, id), onSuccess: invalidate });

  const saveSub = useMutation({
    mutationFn: () => {
      const code = subForm.status_code === "" ? null : Number(subForm.status_code);
      return editingSubdomain
        ? updateWebSubdomain(eid, editingSubdomain.id, { fqdn: subForm.fqdn.trim(), ip: subForm.ip || null, status_code: code, title: subForm.title || null, tech: subForm.tech || null, auth: subForm.auth, notes_md: subForm.notes_md || null })
        : createWebSubdomain(eid, { host_id: subHostId, fqdn: subForm.fqdn.trim(), ip: subForm.ip || null, status_code: code, title: subForm.title || null, tech: subForm.tech || null, auth: subForm.auth, workstream_id: wsId });
    },
    onSuccess: () => { invalidate(); closeSubModal(); },
  });

  const delSub = useMutation({ mutationFn: (id: string) => deleteWebSubdomain(eid, id), onSuccess: invalidate });

  const patchSub = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateWebSubdomain>[2] }) => updateWebSubdomain(eid, id, patch),
    onSuccess: invalidate,
  });

  const bulkAdd = useMutation({
    mutationFn: () => bulkCreateWebSubdomains(eid, { host_id: bulkHostId, text: bulkText, workstream_id: wsId }),
    onSuccess: () => { invalidate(); closeBulkModal(); setBulkText(""); setExpandedHosts((p) => new Set([...p, bulkHostId])); },
  });

  if (hostsQ.isLoading) return <Loader />;

  return (
    <Stack>
      <Group justify="space-between">
        <Text c="dimmed" size="sm">Root domains and IPs. Expand each host to see its subdomains.</Text>
        <Button color="usfGold" c="dark.9" onClick={openNewHost}>+ Add Host</Button>
      </Group>

      {hosts.length === 0 ? (
        <Text c="dimmed" ta="center">No hosts yet. Add a root domain or IP to get started.</Text>
      ) : (
        <Stack gap={0}>
          {hosts.map((h) => {
            const subs = subsForHost(h.id);
            const expanded = expandedHosts.has(h.id);
            return (
              <Stack key={h.id} gap={0}>
                <Group
                  style={{ padding: "8px 12px", borderRadius: 6, cursor: "pointer", background: expanded ? "var(--mantine-color-dark-6)" : undefined }}
                  onClick={() => toggle(h.id)}
                  justify="space-between"
                >
                  <Group gap="sm">
                    <ActionIcon variant="transparent" size="sm" onClick={(e) => { e.stopPropagation(); toggle(h.id); }}>
                      {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                    </ActionIcon>
                    <Text fw={600}>{h.fqdn}</Text>
                    {h.ip && <Text size="sm" c="dimmed" ff="monospace">{h.ip}</Text>}
                    {!h.in_scope && <Badge color="red" size="xs">OOS</Badge>}
                    <Badge size="xs" color="blue" variant="light">{subs.length} subdomains</Badge>
                  </Group>
                  <Group gap={4} onClick={(e) => e.stopPropagation()}>
                    <ActionIcon size="sm" variant="subtle" onClick={() => { openBulk(h.id); setExpandedHosts((p) => new Set([...p, h.id])); }}>
                      <IconPlus size={14} />
                    </ActionIcon>
                    <ActionIcon size="sm" variant="subtle" onClick={() => openEditHost(h)}><IconEdit size={14} /></ActionIcon>
                    <ActionIcon size="sm" color="red" variant="subtle" onClick={() => delHost.mutate(h.id)}><IconTrash size={14} /></ActionIcon>
                  </Group>
                </Group>

                <Collapse in={expanded}>
                  <Stack gap={0} ml={24} mb="xs">
                    {subs.length === 0 ? (
                      <Text size="sm" c="dimmed" pl="sm">No subdomains. Click + to bulk import.</Text>
                    ) : (
                      <Table highlightOnHover withTableBorder fz="sm">
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>FQDN</Table.Th>
                            <Table.Th>IP</Table.Th>
                            <Table.Th>Code</Table.Th>
                            <Table.Th>Title</Table.Th>
                            <Table.Th>Tech</Table.Th>
                            <Table.Th>Auth</Table.Th>
                            <Table.Th>State</Table.Th>
                            <Table.Th>Scope</Table.Th>
                            <Table.Th />
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {subs.map((s) => (
                            <Table.Tr key={s.id}>
                              <Table.Td><Text ff="monospace" size="xs">{s.fqdn}</Text></Table.Td>
                              <Table.Td><Text size="xs" c="dimmed">{s.ip ?? "—"}</Text></Table.Td>
                              <Table.Td>
                                {s.status_code != null && (
                                  <Badge size="xs" color={s.status_code < 400 ? "green" : s.status_code < 500 ? "yellow" : "red"}>{s.status_code}</Badge>
                                )}
                              </Table.Td>
                              <Table.Td><Text size="xs" truncate maw={140}>{s.title ?? "—"}</Text></Table.Td>
                              <Table.Td><Text size="xs" c="dimmed" truncate maw={120}>{s.tech ?? "—"}</Text></Table.Td>
                              <Table.Td>
                                <Select
                                  size="xs"
                                  variant="unstyled"
                                  data={AUTH_OPTIONS}
                                  value={s.auth}
                                  onChange={(v) => v && patchSub.mutate({ id: s.id, patch: { auth: v as SubdomainAuth } })}
                                  allowDeselect={false}
                                  w={80}
                                />
                              </Table.Td>
                              <Table.Td>
                                <Select
                                  size="xs"
                                  variant="unstyled"
                                  data={STATES.map((st) => ({ value: st.value, label: st.label }))}
                                  value={s.state}
                                  onChange={(v) => v && patchSub.mutate({ id: s.id, patch: { state: v as SubdomainState } })}
                                  allowDeselect={false}
                                  w={110}
                                />
                              </Table.Td>
                              <Table.Td>
                                <Checkbox size="xs" checked={s.in_scope} onChange={(e) => patchSub.mutate({ id: s.id, patch: { in_scope: e.currentTarget.checked } })} />
                              </Table.Td>
                              <Table.Td>
                                <Group gap={4}>
                                  <ActionIcon size="sm" variant="subtle" onClick={() => openEditSub(s)}><IconEdit size={12} /></ActionIcon>
                                  <ActionIcon size="sm" color="red" variant="subtle" onClick={() => delSub.mutate(s.id)}><IconTrash size={12} /></ActionIcon>
                                </Group>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    )}
                    <Button size="xs" variant="subtle" mt={4} onClick={() => openAddSub(h.id)}>+ Add single subdomain</Button>
                  </Stack>
                </Collapse>
              </Stack>
            );
          })}
        </Stack>
      )}

      {/* Host modal */}
      <Modal opened={hostModal} onClose={closeHostModal} title={editingHost ? "Edit Host" : "Add Host"} centered>
        <Stack>
          <TextInput label="FQDN / IP" required placeholder="example.com" value={hostForm.fqdn} onChange={(e) => setHostForm({ ...hostForm, fqdn: e.currentTarget.value })} />
          <TextInput label="IP (optional)" placeholder="93.184.216.34" value={hostForm.ip} onChange={(e) => setHostForm({ ...hostForm, ip: e.currentTarget.value })} />
          <Checkbox label="In scope" checked={hostForm.in_scope} onChange={(e) => setHostForm({ ...hostForm, in_scope: e.currentTarget.checked })} />
          <Button color="usfGreen" disabled={!hostForm.fqdn.trim()} loading={saveHost.isPending} onClick={() => saveHost.mutate()}>Save</Button>
        </Stack>
      </Modal>

      {/* Subdomain modal */}
      <Modal opened={addSubModal} onClose={closeSubModal} title={editingSubdomain ? "Edit Subdomain" : "Add Subdomain"} centered size="lg">
        <Stack>
          <TextInput label="FQDN" required placeholder="admin.example.com" value={subForm.fqdn} onChange={(e) => setSubForm({ ...subForm, fqdn: e.currentTarget.value })} />
          <Group grow>
            <TextInput label="IP" placeholder="93.184.216.34" value={subForm.ip} onChange={(e) => setSubForm({ ...subForm, ip: e.currentTarget.value })} />
            <TextInput label="Status code" placeholder="200" value={String(subForm.status_code)} onChange={(e) => setSubForm({ ...subForm, status_code: e.currentTarget.value })} />
          </Group>
          <Group grow>
            <TextInput label="Title" placeholder="Admin Panel" value={subForm.title} onChange={(e) => setSubForm({ ...subForm, title: e.currentTarget.value })} />
            <TextInput label="Tech stack" placeholder="Apache, PHP" value={subForm.tech} onChange={(e) => setSubForm({ ...subForm, tech: e.currentTarget.value })} />
          </Group>
          <Select label="Auth" data={AUTH_OPTIONS} value={subForm.auth} onChange={(v) => setSubForm({ ...subForm, auth: (v ?? "unknown") as SubdomainAuth })} allowDeselect={false} />
          <Textarea label="Notes" autosize minRows={2} value={subForm.notes_md} onChange={(e) => setSubForm({ ...subForm, notes_md: e.currentTarget.value })} />
          <Button color="usfGreen" disabled={!subForm.fqdn.trim()} loading={saveSub.isPending} onClick={() => saveSub.mutate()}>Save</Button>
        </Stack>
      </Modal>

      {/* Bulk import modal */}
      <Modal opened={bulkModal} onClose={closeBulkModal} title="Bulk Import Subdomains" centered>
        <Stack>
          <Text size="sm" c="dimmed">One FQDN per line. Duplicates are skipped.</Text>
          <Code block style={{ fontSize: 11, maxHeight: 80, overflow: "auto" }}>
            {`sub1.example.com\nsub2.example.com\nadmin.example.com`}
          </Code>
          <Textarea
            placeholder="sub1.example.com&#10;sub2.example.com"
            autosize
            minRows={6}
            value={bulkText}
            onChange={(e) => setBulkText(e.currentTarget.value)}
            ff="monospace"
          />
          <Button color="usfGreen" disabled={!bulkText.trim()} loading={bulkAdd.isPending} onClick={() => bulkAdd.mutate()}>Import</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
