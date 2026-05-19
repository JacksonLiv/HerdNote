import {
  ActionIcon,
  Badge,
  Button,
  Card,
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
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconEye, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  createCompromisedUser,
  deleteCompromisedUser,
  listCompromisedUsers,
  revealSecret,
  updateCompromisedUser,
  type Privilege,
  type Workstream,
} from "../api/client";
import { useWorkstreamTarget } from "./useWorkstreamTarget";

const PRIV_COLOR: Record<Privilege, string> = {
  user: "gray",
  local_admin: "orange",
  domain_admin: "red",
  root: "red",
  service: "blue",
  other: "gray",
};
const PRIVS: Privilege[] = [
  "user",
  "local_admin",
  "domain_admin",
  "root",
  "service",
  "other",
];

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
  const [revealed, setRevealed] = useState<{ user: string; secret: string } | null>(
    null,
  );
  const [form, setForm] = useState({
    username: "",
    domain: "",
    privilege: "user" as Privilege,
    method_md: "",
    secret: "",
  });

  const q = useQuery({
    queryKey: ["cusers", eid, workstreamId ?? "all"],
    queryFn: () => listCompromisedUsers(eid, workstreamId),
  });
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["cusers", eid] });

  const add = useMutation({
    mutationFn: () =>
      createCompromisedUser(eid, {
        username: form.username.trim(),
        domain: form.domain || null,
        privilege: form.privilege,
        method_md: form.method_md || null,
        secret: form.secret || null,
        workstream_id: wsT.wsId,
      }),
    onSuccess: () => {
      close();
      setForm({ username: "", domain: "", privilege: "user", method_md: "", secret: "" });
      invalidate();
      notifications.show({ color: "usfGreen", message: "Captured account saved." });
    },
  });

  const reveal = useMutation({
    mutationFn: (id: string) => revealSecret(eid, id),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteCompromisedUser(eid, id),
    onSuccess: invalidate,
  });
  const toggleValidated = useMutation({
    mutationFn: (v: { id: string; validated: boolean }) =>
      updateCompromisedUser(eid, v.id, { validated: v.validated }),
    onSuccess: invalidate,
  });

  return (
    <Stack>
      <Group justify="space-between">
        <Text c="dimmed" size="sm">
          Captured accounts — who, where, how, and (encrypted) the secret.
        </Text>
        <Button color="usfGold" c="dark.9" onClick={open}>
          + Add compromised user
        </Button>
      </Group>

      {q.isLoading && <Loader />}
      {q.data && q.data.length === 0 && (
        <Text c="dimmed" ta="center">
          None yet.
        </Text>
      )}
      {q.data && q.data.length > 0 && (
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
            {q.data.map((c) => (
              <Table.Tr key={c.id}>
                <Table.Td>
                  <Text fw={600}>
                    {c.domain ? `${c.domain}\\` : ""}
                    {c.username}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={PRIV_COLOR[c.privilege]}>{c.privilege}</Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed" lineClamp={2}>
                    {c.method_md ?? "—"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Switch
                    checked={c.validated}
                    color="usfGreen"
                    onChange={(e) =>
                      toggleValidated.mutate({
                        id: c.id,
                        validated: e.currentTarget.checked,
                      })
                    }
                  />
                </Table.Td>
                <Table.Td>
                  {c.has_secret ? (
                    <ActionIcon
                      variant="subtle"
                      color="usfGreen"
                      loading={reveal.isPending}
                      onClick={async () => {
                        const secret = await reveal.mutateAsync(c.id);
                        setRevealed({ user: c.username, secret });
                      }}
                    >
                      <IconEye size={16} />
                    </ActionIcon>
                  ) : (
                    <Text size="xs" c="dimmed">
                      none
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={() => del.mutate(c.id)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={opened} onClose={close} title="Add compromised user" centered>
        <Stack>
          <TextInput
            label="Username"
            required
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.currentTarget.value })}
          />
          <TextInput
            label="Domain"
            value={form.domain}
            onChange={(e) => setForm({ ...form, domain: e.currentTarget.value })}
          />
          <Select
            label="Privilege"
            data={PRIVS}
            value={form.privilege}
            allowDeselect={false}
            onChange={(v) =>
              setForm({ ...form, privilege: (v ?? "user") as Privilege })
            }
          />
          <Textarea
            label="How (method)"
            autosize
            minRows={2}
            value={form.method_md}
            onChange={(e) => setForm({ ...form, method_md: e.currentTarget.value })}
          />
          <PasswordInput
            label="Secret (password / hash / key)"
            description="Stored encrypted at rest."
            value={form.secret}
            onChange={(e) => setForm({ ...form, secret: e.currentTarget.value })}
          />
          {wsT.picker}
          <Button
            color="usfGreen"
            disabled={!form.username.trim() || !wsT.ready}
            loading={add.isPending}
            onClick={() => add.mutate()}
          >
            Save
          </Button>
        </Stack>
      </Modal>

      <Modal
        opened={revealed !== null}
        onClose={() => setRevealed(null)}
        title={`Secret for ${revealed?.user ?? ""}`}
        centered
      >
        <Card withBorder>
          <Text ff="monospace" style={{ wordBreak: "break-all" }}>
            {revealed?.secret}
          </Text>
        </Card>
      </Modal>
    </Stack>
  );
}
