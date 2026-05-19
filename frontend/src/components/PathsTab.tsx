import {
  ActionIcon,
  Badge,
  Button,
  Card,
  CopyButton,
  Group,
  Loader,
  Modal,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconCopy,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ElementDefinition } from "cytoscape";
import CytoscapeComponent from "react-cytoscapejs";
import { useState } from "react";

import {
  addStep,
  createPath,
  deletePath,
  deleteStep,
  getPathGraph,
  listAssets,
  listPaths,
  reorderSteps,
  updatePath,
  type AccessPath,
  type PathStatus,
  type Workstream,
} from "../api/client";

const STATUS_COLOR: Record<string, string> = {
  planning: "gray",
  working: "orange",
  achieved: "usfGreen",
  lost: "red",
};
const STATUSES: PathStatus[] = ["planning", "working", "achieved", "lost"];

function PathMap({ eid, pid }: { eid: string; pid: string }) {
  const g = useQuery({
    queryKey: ["graph", eid, pid],
    queryFn: () => getPathGraph(eid, pid),
  });
  if (g.isLoading) return <Loader />;
  const elements = g.data?.elements ?? [];
  if (elements.length === 0)
    return (
      <Text c="dimmed" size="sm" ta="center" py="xl">
        Give steps a “from host” and “to host” to draw the map. Best for AD
        lateral movement.
      </Text>
    );
  return (
    <Paper withBorder h={460} radius="md">
      <CytoscapeComponent
        elements={elements as unknown as ElementDefinition[]}
        style={{ width: "100%", height: "100%" }}
        layout={{ name: "breadthfirst", directed: true, spacingFactor: 1.3 }}
        stylesheet={[
          {
            selector: "node",
            style: {
              label: "data(label)",
              "background-color": "#006747",
              color: "#EDEBD1",
              "font-size": 12,
              "text-valign": "bottom",
              "text-margin-y": 6,
              width: 34,
              height: 34,
            },
          },
          {
            selector: "node[?target]",
            style: {
              "background-color": "#CFC493",
              "border-width": 3,
              "border-color": "#006747",
            },
          },
          {
            selector: "edge",
            style: {
              label: "data(label)",
              "curve-style": "bezier",
              "target-arrow-shape": "triangle",
              "line-color": "#7E96A0",
              "target-arrow-color": "#7E96A0",
              "font-size": 10,
              color: "#CAD2D8",
              "text-background-color": "#303434",
              "text-background-opacity": 0.7,
              "text-background-padding": 2,
            },
          },
        ]}
      />
    </Paper>
  );
}

