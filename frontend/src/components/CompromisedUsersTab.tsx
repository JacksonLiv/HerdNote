import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  PasswordInput,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";

import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconEye, IconEyeOff, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  createCompromisedUser,
  deleteCompromisedUser,
  listCompromisedUsers,
  revealSecret,
  updateCompromisedUser,
  type CompromisedUser,
  type CredSource,
  type HashType,
  type Privilege,
  type Workstream,
} from "../api/client";
import { useWorkstreamTarget } from "./useWorkstreamTarget";

const PRIV_COLOR: Record<Privilege, string> = {
  user: "gray", local_admin: "orange", domain_admin: "red",
  root: "red", service: "blue", other: "gray",
};
const PRIVS: Privilege[] = ["user", "local_admin", "domain_admin", "root", "service", "other"];
const SOURCES: CredSource[] = ["kerberoast", "asrep", "spray", "llmnr", "secretsdump", "dcsync", "manual", "mitm", "bruteforce", "phishing", "other"];
const HASH_TYPES: HashType[] = ["ntlm", "aes128", "aes256", "rc4", "plaintext", "netntlmv2", "kerb5tgs", "kerb5asrep", "other"];

export function CompromisedUsersTab({
  eid,
  workstreams,
  workstreamId,
}: {
  eid: string;
  workstreams: Workstream[];
  workstreamId?: string;
}) {
  const qc = useQueryClient();
  const wsT = useWorkstreamTarget(workstreams, workstreamId);
  const [opened, { open, close }] = useDisclosure(false);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    username: "", domain: "", privilege: "user" as Privilege, method_md: "", secret: "",
    source: null as CredSource | null, hash_type: null as HashType | null,
  });

  // Scoped to current workstream
  const wsQ = useQuery({
    queryKey: ["cusers", eid, workstreamId ?? "all"],
    queryFn: () => listCompromisedUsers(eid, workstreamId),
    enabled: !!workstreamId,
  });

  // All engagement-level (only if we're in a specific workstream context)
  const allQ = useQuery({
    queryKey: ["cusers", eid, "all"],
    queryFn: () => listCompromisedUsers(eid),
    enabled: !!workstreamId,
  });

  // If no workstream selected, just show everything
  const flatQ = useQuery({
    queryKey: ["cusers", eid, "all"],
    queryFn: () => listCompromisedUsers(eid),
    enabled: !workstreamId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["cusers", eid] });

  const add = useMutation({
    mutationFn: () =>
      createCompromisedUser(eid, {
        username: form.username.trim(),
        domain: form.domain || null,
        privilege: form.privilege,
        method_md: form.method_md || null,
        secret: form.secret || null,
        source: form.source,
        hash_type: form.hash_type,
        workstream_id: wsT.wsId,
      }),
    onSuccess: () => {
      close();
      setForm({ username: "", domain: "", privilege: "user", method_md: "", secret: "", source: null, hash_type: null });
      invalidate();
      notifications.show({ color: "usfGreen", message: "Captured account saved." });
    },
  });

  const reveal = useMutation({ mutationFn: (id: string) => revealSecret(eid, id) });
  const del = useMutation({ mutationFn: (id: string) => deleteCompromisedUser(eid, id), onSuccess: invalidate });
  const toggleValidated = useMutation({
    mutationFn: (v: { id: string; validated: boolean }) =>
      updateCompromisedUser(eid, v.id, { validated: v.validated }),
    onSuccess: invalidate,
  });

  const handleReveal = async (c: CompromisedUser) => {
    const secret = await reveal.mutateAsync(c.id);
    setRevealed((prev) => ({ ...prev, [c.id]: secret }));
  };

  const handleHide = (id: string) => {
    setRevealed((prev) => { const next = { ...prev }; delete next[id]; return next; });
  };

  // Split: scoped vs. global (other workstreams)
  const scopedUsers = wsQ.data ?? [];
  const allUsers = allQ.data ?? [];
  const scopedIds = new Set(scopedUsers.map((u) => u.id));
  const globalUsers = allUsers.filter((u) => !scopedIds.has(u.id));

  const isLoading = workstreamId ? wsQ.isLoading : flatQ.isLoading;
  const flatUsers = flatQ.data ?? [];

  return (
    <Stack>
      <Group justify="space-between">
        <Text c="dimmed" size="sm">Captured accounts — who, where, how, and (encrypted) the secret.</Text>
        <Button color="usfGold" c="dark.9" onClick={open}>+ Add compromised user</Button>
      </Group>

      {isLoading && <Loader />}

      {workstreamId ? (
        <Stack gap="xl">
          <Stack gap="sm">
            <Title order={5}>This workstream ({scopedUsers.length})</Title>
            <CredTable users={scopedUsers} onReveal={handleReveal} onDelete={(id) => del.mutate(id)} onToggle={(id, v) => toggleValidated.mutate({ id, validated: v })} reveal={reveal} revealedSecrets={revealed} onHide={handleHide} />
          </Stack>
          <Stack gap="sm">
            <Title order={5}>Global — other workstreams ({globalUsers.length})</Title>
            <CredTable users={globalUsers} onReveal={handleReveal} onDelete={(id) => del.mutate(id)} onToggle={(id, v) => toggleValidated.mutate({ id, validated: v })} reveal={reveal} revealedSecrets={revealed} onHide={handleHide} />
          </Stack>
        </Stack>
      ) : (
        <CredTable users={flatUsers} onReveal={handleReveal} onDelete={(id) => del.mutate(id)} onToggle={(id, v) => toggleValidated.mutate({ id, validated: v })} reveal={reveal} revealedSecrets={revealed} onHide={handleHide} />
      )}

      <Modal opened={opened} onClose={close} title="Add compromised user" centered>
        <Stack>
          <TextInput label="Username" required value={form.username} onChange={(e) => setForm({ ...form, username: e.currentTarget.value })} />
          <TextInput label="Domain" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.currentTarget.value })} />
          <Select label="Privilege" data={PRIVS} value={form.privilege} allowDeselect={false} onChange={(v) => setForm({ ...form, privilege: (v ?? "user") as Privilege })} />
          <Group grow>
            <Select label="Source technique" data={SOURCES} value={form.source} clearable placeholder="How obtained..." onChange={(v) => setForm({ ...form, source: (v ?? null) as CredSource | null })} />
            <Select label="Hash type" data={HASH_TYPES} value={form.hash_type} clearable placeholder="plaintext, ntlm..." onChange={(v) => setForm({ ...form, hash_type: (v ?? null) as HashType | null })} />
          </Group>
          <Textarea label="How (method)" autosize minRows={2} value={form.method_md} onChange={(e) => setForm({ ...form, method_md: e.currentTarget.value })} />
          <PasswordInput label="Secret (password / hash / key)" description="Stored encrypted at rest." value={form.secret} onChange={(e) => setForm({ ...form, secret: e.currentTarget.value })} />
          {wsT.picker}
          <Button color="usfGreen" disabled={!form.username.trim() || !wsT.ready} loading={add.isPending} onClick={() => add.mutate()}>Save</Button>
        </Stack>
      </Modal>

    </Stack>
  );
}

