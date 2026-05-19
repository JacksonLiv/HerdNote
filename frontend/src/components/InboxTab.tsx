import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Drawer,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import {
  createInject,
  deleteInject,
  listInjects,
  listInjectTemplates,
  updateInject,
  type Inject,
  type InjectCategory,
  type InjectPriority,
  type InjectSource,
  type InjectStatus,
  type InjectTemplate,
  type InjectVerdict,
} from "../api/client";

const SOURCE_OPTIONS: { value: InjectSource; label: string }[] = [
  { value: "remote_email", label: "Remote (email)" },
  { value: "in_person", label: "In-person" },
  { value: "other", label: "Other" },
];

const CATEGORY_OPTIONS: { value: InjectCategory; label: string }[] = [
  { value: "phishing_create", label: "Create phishing email" },
  { value: "phishing_classify", label: "Classify suspicious email" },
  { value: "network_question", label: "Network question" },
  { value: "general_question", label: "General question" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS: { value: InjectStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "responded", label: "Responded" },
  { value: "closed", label: "Closed" },
  { value: "deferred", label: "Deferred" },
];

const PRIORITY_OPTIONS: { value: InjectPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
];

const VERDICT_OPTIONS: { value: InjectVerdict; label: string }[] = [
  { value: "phishing", label: "Phishing" },
  { value: "legit", label: "Legitimate" },
  { value: "suspicious", label: "Suspicious" },
  { value: "inconclusive", label: "Inconclusive" },
];

const STATUS_COLOR: Record<InjectStatus, string> = {
  open: "usfGold",
  in_progress: "yellow",
  responded: "usfGreen",
  closed: "gray",
  deferred: "dark",
};

const PRIORITY_COLOR: Record<InjectPriority, string> = {
  low: "gray",
  normal: "blue",
  high: "red",
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : "—";

const overdueOf = (i: Inject) =>
  i.deadline ? new Date(i.deadline) < new Date() && i.status !== "closed" : false;

export function InboxTab({
  eid,
  workstreamId,
}: {
  eid: string;
  workstreamId: string;
}) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<InjectStatus | "">("");
  const [categoryFilter, setCategoryFilter] = useState<InjectCategory | "">("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Inject | null>(null);
  const [newOpen, newCtl] = useDisclosure(false);

  const list = useQuery({
    queryKey: ["injects", eid, workstreamId, statusFilter, categoryFilter, q],
    queryFn: () =>
      listInjects(eid, {
        workstreamId,
        statusFilter: statusFilter || undefined,
        category: categoryFilter || undefined,
        q: q || undefined,
      }),
  });

  const rows = list.data ?? [];

  const create = useMutation({
    mutationFn: (body: Parameters<typeof createInject>[1]) =>
      createInject(eid, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["injects", eid] });
      qc.invalidateQueries({ queryKey: ["dashboard", eid] });
      newCtl.close();
      notifications.show({ color: "usfGreen", message: "Inject logged." });
    },
    onError: () =>
      notifications.show({ color: "red", message: "Couldn't log inject." }),
  });

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={4}>Inject inbox</Title>
        <Button
          color="usfGold"
          c="dark.9"
          leftSection={<IconPlus size={16} />}
          onClick={newCtl.open}
        >
          New inject
        </Button>
      </Group>

      <QuickLogBar eid={eid} workstreamId={workstreamId} />

      <Group gap="xs">
        <Select
          placeholder="Status: all"
          data={STATUS_OPTIONS}
          value={statusFilter || null}
          onChange={(v) => setStatusFilter((v as InjectStatus) || "")}
          clearable
          w={150}
        />
        <Select
          placeholder="Category: all"
          data={CATEGORY_OPTIONS}
          value={categoryFilter || null}
          onChange={(v) => setCategoryFilter((v as InjectCategory) || "")}
          clearable
          w={220}
        />
        <TextInput
          placeholder="Search subject / body…"
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          w={260}
        />
      </Group>

      {list.isLoading ? (
        <Loader />
      ) : rows.length === 0 ? (
        <Text c="dimmed" size="sm">
          No injects yet. Click "New inject" or paste one in the quick-log bar above.
        </Text>
      ) : (
        <Table highlightOnHover striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Status</Table.Th>
              <Table.Th>Pri</Table.Th>
              <Table.Th>Cat</Table.Th>
              <Table.Th>Subject</Table.Th>
              <Table.Th>Source</Table.Th>
              <Table.Th>Requester</Table.Th>
              <Table.Th>Arrived</Table.Th>
              <Table.Th>Deadline</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => (
              <Table.Tr
                key={r.id}
                style={{ cursor: "pointer" }}
                onClick={() => setSelected(r)}
              >
                <Table.Td>
                  <Badge color={STATUS_COLOR[r.status]} variant="filled">
                    {r.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge color={PRIORITY_COLOR[r.priority]} variant="light">
                    {r.priority}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {r.category.replace("_", " ")}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {r.subject}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">
                    {r.source === "in_person" ? "in-person" : r.source.replace("_", " ")}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">{r.requester ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {fmt(r.arrived_at)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c={overdueOf(r) ? "red" : "dimmed"} fw={overdueOf(r) ? 700 : 400}>
                    {fmt(r.deadline)}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <NewInjectModal
        opened={newOpen}
        onClose={newCtl.close}
        onSubmit={(body) => create.mutate({ ...body, workstream_id: workstreamId })}
        loading={create.isPending}
      />

      <InjectDrawer
        eid={eid}
        workstreamId={workstreamId}
        inject={selected}
        onClose={() => setSelected(null)}
      />
    </Stack>
  );
}

function QuickLogBar({
  eid,
  workstreamId,
}: {
  eid: string;
  workstreamId: string;
}) {
  const qc = useQueryClient();
  const [source, setSource] = useState<InjectSource>("remote_email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const create = useMutation({
    mutationFn: () =>
      createInject(eid, {
        workstream_id: workstreamId,
        source,
        subject: subject.trim(),
        body_md: body.trim() || null,
        category: "general_question",
      }),
    onSuccess: () => {
      setSubject("");
      setBody("");
      qc.invalidateQueries({ queryKey: ["injects", eid] });
      qc.invalidateQueries({ queryKey: ["dashboard", eid] });
      notifications.show({ color: "usfGreen", message: "Inject logged." });
    },
    onError: () =>
      notifications.show({ color: "red", message: "Couldn't log." }),
  });
  return (
    <Box p="sm" style={{ border: "1px dashed var(--mantine-color-dark-4)", borderRadius: 8 }}>
      <Stack gap="xs">
        <Group gap="xs">
          <Select
            data={SOURCE_OPTIONS}
            value={source}
            onChange={(v) => v && setSource(v as InjectSource)}
            w={170}
            size="xs"
          />
          <TextInput
            placeholder="One-line subject (Ctrl+Enter to log)"
            value={subject}
            onChange={(e) => setSubject(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === "Enter" && subject.trim()) create.mutate();
            }}
            size="xs"
            style={{ flex: 1 }}
          />
          <Button
            size="xs"
            color="usfGreen"
            disabled={!subject.trim()}
            loading={create.isPending}
            onClick={() => create.mutate()}
          >
            Log
          </Button>
        </Group>
        <Textarea
          size="xs"
          placeholder="(optional) paste the inject body here"
          autosize
          minRows={1}
          maxRows={6}
          value={body}
          onChange={(e) => setBody(e.currentTarget.value)}
          styles={{ input: { fontFamily: "monospace" } }}
        />
      </Stack>
    </Box>
  );
}

function NewInjectModal({
  opened,
  onClose,
  onSubmit,
  loading,
}: {
  opened: boolean;
  onClose: () => void;
  onSubmit: (body: {
    source: InjectSource;
    category: InjectCategory;
    subject: string;
    body_md: string | null;
    requester: string | null;
    deadline: string | null;
    priority: InjectPriority;
  }) => void;
  loading: boolean;
}) {
  const [source, setSource] = useState<InjectSource>("remote_email");
  const [category, setCategory] = useState<InjectCategory>("general_question");
  const [priority, setPriority] = useState<InjectPriority>("normal");
  const [subject, setSubject] = useState("");
  const [bodyMd, setBodyMd] = useState("");
  const [requester, setRequester] = useState("");
  const [deadline, setDeadline] = useState<string | null>(null);

  return (
    <Modal opened={opened} onClose={onClose} title="New inject" size="lg">
      <Stack gap="sm">
        <Group grow>
          <Select
            label="Source"
            data={SOURCE_OPTIONS}
            value={source}
            onChange={(v) => v && setSource(v as InjectSource)}
          />
          <Select
            label="Category"
            data={CATEGORY_OPTIONS}
            value={category}
            onChange={(v) => v && setCategory(v as InjectCategory)}
          />
          <Select
            label="Priority"
            data={PRIORITY_OPTIONS}
            value={priority}
            onChange={(v) => v && setPriority(v as InjectPriority)}
          />
        </Group>
        <TextInput
          label="Subject"
          required
          value={subject}
          onChange={(e) => setSubject(e.currentTarget.value)}
        />
        <Group grow>
          <TextInput
            label="Requester"
            placeholder="e.g. White Team / Jane @ client"
            value={requester}
            onChange={(e) => setRequester(e.currentTarget.value)}
          />
          <TextInput
            label="Deadline"
            type="datetime-local"
            value={deadline ?? ""}
            onChange={(e) => setDeadline(e.currentTarget.value || null)}
          />
        </Group>
        <Textarea
          label="Body / inject text"
          autosize
          minRows={4}
          value={bodyMd}
          onChange={(e) => setBodyMd(e.currentTarget.value)}
          styles={{ input: { fontFamily: "monospace" } }}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="usfGold"
            c="dark.9"
            disabled={!subject.trim()}
            loading={loading}
            onClick={() =>
              onSubmit({
                source,
                category,
                priority,
                subject: subject.trim(),
                body_md: bodyMd.trim() || null,
                requester: requester.trim() || null,
                deadline: deadline ?? null,
              })
            }
          >
            Save inject
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function InjectDrawer({
  eid,
  workstreamId,
  inject,
  onClose,
}: {
  eid: string;
  workstreamId: string;
  inject: Inject | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const opened = inject !== null;
  const [response, setResponse] = useState(inject?.response_md ?? "");
  const [status, setStatus] = useState<InjectStatus>(inject?.status ?? "open");
  const [verdict, setVerdict] = useState<InjectVerdict | "">(inject?.verdict ?? "");
  const [tplOpen, tplCtl] = useDisclosure(false);

  // Sync local state when the selection changes.
  useEffect(() => {
    setResponse(inject?.response_md ?? "");
    setStatus(inject?.status ?? "open");
    setVerdict(inject?.verdict ?? "");
  }, [inject?.id, inject?.response_md, inject?.status, inject?.verdict]);

  const patch = useMutation({
    mutationFn: (body: Parameters<typeof updateInject>[2]) =>
      updateInject(eid, inject!.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["injects", eid] });
      qc.invalidateQueries({ queryKey: ["dashboard", eid] });
    },
    onError: () =>
      notifications.show({ color: "red", message: "Save failed." }),
  });

  const del = useMutation({
    mutationFn: () => deleteInject(eid, inject!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["injects", eid] });
      qc.invalidateQueries({ queryKey: ["dashboard", eid] });
      onClose();
    },
  });

  if (!inject) {
    return <Drawer opened={opened} onClose={onClose} position="right" size="lg" title="" />;
  }

  const isClassify = inject.category === "phishing_classify";

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="xl"
      title={
        <Group gap="xs">
          <Badge color={STATUS_COLOR[status]}>{status}</Badge>
          <Badge color={PRIORITY_COLOR[inject.priority]} variant="light">
            {inject.priority}
          </Badge>
          <Text fw={600}>{inject.subject}</Text>
        </Group>
      }
    >
      <Stack gap="md">
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            {inject.source.replace("_", " ")} · {inject.category.replace("_", " ")} ·{" "}
            arrived {fmt(inject.arrived_at)}
          </Text>
          <ActionIcon
            color="red"
            variant="subtle"
            loading={del.isPending}
            onClick={() => {
              if (confirm("Delete this inject?")) del.mutate();
            }}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>

        <Box>
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            Inject body
          </Text>
          <Textarea
            value={inject.body_md ?? ""}
            onChange={(e) => patch.mutate({ body_md: e.currentTarget.value })}
            autosize
            minRows={3}
            styles={{ input: { fontFamily: "monospace" } }}
          />
        </Box>

        <Group grow>
          <Select
            label="Status"
            data={STATUS_OPTIONS}
            value={status}
            onChange={(v) => {
              if (!v) return;
              const next = v as InjectStatus;
              setStatus(next);
              patch.mutate({ status: next });
            }}
          />
          <Select
            label="Priority"
            data={PRIORITY_OPTIONS}
            value={inject.priority}
            onChange={(v) => v && patch.mutate({ priority: v as InjectPriority })}
          />
          <Select
            label="Category"
            data={CATEGORY_OPTIONS}
            value={inject.category}
            onChange={(v) => v && patch.mutate({ category: v as InjectCategory })}
          />
        </Group>

        {isClassify && (
          <Select
            label="Verdict"
            data={VERDICT_OPTIONS}
            value={verdict || null}
            onChange={(v) => {
              const next = (v ?? "") as InjectVerdict | "";
              setVerdict(next);
              patch.mutate({ verdict: next || null });
            }}
            clearable
          />
        )}

        <Box>
          <Group justify="space-between" mb={4}>
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">
              Our response
            </Text>
            <Button
              size="xs"
              variant="subtle"
              onClick={tplCtl.open}
            >
              Apply template
            </Button>
          </Group>
          <Textarea
            value={response}
            onChange={(e) => setResponse(e.currentTarget.value)}
            onBlur={() => {
              if ((inject.response_md ?? "") !== response)
                patch.mutate({ response_md: response });
            }}
            autosize
            minRows={6}
            placeholder="Draft your response here. Click 'Apply template' to seed from the library."
            styles={{ input: { fontFamily: "monospace" } }}
          />
        </Box>

        <Group justify="flex-end">
          <Button
            color="usfGreen"
            disabled={status === "responded"}
            onClick={() => {
              setStatus("responded");
              patch.mutate({
                status: "responded",
                response_md: response,
              });
            }}
          >
            Mark responded
          </Button>
        </Group>

        <TemplatePicker
          opened={tplOpen}
          onClose={tplCtl.close}
          eid={eid}
          workstreamId={workstreamId}
          category={inject.category}
          onPick={(tpl) => {
            const next = response ? `${response}\n\n${tpl.body_md}` : tpl.body_md;
            setResponse(next);
            patch.mutate({ response_md: next });
            tplCtl.close();
          }}
        />
      </Stack>
    </Drawer>
  );
}

