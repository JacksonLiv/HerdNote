import {
  Accordion,
  ActionIcon,
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconCircleCheck, IconCirclePlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  createPlaybookNote,
  deletePlaybookNote,
  getPlaybook,
  setPlaybookState,
  type PlaybookStateEntry,
  type PlaybookStatus,
  type WorkstreamNote,
} from "../api/client";
import {
  PLAYBOOKS,
  type CaptureField,
  type CaptureSchema,
  type PlaybookCategory,
  type PlaybookTask,
} from "../lib/playbookCatalogs";

const STATUS_CYCLE: PlaybookStatus[] = ["todo", "in_progress", "done", "na"];
const STATUS_LABEL: Record<PlaybookStatus, string> = {
  todo: "todo",
  in_progress: "in progress",
  done: "done",
  na: "n/a",
};
const STATUS_COLOR: Record<PlaybookStatus, string> = {
  todo: "gray",
  in_progress: "usfGold",
  done: "usfGreen",
  na: "dark",
};

interface WorkstreamLike {
  id: string;
  name: string;
  kind: string;
}

export function PlaybookTab({
  eid,
  workstream,
}: {
  eid: string;
  workstream: WorkstreamLike;
}) {
  const qc = useQueryClient();
  const catalog = PLAYBOOKS[workstream.kind as keyof typeof PLAYBOOKS];
  const q = useQuery({
    queryKey: ["playbook", eid, workstream.id],
    queryFn: () => getPlaybook(eid, workstream.id),
  });

  const stateByKey = useMemo(() => {
    const m = new Map<string, PlaybookStateEntry>();
    for (const s of q.data?.state ?? []) m.set(s.task_key, s);
    return m;
  }, [q.data]);

  const notesByCat = useMemo(() => {
    const m = new Map<string, WorkstreamNote[]>();
    for (const n of q.data?.notes ?? []) {
      const arr = m.get(n.category) ?? [];
      arr.push(n);
      m.set(n.category, arr);
    }
    return m;
  }, [q.data]);

  const setStatus = useMutation({
    mutationFn: (vars: {
      taskKey: string;
      status?: PlaybookStatus;
      notes_md?: string | null;
    }) =>
      setPlaybookState(eid, workstream.id, vars.taskKey, {
        status: vars.status,
        notes_md: vars.notes_md,
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["playbook", eid, workstream.id] }),
    onError: () =>
      notifications.show({ color: "red", message: "Couldn't save status." }),
  });

  const addNote = useMutation({
    mutationFn: (body: {
      category: string;
      task_key?: string | null;
      title: string;
      data?: Record<string, unknown>;
    }) => createPlaybookNote(eid, workstream.id, body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["playbook", eid, workstream.id] }),
    onError: () =>
      notifications.show({ color: "red", message: "Couldn't add entry." }),
  });

  const removeNote = useMutation({
    mutationFn: (id: string) => deletePlaybookNote(eid, workstream.id, id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["playbook", eid, workstream.id] }),
  });

  if (!catalog) {
    return (
      <Alert color="gray" title="No playbook yet">
        <Text size="sm">
          The "{workstream.kind}" workstream type doesn't have a built-in
          playbook. Use the Notes tab for free-form capture, or pick a
          different workstream kind in Settings.
        </Text>
      </Alert>
    );
  }
  if (q.isLoading) return <Loader />;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={4}>{workstream.name} — Playbook</Title>
          <Text size="xs" c="dimmed">
            Click a status pill to cycle. Use "+ Capture" to log structured
            evidence under a task.
          </Text>
        </div>
      </Group>

      <Accordion variant="separated" multiple defaultValue={catalog.categories.slice(0, 1).map((c) => c.key)}>
        {catalog.categories.map((cat) => (
          <CategoryPanel
            key={cat.key}
            category={cat}
            stateByKey={stateByKey}
            notes={notesByCat.get(cat.key) ?? []}
            onStatus={(taskKey, status) =>
              setStatus.mutate({ taskKey, status })
            }
            onNotes={(taskKey, notes_md) =>
              setStatus.mutate({ taskKey, notes_md })
            }
            onCapture={(taskKey, title, data) =>
              addNote.mutate({ category: cat.key, task_key: taskKey, title, data })
            }
            onRemove={(id) => removeNote.mutate(id)}
          />
        ))}
      </Accordion>
    </Stack>
  );
}

