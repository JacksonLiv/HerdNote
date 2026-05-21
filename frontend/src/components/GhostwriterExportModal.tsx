import {
  Badge,
  Button,
  Checkbox,
  Divider,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import {
  exportToGhostwriter,
  listFindings,
  listGhostwriterProjects,
  type Engagement,
  type Finding,
  type GhostwriterProject,
} from "../api/client";
import { SEVERITY_COLOR } from "../theme";

const ALL_STATUSES = ["open", "accepted", "remediated", "false_positive", "draft"] as const;
type FindingStatus = (typeof ALL_STATUSES)[number];

const STATUS_LABEL: Record<FindingStatus, string> = {
  open: "Open",
  accepted: "Accepted risk",
  remediated: "Remediated",
  false_positive: "False positive",
  draft: "Draft",
};

const SEVERITIES = ["critical", "high", "medium", "low", "informational"] as const;

function SeveritySummary({ findings }: { findings: Finding[] }) {
  const counts = SEVERITIES.reduce<Record<string, number>>(
    (acc, s) => {
      acc[s] = findings.filter((f) => f.severity === s).length;
      return acc;
    },
    {},
  );
  const nonZero = SEVERITIES.filter((s) => counts[s] > 0);
  if (nonZero.length === 0) return null;
  return (
    <Group gap="xs" wrap="wrap">
      {nonZero.map((s) => (
        <Badge key={s} color={SEVERITY_COLOR[s]} variant="light" size="sm">
          {counts[s]} {s}
        </Badge>
      ))}
    </Group>
  );
}

interface Props {
  opened: boolean;
  onClose: () => void;
  engagement: Engagement;
}

export function GhostwriterExportModal({ opened, onClose, engagement }: Props) {
  const [selectedStatuses, setSelectedStatuses] = useState<FindingStatus[]>([
    "open",
    "accepted",
  ]);
  const [useExisting, setUseExisting] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [result, setResult] = useState<{
    pushed: number;
    updated: number;
    errors: string[];
  } | null>(null);

  const findingsQ = useQuery({
    queryKey: ["findings", engagement.id],
    queryFn: () => listFindings(engagement.id),
    enabled: opened,
  });

  const projectsQ = useQuery({
    queryKey: ["gw-projects", engagement.id],
    queryFn: () => listGhostwriterProjects(engagement.id),
    enabled: opened && useExisting,
  });

  const selectedFindings = (findingsQ.data ?? []).filter((f) =>
    selectedStatuses.includes(f.status as FindingStatus),
  );

  const selectedProject: GhostwriterProject | undefined = projectsQ.data?.find(
    (p) => String(p.project_id) === selectedProjectId,
  );

  const push = useMutation({
    mutationFn: () => {
      const gwReportId =
        useExisting && selectedProject?.report_id != null
          ? selectedProject.report_id
          : undefined;
      return exportToGhostwriter(engagement.id, selectedStatuses, gwReportId);
    },
    onSuccess: (data) => {
      setResult(data);
      if (data.errors.length === 0) {
        notifications.show({
          color: "usfGreen",
          message: `Pushed ${data.pushed} new, updated ${data.updated} existing.`,
        });
      }
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      notifications.show({
        color: "red",
        message: err.response?.data?.detail ?? "Export to Ghostwriter failed.",
      });
    },
  });

  const toggleStatus = (s: FindingStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
    setResult(null);
  };

  const handleClose = () => {
    setResult(null);
    setUseExisting(false);
    setSelectedProjectId(null);
    onClose();
  };

  const projectOptions = (projectsQ.data ?? []).map((p) => ({
    value: String(p.project_id),
    label: `${p.client_name} / ${p.project_name}`,
  }));

  const canPush =
    selectedFindings.length > 0 &&
    (!useExisting || selectedProjectId !== null);

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Export to Ghostwriter"
      centered
      size="md"
    >
      <Stack gap="md">
        <Divider label="Destination" labelPosition="left" />

        <Stack gap="xs">
          <Checkbox
            label="Use an existing Ghostwriter project"
            checked={useExisting}
            onChange={(e) => {
              setUseExisting(e.currentTarget.checked);
              setSelectedProjectId(null);
              setResult(null);
            }}
            color="usfGreen"
          />

          {useExisting ? (
            projectsQ.isLoading ? (
              <Loader size="sm" />
            ) : (
              <Select
                placeholder="Select a project…"
                data={projectOptions}
                value={selectedProjectId}
                onChange={(v) => { setSelectedProjectId(v); setResult(null); }}
                searchable
                nothingFoundMessage="No projects found"
              />
            )
          ) : (
            <Text size="xs" c="dimmed">
              Client, project, and report will be created automatically in
              Ghostwriter if they don't exist, matched by name.
            </Text>
          )}

          {useExisting && selectedProject && (
            <Text size="xs" c="dimmed">
              {selectedProject.report_id
                ? `Findings will be pushed to report "${selectedProject.report_title ?? "Untitled"}".`
                : "No report found for this project — one will be created automatically."}
            </Text>
          )}
        </Stack>

        <Divider label="Include findings with status" labelPosition="left" />

        <Stack gap="xs">
          {ALL_STATUSES.map((s) => (
            <Checkbox
              key={s}
              label={STATUS_LABEL[s]}
              checked={selectedStatuses.includes(s)}
              onChange={() => toggleStatus(s)}
              color="usfGreen"
            />
          ))}
        </Stack>

        <Divider />

        {findingsQ.isLoading ? (
          <Loader size="sm" />
        ) : (
          <Stack gap="xs">
            <Text size="sm">
              <Text span fw={600}>
                {selectedFindings.length}
              </Text>{" "}
              finding{selectedFindings.length !== 1 ? "s" : ""} selected
            </Text>
            <SeveritySummary findings={selectedFindings} />
          </Stack>
        )}

        {result && (
          <Stack gap="xs">
            <Group gap="xs">
              <IconCheck size={16} color="var(--mantine-color-usfGreen-6)" />
              <Text size="sm" c="usfGreen">
                Pushed {result.pushed} new, updated {result.updated} existing.
              </Text>
            </Group>
            {result.errors.length > 0 && (
              <Stack gap={4}>
                <Text size="xs" c="red" fw={600}>
                  Errors ({result.errors.length}):
                </Text>
                {result.errors.map((e, i) => (
                  <Text key={i} size="xs" c="red" ff="monospace">
                    {e}
                  </Text>
                ))}
              </Stack>
            )}
          </Stack>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={handleClose}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button
              color="usfGreen"
              loading={push.isPending}
              disabled={!canPush}
              onClick={() => push.mutate()}
            >
              Push to Ghostwriter
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}