function PathDetail({
  eid,
  path,
  onChanged,
}: {
  eid: string;
  path: AccessPath;
  onChanged: () => void;
}) {
  const [view, setView] = useState("walk");
  const assets = useQuery({
    queryKey: ["assets", eid, "all"],
    queryFn: () => listAssets(eid),
  });
  const hostName = (id: string | null) =>
    assets.data?.find((a) => a.id === id)?.identifier ?? "host";
  const opts =
    assets.data?.map((a) => ({ value: a.id, label: a.identifier })) ?? [];

  const [title, setTitle] = useState("");
  const [cmd, setCmd] = useState("");
  const [result, setResult] = useState("");
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);

  const setStatus = useMutation({
    mutationFn: (s: PathStatus) => updatePath(eid, path.id, { status: s }),
    onSuccess: onChanged,
  });
  const add = useMutation({
    mutationFn: () =>
      addStep(eid, path.id, {
        title: title.trim(),
        command_or_action: cmd || null,
        expected_result: result || null,
        from_asset_id: from,
        to_asset_id: to,
      }),
    onSuccess: () => {
      setTitle("");
      setCmd("");
      setResult("");
      onChanged();
    },
  });
  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderSteps(eid, path.id, ids),
    onSuccess: onChanged,
  });
  const move = (idx: number, dir: -1 | 1) => {
    const ids = path.steps.map((s) => s.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    reorder.mutate(ids);
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={4}>{path.name}</Title>
        <Group gap="xs">
          <Select
            size="xs"
            w={130}
            allowDeselect={false}
            data={STATUSES}
            value={path.status}
            onChange={(v) => v && setStatus.mutate(v as PathStatus)}
          />
        </Group>
      </Group>

      <SegmentedControl
        value={view}
        onChange={setView}
        color="usfGreen"
        data={[
          { label: "Walkthrough", value: "walk" },
          { label: "Map", value: "map" },
        ]}
      />

      {view === "map" ? (
        <PathMap eid={eid} pid={path.id} />
      ) : (
        <Stack>
          {path.steps.length === 0 && (
            <Text c="dimmed" ta="center" py="md">
              No steps yet — add the first move below.
            </Text>
          )}
          {path.steps.map((s, i) => (
            <StepRowWithMove
              key={s.id}
              eid={eid}
              pid={path.id}
              index={i}
              total={path.steps.length}
              step={s}
              hostName={hostName}
              onChanged={onChanged}
              onMove={(dir) => move(i, dir)}
            />
          ))}

          <Card withBorder padding="md" bg="dark.6">
            <Stack gap="xs">
              <TextInput
                label="Next step"
                placeholder="e.g. DCSync with svc_sql hash"
                value={title}
                onChange={(e) => setTitle(e.currentTarget.value)}
              />
              <Group grow>
                <Select
                  label="From host"
                  data={opts}
                  value={from}
                  onChange={setFrom}
                  clearable
                  searchable
                />
                <Select
                  label="To host"
                  data={opts}
                  value={to}
                  onChange={setTo}
                  clearable
                  searchable
                />
              </Group>
              <Textarea
                label="Command / action"
                placeholder="exact command — copyable later"
                autosize
                minRows={1}
                value={cmd}
                onChange={(e) => setCmd(e.currentTarget.value)}
                styles={{ input: { fontFamily: "monospace" } }}
              />
              <TextInput
                label="Result"
                placeholder="what you got (e.g. DA hash)"
                value={result}
                onChange={(e) => setResult(e.currentTarget.value)}
              />
              <Button
                leftSection={<IconPlus size={16} />}
                color="usfGreen"
                disabled={!title.trim()}
                loading={add.isPending}
                onClick={() => add.mutate()}
              >
                Add step
              </Button>
            </Stack>
          </Card>
        </Stack>
      )}
    </Stack>
  );
}

interface StepRowProps {
  eid: string;
  pid: string;
  index: number;
  total: number;
  step: AccessPath["steps"][number];
  hostName: (id: string | null) => string;
  onChanged: () => void;
  onMove: (dir: -1 | 1) => void;
}

function StepRowWithMove(props: StepRowProps) {
  const { onMove, ...rest } = props;
  return (
    <Card withBorder padding="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <StepBody {...rest} />
        <Group gap={4} wrap="nowrap">
          <ActionIcon
            variant="subtle"
            disabled={rest.index === 0}
            onClick={() => onMove(-1)}
          >
            <IconArrowUp size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            disabled={rest.index === rest.total - 1}
            onClick={() => onMove(1)}
          >
            <IconArrowDown size={16} />
          </ActionIcon>
          <DeleteStep
            eid={rest.eid}
            pid={rest.pid}
            sid={rest.step.id}
            onChanged={rest.onChanged}
          />
        </Group>
      </Group>
    </Card>
  );
}

function DeleteStep({
  eid,
  pid,
  sid,
  onChanged,
}: {
  eid: string;
  pid: string;
  sid: string;
  onChanged: () => void;
}) {
  const del = useMutation({
    mutationFn: () => deleteStep(eid, pid, sid),
    onSuccess: onChanged,
  });
  return (
    <ActionIcon color="red" variant="subtle" onClick={() => del.mutate()}>
      <IconTrash size={16} />
    </ActionIcon>
  );
}

