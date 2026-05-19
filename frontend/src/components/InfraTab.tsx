import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  createInfra,
  deleteInfra,
  listInfra,
  updateInfra,
  type InfraKind,
  type InfraStatus,
} from "../api/client";

const KINDS: InfraKind[] = [
  "domain",
  "c2_server",
  "redirector",
  "vps",
  "phishing",
  "other",
];
const STATUSES: InfraStatus[] = ["planned", "active", "burned", "retired"];
const STATUS_COLOR: Record<string, string> = {
  planned: "gray",
  active: "usfGreen",
  burned: "red",
  retired: "dark",
};

export function InfraTab({ eid }: { eid: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["infra", eid],
    queryFn: () => listInfra(eid),
  });
  const [name, setName] = useState("");
  const [kind, setKind] = useState<InfraKind>("domain");
  const [provider, setProvider] = useState("");
  const [role, setRole] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["infra", eid] });
  const add = useMutation({
    mutationFn: () =>
      createInfra(eid, {
        name: name.trim(),
        kind,
        provider: provider || null,
        role: role || null,
      }),
    onSuccess: () => {
      setName("");
      setProvider("");
      setRole("");
      invalidate();
      notifications.show({ color: "usfGreen", message: "Infra added." });
    },
  });
  const patch = useMutation({
    mutationFn: (v: { id: string; status: InfraStatus }) =>
      updateInfra(eid, v.id, { status: v.status }),
    onSuccess: invalidate,
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteInfra(eid, id),
    onSuccess: invalidate,
  });

  return (
    <Stack>
      <Text c="dimmed" size="sm">
        Covert infrastructure for this engagement (domains, C2, redirectors).
      </Text>
      <Group align="flex-end" wrap="wrap">
        <TextInput
          label="Name / address"
          placeholder="evil.example or 1.2.3.4"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <Select
          label="Kind"
          data={KINDS}
          value={kind}
          allowDeselect={false}
          onChange={(v) => setKind((v ?? "other") as InfraKind)}
        />
        <TextInput
          label="Provider"
          value={provider}
          onChange={(e) => setProvider(e.currentTarget.value)}
        />
        <TextInput
          label="Role"
          value={role}
          onChange={(e) => setRole(e.currentTarget.value)}
        />
        <Button
          color="usfGold"
          c="dark.9"
          disabled={!name.trim()}
          loading={add.isPending}
          onClick={() => add.mutate()}
        >
          Add
        </Button>
      </Group>

      {q.isLoading && <Loader />}
      {q.data && q.data.length > 0 && (
        <Table highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Kind</Table.Th>
              <Table.Th>Provider</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {q.data.map((i) => (
              <Table.Tr key={i.id}>
                <Table.Td>
                  <Text ff="monospace">{i.name}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light">{i.kind}</Badge>
                </Table.Td>
                <Table.Td>{i.provider ?? "—"}</Table.Td>
                <Table.Td>
                  <Select
                    size="xs"
                    w={130}
                    allowDeselect={false}
                    data={STATUSES}
                    value={i.status}
                    onChange={(v) =>
                      v &&
                      patch.mutate({ id: i.id, status: v as InfraStatus })
                    }
                    leftSection={
                      <Badge
                        size="xs"
                        circle
                        color={STATUS_COLOR[i.status]}
                      >
                        {" "}
                      </Badge>
                    }
                  />
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {i.role ?? "—"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={() => del.mutate(i.id)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