function CredTable({
  users,
  onReveal,
  onDelete,
  onToggle,
  onHide,
  reveal,
  revealedSecrets,
}: {
  users: CompromisedUser[];
  onReveal: (c: CompromisedUser) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, validated: boolean) => void;
  onHide: (id: string) => void;
  reveal: { isPending: boolean };
  revealedSecrets: Record<string, string>;
}) {
  if (users.length === 0) return <Text c="dimmed" size="sm">None.</Text>;
  return (
    <Table highlightOnHover withTableBorder>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>User</Table.Th>
          <Table.Th>Privilege</Table.Th>
          <Table.Th>How</Table.Th>
          <Table.Th>Validated</Table.Th>
          <Table.Th>Secret</Table.Th>
          <Table.Th />
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {users.map((c) => (
          <Table.Tr key={c.id}>
            <Table.Td><Text fw={600}>{c.domain ? `${c.domain}\\` : ""}{c.username}</Text></Table.Td>
            <Table.Td><Badge color={PRIV_COLOR[c.privilege]}>{c.privilege}</Badge></Table.Td>
            <Table.Td><Text size="sm" c="dimmed" lineClamp={2}>{c.method_md ?? "—"}</Text></Table.Td>
            <Table.Td>
              <Switch checked={c.validated} color="usfGreen" onChange={(e) => onToggle(c.id, e.currentTarget.checked)} />
            </Table.Td>
            <Table.Td>
              {c.has_secret ? (
                revealedSecrets[c.id] ? (
                  <Group gap={4} wrap="nowrap">
                    <Text ff="monospace" size="xs" style={{ wordBreak: "break-all" }}>{revealedSecrets[c.id]}</Text>
                    <ActionIcon variant="subtle" color="dimmed" size="sm" onClick={() => onHide(c.id)}>
                      <IconEyeOff size={14} />
                    </ActionIcon>
                  </Group>
                ) : (
                  <ActionIcon variant="subtle" color="usfGreen" loading={reveal.isPending} onClick={() => onReveal(c)}>
                    <IconEye size={16} />
                  </ActionIcon>
                )
              ) : (
                <Text size="xs" c="dimmed">none</Text>
              )}
            </Table.Td>
            <Table.Td>
              <ActionIcon color="red" variant="subtle" onClick={() => onDelete(c.id)}>
                <IconTrash size={16} />
              </ActionIcon>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