function CategoryPanel({
  category,
  stateByKey,
  notes,
  onStatus,
  onNotes,
  onCapture,
  onRemove,
}: {
  category: PlaybookCategory;
  stateByKey: Map<string, PlaybookStateEntry>;
  notes: WorkstreamNote[];
  onStatus: (taskKey: string, status: PlaybookStatus) => void;
  onNotes: (taskKey: string, notes_md: string) => void;
  onCapture: (taskKey: string, title: string, data: Record<string, unknown>) => void;
  onRemove: (id: string) => void;
}) {
  const doneCount = category.tasks.filter(
    (t) => stateByKey.get(t.key)?.status === "done",
  ).length;

  return (
    <Accordion.Item value={category.key}>
      <Accordion.Control>
        <Group justify="space-between" pr="md">
          <Text fw={600}>{category.label}</Text>
          <Group gap={6}>
            <Badge size="sm" variant="light" color="usfGreen">
              {doneCount} / {category.tasks.length} done
            </Badge>
            <Badge size="sm" variant="light" color="usfGold">
              {notes.length} captures
            </Badge>
          </Group>
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <Stack gap="sm">
          {category.tasks.map((task) => (
            <TaskRow
              key={task.key}
              task={task}
              state={stateByKey.get(task.key)}
              onStatus={(s) => onStatus(task.key, s)}
              onNotes={(t) => onNotes(task.key, t)}
              onCapture={(title, data) => onCapture(task.key, title, data)}
            />
          ))}
          {notes.length > 0 && (
            <Paper withBorder p="sm" radius="sm" bg="dark.6">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase" mb={4}>
                Recent captures
              </Text>
              <Stack gap={4}>
                {notes.slice(0, 8).map((n) => (
                  <Group key={n.id} gap="xs" justify="space-between">
                    <Group gap={6}>
                      <Badge size="xs" color="usfGold" variant="light">
                        {n.task_key?.split(".").slice(-1)[0] ?? n.category.split(".").slice(-1)[0]}
                      </Badge>
                      <Text size="sm" ff="monospace">
                        {n.title}
                      </Text>
                    </Group>
                    <ActionIcon
                      size="xs"
                      color="red"
                      variant="subtle"
                      onClick={() => onRemove(n.id)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                ))}
              </Stack>
            </Paper>
          )}
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

function TaskRow({
  task,
  state,
  onStatus,
  onNotes,
  onCapture,
}: {
  task: PlaybookTask;
  state: PlaybookStateEntry | undefined;
  onStatus: (s: PlaybookStatus) => void;
  onNotes: (notes_md: string) => void;
  onCapture: (title: string, data: Record<string, unknown>) => void;
}) {
  const status: PlaybookStatus = state?.status ?? "todo";
  const [opened, { open, close }] = useDisclosure(false);
  const [localNotes, setLocalNotes] = useState(state?.notes_md ?? "");
  const cycle = () => {
    const i = STATUS_CYCLE.indexOf(status);
    onStatus(STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length]);
  };

  return (
    <Paper withBorder p="sm" radius="sm">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Group gap="xs" wrap="nowrap" style={{ flex: 1 }}>
          <Badge
            color={STATUS_COLOR[status]}
            variant="filled"
            style={{ cursor: "pointer", minWidth: 100 }}
            onClick={cycle}
            leftSection={status === "done" ? <IconCircleCheck size={12} /> : undefined}
          >
            {STATUS_LABEL[status]}
          </Badge>
          <Stack gap={2} style={{ flex: 1 }}>
            <Text size="sm" fw={500}>
              {task.label}
            </Text>
            {task.hint && (
              <Text size="xs" c="dimmed">
                {task.hint}
              </Text>
            )}
          </Stack>
        </Group>
        {task.capture && (
          <Button
            size="xs"
            variant="light"
            color="usfGold"
            leftSection={<IconCirclePlus size={14} />}
            onClick={open}
          >
            Capture
          </Button>
        )}
      </Group>
      <Textarea
        mt={6}
        size="xs"
        placeholder="Notes for this task (autosaves on blur)"
        autosize
        minRows={1}
        value={localNotes}
        onChange={(e) => setLocalNotes(e.currentTarget.value)}
        onBlur={() => {
          if ((state?.notes_md ?? "") !== localNotes) onNotes(localNotes);
        }}
      />
      {task.capture && (
        <CaptureModal
          opened={opened}
          onClose={close}
          schema={task.capture}
          onSubmit={(title, data) => {
            onCapture(title, data);
            close();
          }}
        />
      )}
    </Paper>
  );
}

function CaptureModal({
  opened,
  onClose,
  schema,
  onSubmit,
}: {
  opened: boolean;
  onClose: () => void;
  schema: CaptureSchema;
  onSubmit: (title: string, data: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>({});

  const update = (key: string, v: unknown) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const submit = () => {
    const firstFieldKey = schema.fields[0]?.key;
    const title =
      (firstFieldKey ? String(values[firstFieldKey] ?? "") : "").slice(0, 120) ||
      schema.title;
    onSubmit(title, values);
    setValues({});
  };

  return (
    <Modal opened={opened} onClose={onClose} title={schema.title} size="md">
      <Stack gap="sm">
        {schema.fields.map((f) => (
          <FieldInput key={f.key} field={f} value={values[f.key]} onChange={(v) => update(f.key, v)} />
        ))}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button color="usfGold" c="dark.9" onClick={submit}>
            Save capture
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: CaptureField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (field.type === "longtext")
    return (
      <Textarea
        label={field.label}
        autosize
        minRows={2}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.currentTarget.value)}
      />
    );
  if (field.type === "select")
    return (
      <Select
        label={field.label}
        data={field.options ?? []}
        value={(value as string) ?? null}
        onChange={(v) => onChange(v ?? "")}
        searchable
        clearable
      />
    );
  if (field.type === "number")
    return (
      <NumberInput
        label={field.label}
        value={(value as number) ?? ""}
        onChange={(v) => onChange(v)}
      />
    );
  if (field.type === "checkbox")
    return (
      <Checkbox
        label={field.label}
        checked={Boolean(value)}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
    );
  return (
    <TextInput
      label={field.label}
      placeholder={field.placeholder}
      value={(value as string) ?? ""}
      onChange={(e) => onChange(e.currentTarget.value)}
    />
  );
}
