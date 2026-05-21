import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconEdit, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  addContact,
  deleteContact,
  listClients,
  patchEngagement,
  updateClient,
  updateContact,
  type Client,
  type ClientContact,
  type Engagement,
} from "../api/client";

const ENGAGEMENT_TYPES = ["pentest", "redteam", "webapp", "external", "internal", "other"];
const ENGAGEMENT_STATUSES = ["planning", "active", "reporting", "closed"];

export function PreEngagementView({ engagement }: { engagement: Engagement }) {
  const qc = useQueryClient();
  const clientQuery = useQuery({
    queryKey: ["clients"],
    queryFn: listClients,
  });

  const linkedClient = clientQuery.data?.find((c) => c.id === engagement.client_id) ?? null;

  const patchEng = useMutation({
    mutationFn: (body: Parameters<typeof patchEngagement>[1]) =>
      patchEngagement(engagement.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["engagement", engagement.id] });
      notifications.show({ color: "usfGreen", message: "Saved." });
    },
    onError: () => notifications.show({ color: "red", message: "Save failed." }),
  });

  return (
    <Stack gap="xl">
      <ClientSection
        engagement={engagement}
        linkedClient={linkedClient}
        clients={clientQuery.data ?? []}
        onSaveEngagement={(body) => patchEng.mutate(body)}
        saving={patchEng.isPending}
      />
      <EngagementDetailsSection
        engagement={engagement}
        onSave={(body) => patchEng.mutate(body)}
        saving={patchEng.isPending}
      />
      <ScopeSection
        engagement={engagement}
        onSave={(body) => patchEng.mutate(body)}
        saving={patchEng.isPending}
      />
      <TeamSection engagement={engagement} />
    </Stack>
  );
}

// ─── Client Section ───────────────────────────────────────────────────────────

function ClientSection({
  engagement,
  linkedClient,
  clients,
  onSaveEngagement,
  saving,
}: {
  engagement: Engagement;
  linkedClient: Client | null;
  clients: Client[];
  onSaveEngagement: (body: Parameters<typeof patchEngagement>[1]) => void;
  saving: boolean;
}) {
  const qc = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    engagement.client_id ?? null,
  );
  const [clientNameDraft, setClientNameDraft] = useState(engagement.client ?? "");

  const patchClient = useMutation({
    mutationFn: (body: { name?: string; short_name?: string | null; notes_md?: string | null }) =>
      updateClient(linkedClient!.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      notifications.show({ color: "usfGreen", message: "Client updated." });
    },
  });

  const currentClient = clients.find((c) => c.id === selectedClientId) ?? linkedClient;

  return (
    <Card withBorder padding="lg">
      <Title order={4} mb="md">
        Client
      </Title>
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Select
            label="Linked Client"
            placeholder="Select a managed client"
            data={clients.map((c) => ({ value: c.id, label: c.name }))}
            value={selectedClientId}
            onChange={(v) => setSelectedClientId(v)}
            clearable
            mb="sm"
          />
          {selectedClientId !== engagement.client_id && (
            <Button
              size="xs"
              color="usfGreen"
              loading={saving}
              onClick={() =>
                onSaveEngagement({
                  client_id: selectedClientId,
                  client: currentClient?.name ?? clientNameDraft,
                })
              }
            >
              Apply Client Link
            </Button>
          )}
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput
            label="Display Name (report header)"
            description="Short name shown on the engagement header and auto-filled in report"
            value={clientNameDraft}
            onChange={(e) => setClientNameDraft(e.currentTarget.value)}
            mb="sm"
          />
          {clientNameDraft !== (engagement.client ?? "") && (
            <Button
              size="xs"
              color="usfGreen"
              loading={saving}
              onClick={() => onSaveEngagement({ client: clientNameDraft })}
            >
              Save Name
            </Button>
          )}
        </Grid.Col>
      </Grid>

      {currentClient && (
        <>
          <Divider my="md" label="Client Details" labelPosition="left" />
          <ClientDetailsEditor client={currentClient} onPatch={(b) => patchClient.mutate(b)} />
          <Divider my="md" label="Points of Contact" labelPosition="left" />
          <ContactsTable client={currentClient} />
        </>
      )}

      {!currentClient && (
        <Text size="sm" c="dimmed" mt="xs">
          Link a managed client above to manage contacts and details here, or just set a display
          name for this engagement.
        </Text>
      )}
    </Card>
  );
}

