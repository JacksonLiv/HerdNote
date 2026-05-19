import {
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  PasswordInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconUserPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate } from "react-router-dom";

import { createUser, listUsers } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ClientsManager } from "../components/ClientsManager";
import { FindingTemplatesManager } from "../components/FindingTemplatesManager";

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
        message: "Couldn’t create user (duplicate or weak password).",
      }),
  });

  // Operators have no business here.
  if (user && user.role !== "admin") return <Navigate to="/" replace />;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Admin</Title>
          <Text c="dimmed" size="sm">
            Manage CyberHerd operator accounts.
          </Text>
        </div>
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

      <ClientsManager />

      <FindingTemplatesManager />

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
