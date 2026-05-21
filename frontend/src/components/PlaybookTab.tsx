import {
  Accordion,
  Alert,
  Badge,
  Checkbox,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  getPlaybook,
  setPlaybookState,
  type PlaybookStateEntry,
} from "../api/client";
import { PLAYBOOKS, type PlaybookCategory, type PlaybookTask } from "../lib/playbookCatalogs";

interface WorkstreamLike {
  id: string;
  name: string;
  kind: string;
}

export function PlaybookTab({ eid, workstream }: { eid: string; workstream: WorkstreamLike }) {
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

  const toggle = useMutation({
    mutationFn: (vars: { taskKey: string; checked: boolean }) =>
      setPlaybookState(eid, workstream.id, vars.taskKey, {
        status: vars.checked ? "done" : "todo",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playbook", eid, workstream.id] }),
    onError: () => notifications.show({ color: "red", message: "Couldn't save." }),
  });

  if (!catalog) {
    return (
      <Alert color="gray" title="No playbook yet">
        <Text size="sm">
          The "{workstream.kind}" workstream type doesn't have a built-in playbook.
          Use the Notes tab for free-form capture.
        </Text>
      </Alert>
    );
  }
  if (q.isLoading) return <Loader />;

  return (
    <Stack gap="md">
      <div>
        <Title order={4}>{workstream.name} — Playbook</Title>
        <Text size="xs" c="dimmed">Check off each item as you attempt it.</Text>
      </div>

      <Accordion variant="separated" multiple defaultValue={catalog.categories.slice(0, 1).map((c) => c.key)}>
        {catalog.categories.map((cat) => (
          <CategoryPanel
            key={cat.key}
            category={cat}
            stateByKey={stateByKey}
            onToggle={(taskKey, checked) => toggle.mutate({ taskKey, checked })}
          />
        ))}
      </Accordion>
    </Stack>
  );
}

function CategoryPanel({
  category,
  stateByKey,
  onToggle,
}: {
  category: PlaybookCategory;
  stateByKey: Map<string, PlaybookStateEntry>;
  onToggle: (taskKey: string, checked: boolean) => void;
}) {
  const doneCount = category.tasks.filter((t) => stateByKey.get(t.key)?.status === "done").length;

  return (
    <Accordion.Item value={category.key}>
      <Accordion.Control>
        <Group justify="space-between" pr="md">
          <Text fw={600}>{category.label}</Text>
          <Badge size="sm" variant="light" color={doneCount === category.tasks.length ? "usfGreen" : "gray"}>
            {doneCount} / {category.tasks.length}
          </Badge>
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <Stack gap="xs">
          {category.tasks.map((task) => (
            <TaskRow
              key={task.key}
              task={task}
              checked={stateByKey.get(task.key)?.status === "done"}
              onToggle={(checked) => onToggle(task.key, checked)}
            />
          ))}
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

function TaskRow({
  task,
  checked,
  onToggle,
}: {
  task: PlaybookTask;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <Group gap="sm" align="flex-start" wrap="nowrap">
      <Checkbox
        checked={checked}
        onChange={(e) => onToggle(e.currentTarget.checked)}
        color="usfGreen"
        mt={2}
      />
      <Stack gap={2} style={{ flex: 1 }}>
        <Text size="sm" fw={500} td={checked ? "line-through" : undefined} c={checked ? "dimmed" : undefined}>
          {task.label}
        </Text>
        {task.hint && (
          <Text size="xs" c="dimmed">{task.hint}</Text>
        )}
      </Stack>
    </Group>
  );
}