function ClientDetailsEditor({
  client,
  onPatch,
}: {
  client: Client;
  onPatch: (b: { name?: string; short_name?: string | null }) => void;
}) {
  const [name, setName] = useState(client.name);
  const [shortName, setShortName] = useState(client.short_name ?? "");

  const dirty = name !== client.name || shortName !== (client.short_name ?? "");

  return (
    <Grid mb="sm">
      <Grid.Col span={{ base: 12, sm: 5 }}>
        <TextInput
          label="Client Full Name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 4 }}>
        <TextInput
          label="Short Name"
          value={shortName}
          onChange={(e) => setShortName(e.currentTarget.value)}
          placeholder="e.g. ACME"
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 3 }} style={{ display: "flex", alignItems: "flex-end" }}>
        <Button
          size="sm"
          color="usfGreen"
          disabled={!dirty}
          onClick={() =>
            onPatch({ name, short_name: shortName.trim() || null })
          }
        >
          Save
        </Button>
      </Grid.Col>
    </Grid>
  );
}

function ContactsTable({ client }: { client: Client }) {
  const qc = useQueryClient();
  const [addOpen, { open: openAdd, close: closeAdd }] = useDisclosure(false);
  const [editContact, setEditContact] = useState<ClientContact | null>(null);

  const delContact = useMutation({
    mutationFn: (cid: string) => deleteContact(client.id, cid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });

  return (
    <>
      <Table striped withTableBorder mb="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Role</Table.Th>
            <Table.Th>Email</Table.Th>
            <Table.Th>Phone</Table.Th>
            <Table.Th w={72} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {client.contacts.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={5}>
                <Text size="sm" c="dimmed">
                  No contacts yet.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
          {client.contacts.map((c) => (
            <Table.Tr key={c.id}>
              <Table.Td>{c.name}</Table.Td>
              <Table.Td>{c.role ?? "—"}</Table.Td>
              <Table.Td>{c.email ?? "—"}</Table.Td>
              <Table.Td>{c.phone ?? "—"}</Table.Td>
              <Table.Td>
                <Group gap={4}>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    onClick={() => setEditContact(c)}
                  >
                    <IconEdit size={14} />
                  </ActionIcon>
                  <ActionIcon
                    size="sm"
                    color="red"
                    variant="subtle"
                    loading={delContact.isPending}
                    onClick={() => delContact.mutate(c.id)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Button
        size="xs"
        variant="default"
        leftSection={<IconPlus size={14} />}
        onClick={openAdd}
      >
        Add Contact
      </Button>

      <ContactModal
        opened={addOpen}
        onClose={closeAdd}
        clientId={client.id}
        existing={null}
      />
      {editContact && (
        <ContactModal
          opened={!!editContact}
          onClose={() => setEditContact(null)}
          clientId={client.id}
          existing={editContact}
        />
      )}
    </>
  );
}

function ContactModal({
  opened,
  onClose,
  clientId,
  existing,
}: {
  opened: boolean;
  onClose: () => void;
  clientId: string;
  existing: ClientContact | null;
}) {
  const qc = useQueryClient();
  const form = useForm({
    initialValues: {
      name: existing?.name ?? "",
      role: existing?.role ?? "",
      email: existing?.email ?? "",
      phone: existing?.phone ?? "",
    },
  });

  const save = useMutation({
    mutationFn: () =>
      existing
        ? updateContact(clientId, existing.id, {
            name: form.values.name,
            role: form.values.role || null,
            email: form.values.email || null,
            phone: form.values.phone || null,
          })
        : addContact(clientId, {
            name: form.values.name,
            role: form.values.role || null,
            email: form.values.email || null,
            phone: form.values.phone || null,
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      onClose();
    },
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={existing ? "Edit Contact" : "Add Contact"}
      size="sm"
    >
      <Stack gap="sm">
        <TextInput label="Name" required {...form.getInputProps("name")} />
        <TextInput label="Role / Title" {...form.getInputProps("role")} />
        <TextInput label="Email" type="email" {...form.getInputProps("email")} />
        <TextInput label="Phone" {...form.getInputProps("phone")} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="usfGreen"
            loading={save.isPending}
            disabled={!form.values.name.trim()}
            onClick={() => save.mutate()}
          >
            {existing ? "Save" : "Add"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ─── Engagement Details Section ───────────────────────────────────────────────

function EngagementDetailsSection({
  engagement,
  onSave,
  saving,
}: {
  engagement: Engagement;
  onSave: (body: Parameters<typeof patchEngagement>[1]) => void;
  saving: boolean;
}) {
  const form = useForm({
    initialValues: {
      name: engagement.name,
      type: engagement.type,
      status: engagement.status,
      start_date: engagement.start_date ?? "",
      end_date: engagement.end_date ?? "",
    },
  });

  const dirty =
    form.values.name !== engagement.name ||
    form.values.type !== engagement.type ||
    form.values.status !== engagement.status ||
    form.values.start_date !== (engagement.start_date ?? "") ||
    form.values.end_date !== (engagement.end_date ?? "");

  return (
    <Card withBorder padding="lg">
      <Title order={4} mb="md">
        Engagement Details
      </Title>
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput label="Engagement Name" required {...form.getInputProps("name")} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 3 }}>
          <Select
            label="Type"
            data={ENGAGEMENT_TYPES}
            allowDeselect={false}
            {...form.getInputProps("type")}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 3 }}>
          <Select
            label="Status"
            data={ENGAGEMENT_STATUSES}
            allowDeselect={false}
            {...form.getInputProps("status")}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput
            label="Start Date"
            type="date"
            {...form.getInputProps("start_date")}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput
            label="End Date"
            type="date"
            {...form.getInputProps("end_date")}
          />
        </Grid.Col>
      </Grid>
      <Group justify="flex-end" mt="md">
        <Button
          color="usfGreen"
          disabled={!dirty}
          loading={saving}
          onClick={() =>
            onSave({
              name: form.values.name,
              type: form.values.type,
              status: form.values.status,
              start_date: form.values.start_date || null,
              end_date: form.values.end_date || null,
            })
          }
        >
          Save Changes
        </Button>
      </Group>
    </Card>
  );
}

// ─── Scope / ROE Section ──────────────────────────────────────────────────────

function ScopeSection({
  engagement,
  onSave,
  saving,
}: {
  engagement: Engagement;
  onSave: (body: Parameters<typeof patchEngagement>[1]) => void;
  saving: boolean;
}) {
  const [scope, setScope] = useState(engagement.scope_md ?? "");
  const [roe, setRoe] = useState(engagement.roe_md ?? "");

  const dirty = scope !== (engagement.scope_md ?? "") || roe !== (engagement.roe_md ?? "");

  return (
    <Card withBorder padding="lg">
      <Title order={4} mb="md">
        Scope &amp; Rules of Engagement
      </Title>
      <Stack gap="md">
        <Textarea
          label="Scope"
          description="IP ranges, domains, systems in scope"
          placeholder="e.g. 10.0.0.0/8, *.example.com"
          minRows={4}
          autosize
          value={scope}
          onChange={(e) => setScope(e.currentTarget.value)}
        />
        <Textarea
          label="Rules of Engagement"
          description="Constraints, restrictions, out-of-scope items"
          placeholder="e.g. No denial-of-service testing, no physical access..."
          minRows={4}
          autosize
          value={roe}
          onChange={(e) => setRoe(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button
            color="usfGreen"
            disabled={!dirty}
            loading={saving}
            onClick={() => onSave({ scope_md: scope, roe_md: roe })}
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

// ─── Team Section ─────────────────────────────────────────────────────────────

function TeamSection({ engagement }: { engagement: Engagement }) {
  return (
    <Card withBorder padding="lg">
      <Title order={4} mb="md">
        Team
      </Title>
      <Stack gap="xs">
        {engagement.members.length === 0 && (
          <Text size="sm" c="dimmed">
            No members assigned. Add members in Settings.
          </Text>
        )}
        {engagement.members.map((m) => (
          <Group key={m.user.id} justify="space-between">
            <div>
              <Text fw={500}>{m.user.display_name}</Text>
              <Text size="xs" c="dimmed">
                @{m.user.username}
              </Text>
            </div>
            <Badge color={m.role === "lead" ? "usfGold" : "gray"} c="dark.9" variant="filled">
              {m.role}
            </Badge>
          </Group>
        ))}
      </Stack>
      <Text size="xs" c="dimmed" mt="md">
        Add or remove team members in Settings.
      </Text>
    </Card>
  );
}
