import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  Modal,
  PasswordInput,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconLink,
  IconShield,
  IconTemplate,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate } from "react-router-dom";

import {
  createUser,
  getGhostwriterConfig,
  listUsers,
  testGhostwriterConnection,
  updateGhostwriterConfig,
} from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ClientsManager } from "../components/ClientsManager";
import { FindingTemplatesManager } from "../components/FindingTemplatesManager";

function GhostwriterSettingsPanel() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["ghostwriter-config"],
    queryFn: getGhostwriterConfig,
  });

  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [enabled, setEnabled] = useState(false);

  // Sync form when data loads
  const loaded = q.data;
  const [synced, setSynced] = useState(false);
  if (loaded && !synced) {
    setUrl(loaded.url ?? "");
    setEnabled(loaded.enabled);
    setSynced(true);
  }

  const save = useMutation({
    mutationFn: () =>
      updateGhostwriterConfig({ url: url.trim(), api_token: token, enabled }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ghostwriter-config"] });
      setToken("");
      setSynced(false);
      notifications.show({ color: "usfGreen", message: "Ghostwriter settings saved." });
    },
    onError: () =>
      notifications.show({ color: "red", message: "Failed to save settings." }),
  });

  const test = useMutation({
    mutationFn: testGhostwriterConnection,
    onSuccess: (data) =>
      notifications.show({
        color: data.ok ? "usfGreen" : "red",
        message: data.message,
      }),
    onError: (err: { response?: { data?: { detail?: string } } }) =>
      notifications.show({
        color: "red",
        message: err.response?.data?.detail ?? "Connection test failed.",
      }),
  });

  if (q.isLoading) return <Loader size="sm" />;

  const canSave = url.trim().length > 0 && token.length > 0;
  const canTest = !!(loaded?.url && loaded.token_set);

  return (
    <Stack gap="md" maw={520}>
      <div>
        <Text fw={600}>Ghostwriter</Text>
        <Text size="sm" c="dimmed">
          Push findings to a Ghostwriter instance for report generation.
          The client and project are created automatically if they don't exist.
        </Text>
      </div>

      {loaded?.token_set && (
        <Text size="xs" c="dimmed">
          A token is already saved.{" "}
          {loaded.enabled ? (
            <Text span c="usfGreen" size="xs">Integration is enabled.</Text>
          ) : (
            <Text span c="yellow" size="xs">Integration is disabled.</Text>
          )}
        </Text>
      )}

      <TextInput
        label="Ghostwriter URL"
        placeholder="http://ghostwriter:8000"
        value={url}
        onChange={(e) => setUrl(e.currentTarget.value)}
      />
      <PasswordInput
        label="API Token"
        description={loaded?.token_set ? "Leave blank to keep the existing token." : undefined}
        placeholder="Bearer token from Ghostwriter"
        value={token}
        onChange={(e) => setToken(e.currentTarget.value)}
      />
      <Switch
        label="Enable Ghostwriter integration"
        checked={enabled}
        onChange={(e) => setEnabled(e.currentTarget.checked)}
        color="usfGreen"
      />

      <Divider />

      <Group>
        <Button
          color="usfGreen"
          disabled={!canSave}
          loading={save.isPending}
          onClick={() => save.mutate()}
        >
          Save
        </Button>
        <Button
          variant="default"
          disabled={!canTest}
          loading={test.isPending}
          onClick={() => test.mutate()}
        >
          Test Connection
        </Button>
      </Group>
    </Stack>
  );
}

export function AdminPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState({
    username: "",
    display_name: "",
    password: "",
    role: "operator" as "admin" | "operator",
  });

  const q = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
    enabled: user?.role === "admin",
  });

  const add = useMutation({
    mutationFn: () =>
      createUser({
        username: form.username.trim(),
        display_name: form.display_name.trim() || form.username.trim(),
        password: form.password,
        role: form.role,
      }),
    onSuccess: () => {
      close();
      setForm({ username: "", display_name: "", password: "", role: "operator" });
      qc.invalidateQueries({ queryKey: ["users"] });
      notifications.show({ color: "usfGreen", message: "User created." });
    },
    onError: () =>
      notifications.show({
        color: "red",
        message: "Couldn't create user (duplicate or weak password).",
      }),
  });

  if (user && user.role !== "admin") return <Navigate to="/" replace />;

  return (
    <Stack gap="lg">
      <Title order={2}>Admin</Title>

      <Tabs defaultValue="users" color="usfGreen">
        <Tabs.List>
          <Tabs.Tab value="users" leftSection={<IconUsers size={16} />}>
            Users
          </Tabs.Tab>
          <Tabs.Tab value="clients" leftSection={<IconShield size={16} />}>
            Clients
          </Tabs.Tab>
          <Tabs.Tab value="templates" leftSection={<IconTemplate size={16} />}>
            Finding Templates
          </Tabs.Tab>
          <Tabs.Tab value="integrations" leftSection={<IconLink size={16} />}>
            Integrations
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="users" pt="md">
          <Stack gap="md">
            <Group justify="flex-end">
              <Button
                color="usfGold"
                c="dark.9"
                leftSection={<IconUserPlus size={18} />}
                onClick={open}
              >
                Add user
              </Button>
            </Group>
            <Card withBorder padding="md">
              {q.isLoading && <Loader />}
              {q.data && (
                <Table highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Display name</Table.Th>
                      <Table.Th>Username</Table.Th>
                      <Table.Th>Role</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {q.data.map((u) => (
                      <Table.Tr key={u.id}>
                        <Table.Td>{u.display_name}</Table.Td>
                        <Table.Td>
                          <Text ff="monospace">@{u.username}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={u.role === "admin" ? "usfGold" : "gray"} c="dark.9">
                            {u.role}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Card>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="clients" pt="md">
          <ClientsManager />
        </Tabs.Panel>

        <Tabs.Panel value="templates" pt="md">
          <FindingTemplatesManager />
        </Tabs.Panel>

        <Tabs.Panel value="integrations" pt="md">
          <Card withBorder padding="md">
            <GhostwriterSettingsPanel />
          </Card>
        </Tabs.Panel>
      </Tabs>

      <Modal opened={opened} onClose={close} title="Add user" centered>
        <Stack>
          <TextInput
            label="Username"
            required
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.currentTarget.value })}
          />
          <TextInput
            label="Display name"
            value={form.display_name}
            onChange={(e) =>
              setForm({ ...form, display_name: e.currentTarget.value })
            }
          />
          <PasswordInput
            label="Password"
            description="Minimum 8 characters."
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.currentTarget.value })}
          />
          <Select
            label="Role"
            data={["operator", "admin"]}
            value={form.role}
            allowDeselect={false}
            onChange={(v) =>
              setForm({ ...form, role: (v ?? "operator") as "admin" | "operator" })
            }
          />
          <Button
            color="usfGreen"
            disabled={form.username.trim().length < 3 || form.password.length < 8}
            loading={add.isPending}
            onClick={() => add.mutate()}
          >
            Create user
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