function TemplatePicker({
  opened,
  onClose,
  eid,
  category,
  onPick,
}: {
  opened: boolean;
  onClose: () => void;
  eid: string;
  workstreamId: string;
  category: InjectCategory;
  onPick: (t: InjectTemplate) => void;
}) {
  const q = useQuery({
    queryKey: ["inject-templates", eid, category],
    queryFn: () => listInjectTemplates(eid, { category, include_global: true }),
    enabled: opened,
  });
  const items = q.data ?? [];
  return (
    <Modal opened={opened} onClose={onClose} title="Apply template" size="lg">
      {q.isLoading ? (
        <Loader />
      ) : items.length === 0 ? (
        <Text c="dimmed" size="sm">
          No templates yet in this category. Add one from the Library tab.
        </Text>
      ) : (
        <Stack gap="xs">
          {items.map((t) => (
            <Box
              key={t.id}
              p="sm"
              style={{
                border: "1px solid var(--mantine-color-dark-4)",
                borderRadius: 6,
                cursor: "pointer",
              }}
              onClick={() => onPick(t)}
            >
              <Group justify="space-between">
                <Text fw={600}>{t.title}</Text>
                <Badge size="xs" color={t.engagement_id ? "usfGreen" : "usfGold"} variant="light">
                  {t.engagement_id ? "engagement" : "global"}
                </Badge>
              </Group>
              <Text size="xs" c="dimmed" lineClamp={3} mt={4} ff="monospace">
                {t.body_md}
              </Text>
            </Box>
          ))}
        </Stack>
      )}
    </Modal>
  );
}
