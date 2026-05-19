import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  addClientContact,
  createClient,
  deleteClient,
  deleteClientContact,
  listClients,
} from "../api/client";

function ContactAdder({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const [n, setN] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const add = useMutation({
    mutationFn: () =>
      addClientContact(clientId, {
        name: n.trim(),
        role: role || null,
        email: email || null,
      }),
    onSuccess: () => {
      setN("");
      setRole("");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });
  return (
    <Group align="flex-end" gap="xs" mt="xs">
      <TextInput
        size="xs"
        label="Contact"
        value={n}
        onChange={(e) => setN(e.currentTarget.value)}
      />
      <TextInput
        size="xs"
        label="Role"
        value={role}
        onChange={(e) => setRole(e.currentTarget.value)}
      />
      <TextInput
        size="xs"
        label="Email"
        value={email}
        onChange={(e) => setEmail(e.currentTarget.value)}
      />
      <Button
        size="xs"
        variant="light"
        disabled={!n.trim()}
        loading={add.isPending}
        onClick={() => add.mutate()}
      >
        Add
      </Button>
    </Group>
  );
}

export function ClientsManager() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const [name, setName] = useState("");
  const [short, setShort] = useState("");

  const add = useMutation({
    mutationFn: () =>
      createClient({ name: name.trim(), short_name: short || null }),
    onSuccess: () => {
      setName("");
      setShort("");
      qc.invalidateQueries({ queryKey: ["clients"] });
      notifications.show({ color: "usfGreen", message: "Client added." });
    },
    onError: () =>
      notifications.show({ color: "red", message: "Name already exists." }),
  });
  const delClient = useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
  const delContact = useMutation({
    mutationFn: (v: { client: string; contact: string }) =>
      deleteClientContact(v.client, v.contact),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });

  return (
    <Card withBorder padding="md">
      <Title order={4} mb="xs">
        Clients
      </Title>
      <Group align="flex-end" mb="md">
        <TextInput
          label="Client name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <TextInput
          label="Short name"
          value={short}
          onChange={(e) => setShort(e.currentTarget.value)}
        />
        <Button
          color="usfGold"
          c="dark.9"
          disabled={!name.trim()}
          loading={add.isPending}
          onClick={() => add.mutate()}
        >
          Add client
        </Button>
      </Group>

      {q.isLoading && <Loader />}
      {q.data?.length === 0 && (
        <Text c="dimmed" size="sm">
          No clients yet.
        </Text>
      )}
      <Stack>
        {q.data?.map((c) => (
          <Card key={c.id} withBorder padding="sm" bg="dark.6">
            <Group justify="space-between">
              <Text fw={600}>
                {c.name}{" "}
                {c.short_name && (
                  <Text span c="dimmed" size="sm">
                    ({c.short_name})
                  </Text>
                )}
              </Text>
              <ActionIcon
                color="red"
                variant="subtle"
                onClick={() => delClient.mutate(c.id)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
            <Group gap="xs" mt={6}>
              {c.contacts.length === 0 && (
                <Text size="xs" c="dimmed">
                  No contacts
                </Text>
              )}
              {c.contacts.map((ct) => (
                <Badge
                  key={ct.id}
                  variant="light"
                  rightSection={
                    <ActionIcon
                      size="xs"
                      variant="transparent"
                      color="red"
                      onClick={() =>
                        delContact.mutate({ client: c.id, contact: ct.id })
                      }
                    >
                      <IconTrash size={11} />
                    </ActionIcon>
                  }
                >
                  {ct.name}
                  {ct.role ? ` · ${ct.role}` : ""}
                </Badge>
              ))}
            </Group>
            <ContactAdder clientId={c.id} />
          </Card>
        ))}
      </Stack>
    </Card>
  );
}
