import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Loader,
  Select,
  Stack,
  TagsInput,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  createTemplate,
  deleteTemplate,
  listTemplates,
  updateTemplate,
  type FindingTemplate,
  type Severity,
} from "../api/client";
import { SEVERITY_COLOR } from "../theme";

const SEVERITIES: Severity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "informational",
];

type Draft = Partial<FindingTemplate> & { name: string };

const EMPTY: Draft = {
  name: "",
  finding_type: "",
  severity_default: "medium",
  cwe: "",
  description_md: "",
  impact_md: "",
  remediation_md: "",
  host_detection_md: "",
  network_detection_md: "",
  references_md: "",
  finding_guidance_md: "",
  tags: [],
};

function Editor({
  initial,
  onClose,
}: {
  initial: Draft;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const editingId = (initial as FindingTemplate).id as string | undefined;
  const [d, setD] = useState<Draft>({ ...EMPTY, ...initial });
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: d.name.trim(),
        finding_type: d.finding_type || null,
        severity_default: d.severity_default ?? "medium",
        cwe: d.cwe || null,
        description_md: d.description_md || null,
        impact_md: d.impact_md || null,
        remediation_md: d.remediation_md || null,
        host_detection_md: d.host_detection_md || null,
        network_detection_md: d.network_detection_md || null,
        references_md: d.references_md || null,
        finding_guidance_md: d.finding_guidance_md || null,
        tags: d.tags ?? [],
      };
      return editingId
        ? updateTemplate(editingId, body)
        : createTemplate(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      notifications.show({ color: "usfGreen", message: "Template saved." });
      onClose();
    },
    onError: () =>
      notifications.show({
        color: "red",
        message: "Save failed (duplicate name?).",
      }),
  });

  return (
    <Drawer
      opened
      onClose={onClose}
      position="right"
      size="xl"
      title={
        <Title order={4}>
          {editingId ? "Edit template" : "New finding template"}
        </Title>
      }
    >
      <Stack>
        <TextInput
          label="Name"
          required
          placeholder="SQL Injection"
          value={d.name}
          onChange={(e) => set({ name: e.currentTarget.value })}
        />
        <Group grow>
          <TextInput
            label="Finding type"
            placeholder="Web, Active Directory…"
            value={d.finding_type ?? ""}
            onChange={(e) => set({ finding_type: e.currentTarget.value })}
          />
          <Select
            label="Default severity"
            data={SEVERITIES}
            allowDeselect={false}
            value={d.severity_default}
            onChange={(v) =>
              set({ severity_default: (v ?? "medium") as Severity })
            }
          />
          <TextInput
            label="CWE"
            value={d.cwe ?? ""}
            onChange={(e) => set({ cwe: e.currentTarget.value })}
          />
        </Group>
        <Textarea
          label="Description"
          description="Pre-write the standard overview here."
          autosize
          minRows={3}
          value={d.description_md ?? ""}
          onChange={(e) => set({ description_md: e.currentTarget.value })}
        />
        <Textarea
          label="Impact"
          autosize
          minRows={2}
          value={d.impact_md ?? ""}
          onChange={(e) => set({ impact_md: e.currentTarget.value })}
        />
        <Textarea
          label="Mitigation / remediation"
          autosize
          minRows={2}
          value={d.remediation_md ?? ""}
          onChange={(e) => set({ remediation_md: e.currentTarget.value })}
        />
        <Textarea
          label="Host detection techniques"
          autosize
          minRows={2}
          value={d.host_detection_md ?? ""}
          onChange={(e) => set({ host_detection_md: e.currentTarget.value })}
        />
        <Textarea
          label="Network detection techniques"
          autosize
          minRows={2}
          value={d.network_detection_md ?? ""}
          onChange={(e) =>
            set({ network_detection_md: e.currentTarget.value })
          }
        />
        <Textarea
          label="References"
          autosize
          minRows={2}
          value={d.references_md ?? ""}
          onChange={(e) => set({ references_md: e.currentTarget.value })}
        />
        <Textarea
          label="Guidance (internal — not exported into reports)"
          description="When/how to use this template, what evidence to grab."
          autosize
          minRows={2}
          value={d.finding_guidance_md ?? ""}
          onChange={(e) =>
            set({ finding_guidance_md: e.currentTarget.value })
          }
        />
        <TagsInput
          label="Tags"
          value={d.tags ?? []}
          onChange={(v) => set({ tags: v })}
        />
        <Button
          color="usfGreen"
          disabled={!d.name.trim()}
          loading={save.isPending}
          onClick={() => save.mutate()}
        >
          Save template
        </Button>
      </Stack>
    </Drawer>
  );
}

export function FindingTemplatesManager() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["templates"], queryFn: () => listTemplates() });
  const [editing, setEditing] = useState<Draft | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });

  return (
    <Card withBorder padding="md">
      <Group justify="space-between" mb="sm">
        <div>
          <Title order={4}>Finding templates</Title>
          <Text size="sm" c="dimmed">
            Reusable boilerplate — pre-write findings (SQLi overview, etc.)
            before an engagement. Shared across all engagements.
          </Text>
        </div>
        <Button
          color="usfGold"
          c="dark.9"
          leftSection={<IconPlus size={16} />}
          onClick={() => setEditing({ ...EMPTY })}
        >
          New template
        </Button>
      </Group>

      {q.isLoading && <Loader />}
      {q.data?.length === 0 && (
        <Text c="dimmed" size="sm">
          No templates yet.
        </Text>
      )}
      <Stack gap="xs">
        {q.data?.map((t) => (
          <Group key={t.id} justify="space-between" wrap="nowrap">
            <Group
              gap="xs"
              style={{ cursor: "pointer", flex: 1 }}
              onClick={() => setEditing(t)}
            >
              <Text fw={600}>{t.name}</Text>
              <Badge size="xs" color={SEVERITY_COLOR[t.severity_default]}>
                {t.severity_default}
              </Badge>
              {t.finding_type && (
                <Badge size="xs" variant="outline" color="gray">
                  {t.finding_type}
                </Badge>
              )}
            </Group>
            <ActionIcon
              color="red"
              variant="subtle"
              onClick={() => del.mutate(t.id)}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        ))}
      </Stack>

      {editing && (
        <Editor initial={editing} onClose={() => setEditing(null)} />
      )}
    </Card>
  );
}
