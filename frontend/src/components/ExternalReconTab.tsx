import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
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

import { createDomain, deleteDomain, listDomains } from "../api/client";

const DISCOVERY_SOURCES = [
  "subfinder", "amass", "crt.sh", "shodan", "censys", "dnsx",
  "manual", "google-dork", "github", "other",
];

interface DomainForm {
  name: string;
  is_subdomain: boolean;
  in_scope: boolean;
  source: string;
  notes_md: string;
}

const emptyForm = (): DomainForm => ({ name: "", is_subdomain: false, in_scope: true, source: "manual", notes_md: "" });

export function ExternalReconTab({ eid, wsId }: { eid: string; wsId: string }) {
  const qc = useQueryClient();
  const qk = ["domains", eid, wsId];
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState<DomainForm>(emptyForm());
  const [filter, setFilter] = useState<"all" | "in_scope" | "subdomain">("all");

  const q = useQuery({ queryKey: qk, queryFn: () => listDomains(eid, wsId) });
  const invalidate = () => qc.invalidateQueries({ queryKey: qk });

  const allDomains = q.data ?? [];
  const domains = allDomains.filter((d) => {
    if (filter === "in_scope") return d.in_scope;
    if (filter === "subdomain") return d.is_subdomain;
    return true;
  });

  const roots = allDomains.filter((d) => !d.is_subdomain).length;
  const subs = allDomains.filter((d) => d.is_subdomain).length;
  const inScope = allDomains.filter((d) => d.in_scope).length;

  const add = useMutation({
    mutationFn: () =>
      createDomain(eid, {
        name: form.name.trim(),
        is_subdomain: form.is_subdomain,
        in_scope: form.in_scope,
        workstream_id: wsId,
        notes_md: `source:${form.source}${form.notes_md ? " | " + form.notes_md : ""}`,
      }),
    onSuccess: () => { invalidate(); close(); setForm(emptyForm()); },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteDomain(eid, id),
    onSuccess: invalidate,
  });

  if (q.isLoading) return <Loader />;

  return (
    <Stack>
      <Group justify="space-between">
        <Group gap="xs">
          <Text c="dimmed" size="sm">Domains and subdomains discovered during recon.</Text>
          <Badge size="sm" variant="outline">{roots} root</Badge>
          <Badge size="sm" variant="outline" color="blue">{subs} subs</Badge>
          <Badge size="sm" variant="outline" color="green">{inScope} in scope</Badge>
        </Group>
        <Button color="usfGold" c="dark.9" onClick={open}>+ Add Domain</Button>
      </Group>

      <Group gap="xs">
        {(["all", "in_scope", "subdomain"] as const).map((f) => (
          <Badge
            key={f}
            size="md"
            variant={filter === f ? "filled" : "outline"}
            color="usfGreen"
            style={{ cursor: "pointer" }}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : f === "in_scope" ? "In scope" : "Subdomains"}
          </Badge>
        ))}
      </Group>

      {domains.length === 0 ? (
        <Text c="dimmed" ta="center">No domains recorded yet.</Text>
      ) : (
        <Table highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Domain / Subdomain</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Scope</Table.Th>
              <Table.Th>Notes</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {domains.map((d) => (
              <Table.Tr key={d.id}>
                <Table.Td><Text ff="monospace" size="sm" fw={600}>{d.name}</Text></Table.Td>
                <Table.Td>
                  <Badge size="sm" color={d.is_subdomain ? "blue" : "grape"}>
                    {d.is_subdomain ? "Subdomain" : "Root domain"}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge size="sm" color={d.in_scope ? "green" : "gray"}>
                    {d.in_scope ? "In scope" : "Out of scope"}
                  </Badge>
                </Table.Td>
                <Table.Td><Text size="xs" c="dimmed" lineClamp={1}>{d.notes_md ?? "—"}</Text></Table.Td>
                <Table.Td>
                  <ActionIcon color="red" variant="subtle" onClick={() => del.mutate(d.id)}>
                    <IconTrash size={14} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={opened} onClose={close} title="Add Domain / Subdomain" centered>
        <Stack>
          <TextInput label="Domain name" required placeholder="sub.example.com" value={form.name} onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} />
          <Select label="Discovery source" data={DISCOVERY_SOURCES} value={form.source} onChange={(v) => setForm({ ...form, source: v ?? "manual" })} allowDeselect={false} />
          <Group>
            <Checkbox label="Is subdomain" checked={form.is_subdomain} onChange={(e) => setForm({ ...form, is_subdomain: e.currentTarget.checked })} />
            <Checkbox label="In scope" checked={form.in_scope} onChange={(e) => setForm({ ...form, in_scope: e.currentTarget.checked })} />
          </Group>
          <Textarea label="Notes" autosize minRows={2} value={form.notes_md} onChange={(e) => setForm({ ...form, notes_md: e.currentTarget.value })} placeholder="Screenshot ref, findings, tech detected..." />
          <Button color="usfGreen" disabled={!form.name.trim()} loading={add.isPending} onClick={() => add.mutate()}>Save</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