function StepBody({
  index,
  step,
  hostName,
}: {
  index: number;
  step: AccessPath["steps"][number];
  hostName: (id: string | null) => string;
}) {
  return (
    <Group align="flex-start" wrap="nowrap" gap="md" style={{ flex: 1 }}>
      <Badge size="lg" circle variant="filled" color="usfGreen">
        {index + 1}
      </Badge>
      <div style={{ flex: 1 }}>
        <Text fw={700}>{step.title}</Text>
        {(step.from_asset_id || step.to_asset_id) && (
          <Group gap={6} mt={4}>
            {step.from_asset_id && (
              <Badge variant="light" color="gray">
                {hostName(step.from_asset_id)}
              </Badge>
            )}
            <Text size="xs" c="dimmed">
              →
            </Text>
            {step.to_asset_id && (
              <Badge variant="light" color="usfGreen">
                {hostName(step.to_asset_id)}
              </Badge>
            )}
          </Group>
        )}
        {step.command_or_action && (
          <Group
            mt={6}
            gap="xs"
            wrap="nowrap"
            align="flex-start"
            bg="dark.8"
            p="xs"
            style={{ borderRadius: 6 }}
          >
            <Text
              ff="monospace"
              size="sm"
              style={{
                flex: 1,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {step.command_or_action}
            </Text>
            <CopyButton value={step.command_or_action}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? "Copied" : "Copy"}>
                  <ActionIcon
                    variant="subtle"
                    color={copied ? "usfGreen" : "gray"}
                    onClick={copy}
                  >
                    {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Group>
        )}
        {step.expected_result && (
          <Text size="sm" c="dimmed" mt={4}>
            → {step.expected_result}
          </Text>
        )}
      </div>
    </Group>
  );
}

export function PathsTab({
  eid,
  workstreamId,
}: {
  eid: string;
  workstreams: Workstream[];
  workstreamId?: string;
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["paths", eid, workstreamId ?? "all"],
    queryFn: () => listPaths(eid, workstreamId),
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const [name, setName] = useState("");

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["paths", eid] });

  const create = useMutation({
    mutationFn: () =>
      createPath(eid, {
        name: name.trim(),
        workstream_id: workstreamId ?? null,
      }),
    onSuccess: (p) => {
      close();
      setName("");
      invalidate();
      setSelected(p.id);
    },
  });
  const del = useMutation({
    mutationFn: (pid: string) => deletePath(eid, pid),
    onSuccess: () => {
      setSelected(null);
      invalidate();
    },
  });

  const current = q.data?.find((p) => p.id === selected) ?? null;

  return (
    <Group align="flex-start" wrap="nowrap" gap="lg">
      <Stack w={260} gap="xs" style={{ flexShrink: 0 }}>
        <Button color="usfGold" c="dark.9" onClick={open}>
          + New access path
        </Button>
        {q.isLoading && <Loader />}
        {q.data?.length === 0 && (
          <Text c="dimmed" size="sm" ta="center" mt="md">
            No paths in this view yet.
          </Text>
        )}
        {q.data?.map((p) => (
          <Card
            key={p.id}
            withBorder
            padding="sm"
            style={{ cursor: "pointer" }}
            bg={p.id === selected ? "dark.5" : undefined}
            onClick={() => setSelected(p.id)}
          >
            <Group justify="space-between" wrap="nowrap">
              <Text fw={600} size="sm" lineClamp={1}>
                {p.name}
              </Text>
              <Badge size="xs" color={STATUS_COLOR[p.status]}>
                {p.status}
              </Badge>
            </Group>
            <Text size="xs" c="dimmed">
              {p.steps.length} steps
            </Text>
          </Card>
        ))}
      </Stack>

      <div style={{ flex: 1, minWidth: 0 }}>
        {current ? (
          <Stack>
            <Group justify="flex-end">
              <ActionIcon
                color="red"
                variant="subtle"
                onClick={() => del.mutate(current.id)}
              >
                <IconTrash size={18} />
              </ActionIcon>
            </Group>
            <PathDetail eid={eid} path={current} onChanged={invalidate} />
          </Stack>
        ) : (
          <Text c="dimmed" ta="center" mt="xl">
            Select a path on the left, or create one — then walk through exactly
            how you got there (with copyable commands) or view the host map.
          </Text>
        )}
      </div>

      <Modal opened={opened} onClose={close} title="New access path" centered>
        <Stack>
          <TextInput
            label="Name"
            placeholder="Foothold → Domain Admin"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
          <Button
            color="usfGreen"
            disabled={!name.trim()}
            loading={create.isPending}
            onClick={() => create.mutate()}
          >
            Create
          </Button>
        </Stack>
      </Modal>
    </Group>
  );
}
