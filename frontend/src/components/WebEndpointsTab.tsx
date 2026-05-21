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
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { createAsset, deleteAsset, listAssets, updateAsset } from "../api/client";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];
const VULN_STATUSES: { value: string; label: string; color: string }[] = [
  { value: "untested", label: "Untested", color: "gray" },
  { value: "clean", label: "Clean", color: "green" },
  { value: "vulnerable", label: "Vulnerable", color: "red" },
  { value: "needs_retest", label: "Needs retest", color: "yellow" },
];

interface EndpointForm {
  path: string;
  method: string;
  auth_required: string;
  parameters: string;
  vuln_status: string;
  notes: string;
}

const emptyForm = (): EndpointForm => ({ path: "", method: "GET", auth_required: "Yes", parameters: "", vuln_status: "untested", notes: "" });

export function WebEndpointsTab({ eid, wsId }: { eid: string; wsId: string }) {
  const qc = useQueryClient();
  const qk = ["assets", eid, wsId];
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState<EndpointForm>(emptyForm());
  const [vulnFilter, setVulnFilter] = useState<string>("all");

  const q = useQuery({ queryKey: qk, queryFn: () => listAssets(eid, wsId) });
  const allEndpoints = (q.data ?? []).filter((a) => a.type === "url");
  const endpoints = allEndpoints.filter((e) => {
    if (vulnFilter === "all") return true;
    const m = e.meta as Record<string, unknown>;
    return m.vuln_status === vulnFilter;
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["assets", eid] });

  const vulnCount = allEndpoints.filter((e) => (e.meta as Record<string, unknown>).vuln_status === "vulnerable").length;

  const add = useMutation({
    mutationFn: () =>
      createAsset(eid, {
        identifier: `${form.method} ${form.path.trim()}`,
        type: "url",
        workstream_ids: [wsId],
        notes_md: form.notes || null,
        meta: {
          path: form.path.trim(),
          method: form.method,
          auth_required: form.auth_required,
          parameters: form.parameters || null,
          vuln_status: form.vuln_status,
        },
      }),
    onSuccess: () => { invalidate(); close(); setForm(emptyForm()); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteAsset(eid, id),
    onSuccess: invalidate,
  });

  const setVulnStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateAsset(eid, id, { meta: { ...(q.data?.find((a) => a.id === id)?.meta ?? {}), vuln_status: status } }),
    onSuccess: invalidate,
  });

  if (q.isLoading) return <Loader />;

  return (
    <Stack>
      <Group justify="space-between">
        <Group gap="xs">
          <Text c="dimmed" size="sm">API endpoints and routes mapped during testing.</Text>
          {vulnCount > 0 && <Badge color="red" size="sm">{vulnCount} vulnerable</Badge>}
        </Group>
        <Button color="usfGold" c="dark.9" onClick={open}>+ Add Endpoint</Button>
      </Group>

      <Group gap="xs">
        {["all", "vulnerable", "needs_retest", "untested", "clean"].map((f) => {
          const info = VULN_STATUSES.find((s) => s.value === f);
          return (
            <Badge
              key={f}
              size="md"
              variant={vulnFilter === f ? "filled" : "outline"}
              color={info?.color ?? "usfGreen"}
              style={{ cursor: "pointer" }}
              onClick={() => setVulnFilter(f)}
            >
              {f === "all" ? "All" : (info?.label ?? f)}
            </Badge>
          );
        })}
      </Group>

      {endpoints.length === 0 ? (
        <Text c="dimmed" ta="center">No endpoints recorded yet.</Text>
      ) : (
        <Table highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Method</Table.Th>
              <Table.Th>Path</Table.Th>
              <Table.Th>Auth</Table.Th>
              <Table.Th>Parameters</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Notes</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {endpoints.map((ep) => {
              const m = ep.meta as Record<string, unknown>;
              return (
                <Table.Tr key={ep.id}>
                  <Table.Td>
                    <Badge size="sm" color="blue" variant="light">{String(m.method ?? "GET")}</Badge>
                  </Table.Td>
                  <Table.Td><Text ff="monospace" size="sm">{String(m.path ?? ep.identifier)}</Text></Table.Td>
                  <Table.Td><Text size="sm" c="dimmed">{String(m.auth_required ?? "—")}</Text></Table.Td>
                  <Table.Td><Text size="xs" c="dimmed" lineClamp={1}>{String(m.parameters ?? "—")}</Text></Table.Td>
                  <Table.Td>
                    <Select
                      size="xs"
                      data={VULN_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
                      value={String(m.vuln_status ?? "untested")}
                      onChange={(v) => v && setVulnStatus.mutate({ id: ep.id, status: v })}
                      allowDeselect={false}
                      renderOption={({ option }) => {
                        const info = VULN_STATUSES.find((s) => s.value === option.value);
                        return <Badge color={info?.color ?? "gray"} size="sm">{option.label}</Badge>;
                      }}
                    />
                  </Table.Td>
                  <Table.Td><Text size="xs" c="dimmed" lineClamp={1}>{ep.notes_md ?? "—"}</Text></Table.Td>
                  <Table.Td>
                    <ActionIcon color="red" variant="subtle" onClick={() => del.mutate(ep.id)}>
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={opened} onClose={close} title="Add Endpoint" centered>
        <Stack>
          <Group grow>
            <Select label="Method" data={HTTP_METHODS} value={form.method} onChange={(v) => setForm({ ...form, method: v ?? "GET" })} allowDeselect={false} />
            <TextInput label="Path" required placeholder="/api/v1/users" value={form.path} onChange={(e) => setForm({ ...form, path: e.currentTarget.value })} />
          </Group>
          <Group grow>
            <Select label="Auth required" data={["Yes", "No", "Unknown"]} value={form.auth_required} onChange={(v) => setForm({ ...form, auth_required: v ?? "Yes" })} allowDeselect={false} />
            <Select label="Vuln status" data={VULN_STATUSES} value={form.vuln_status} onChange={(v) => setForm({ ...form, vuln_status: v ?? "untested" })} allowDeselect={false} />
          </Group>
          <TextInput label="Parameters / body fields" placeholder="username, password, id..." value={form.parameters} onChange={(e) => setForm({ ...form, parameters: e.currentTarget.value })} />
          <TextInput label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })} />
          <Button color="usfGreen" disabled={!form.path.trim()} loading={add.isPending} onClick={() => add.mutate()}>Save</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
