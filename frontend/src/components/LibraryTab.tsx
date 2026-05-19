import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  Stack,
  Switch,
  TagsInput,
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
  createInjectTemplate,
  deleteInjectTemplate,
  listInjectTemplates,
  updateInjectTemplate,
  type InjectTemplate,
  type InjectTemplateCategory,
} from "../api/client";

const CATEGORY_OPTIONS: { value: InjectTemplateCategory; label: string }[] = [
  { value: "phishing_create", label: "Create phishing email" },
  { value: "phishing_classify", label: "Classify suspicious email" },
  { value: "network_question", label: "Network question" },
  { value: "general_question", label: "General question" },
  { value: "pretext", label: "Pretext" },
  { value: "other", label: "Other" },
];

export function LibraryTab({ eid }: { eid: string }) {
  const qc = useQueryClient();
  const [category, setCategory] = useState<InjectTemplateCategory | "">("");
  const [q, setQ] = useState("");
  const [includeGlobal, setIncludeGlobal] = useState(true);
  const [picked, setPicked] = useState<InjectTemplate | null>(null);
  const [newOpen, newCtl] = useDisclosure(false);

  const list = useQuery({
    queryKey: ["inject-templates", eid, category, q, includeGlobal],
    queryFn: () =>
      listInjectTemplates(eid, {
        category: category || undefined,
        q: q || undefined,
        include_global: includeGlobal,
      }),
  });

  const create = useMutation({
    mutationFn: createInjectTemplateBound(eid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inject-templates", eid] });
      newCtl.close();
      notifications.show({ color: "usfGreen", message: "Template saved." });
    },
    onError: () =>
      notifications.show({ color: "red", message: "Couldn't save." }),
  });

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={4}>Response library</Title>
        <Button
          color="usfGold"
          c="dark.9"
          leftSection={<IconPlus size={16} />}
          onClick={newCtl.open}
        >
          New template
        </Button>
      </Group>

      <Group gap="xs">
        <Select
          placeholder="Category: all"
          data={CATEGORY_OPTIONS}
          value={category || null}
          onChange={(v) => setCategory((v as InjectTemplateCategory) || "")}
          clearable
          w={220}
        />
        <TextInput
          placeholder="Search title / body…"
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          w={260}
        />
        <Switch
          label="Include global"
          checked={includeGlobal}
          onChange={(e) => setIncludeGlobal(e.currentTarget.checked)}
          color="usfGreen"
        />
      </Group>

      <Group align="flex-start" wrap="nowrap" gap="md">
        <Stack gap="xs" style={{ minWidth: 280 }}>
          {list.isLoading ? (
            <Loader />
          ) : (list.data ?? []).length === 0 ? (
            <Text c="dimmed" size="sm">
              No templates. Click "New template" to add one.
            </Text>
          ) : (
            (list.data ?? []).map((t) => (
              <Paper
                key={t.id}
                withBorder
                p="sm"
                radius="sm"
                style={{ cursor: "pointer" }}
                onClick={() => setPicked(t)}
                bg={picked?.id === t.id ? "dark.6" : undefined}
              >
                <Group justify="space-between">
                  <Text size="sm" fw={600}>
                    {t.title}
                  </Text>
                  <Badge size="xs" color={t.engagement_id ? "usfGreen" : "usfGold"} variant="light">
                    {t.engagement_id ? "engagement" : "global"}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  {t.category.replace("_", " ")}
                </Text>
                {t.tags.length > 0 && (
                  <Group gap={4} mt={4}>
                    {t.tags.map((tg) => (
                      <Badge key={tg} size="xs" variant="outline">
                        {tg}
                      </Badge>
                    ))}
                  </Group>
                )}
              </Paper>
            ))
          )}
        </Stack>

        <Box style={{ flex: 1 }}>
          {picked ? (
            <TemplateEditor
              eid={eid}
              template={picked}
              onDelete={() => setPicked(null)}
            />
          ) : (
            <Paper withBorder p="md" radius="sm">
              <Text c="dimmed" size="sm">
                Pick a template on the left to preview / edit, or create a new
                one.
              </Text>
            </Paper>
          )}
        </Box>
      </Group>

      <NewTemplateModal
        opened={newOpen}
        onClose={newCtl.close}
        loading={create.isPending}
        onSubmit={(body) => create.mutate(body)}
      />
    </Stack>
  );
}

function createInjectTemplateBound(eid: string) {
  return (body: Parameters<typeof createInjectTemplate>[1]) =>
    createInjectTemplate(eid, body);
}

function TemplateEditor({
  eid,
  template,
  onDelete,
}: {
  eid: string;
  template: InjectTemplate;
  onDelete: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(template.title);
  const [body, setBody] = useState(template.body_md);
  const [tags, setTags] = useState<string[]>(template.tags);
  const [category, setCategory] = useState<InjectTemplateCategory>(
    template.category,
  );

  // Reset local edit state when a different template is selected.
  useEffect(() => {
    setTitle(template.title);
    setBody(template.body_md);
    setTags(template.tags);
    setCategory(template.category);
  }, [template.id, template.title, template.body_md, template.tags, template.category]);

  const save = useMutation({
    mutationFn: () =>
      updateInjectTemplate(eid, template.id, {
        title,
        body_md: body,
        tags,
        category,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inject-templates", eid] });
      notifications.show({ color: "usfGreen", message: "Template saved." });
    },
    onError: () => notifications.show({ color: "red", message: "Save failed." }),
  });

  const del = useMutation({
    mutationFn: () => deleteInjectTemplate(eid, template.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inject-templates", eid] });
      onDelete();
    },
  });

  return (
    <Paper withBorder p="md" radius="sm">
      <Stack gap="sm">
        <Group justify="space-between">
          <Badge color={template.engagement_id ? "usfGreen" : "usfGold"} variant="light">
            {template.engagement_id ? "engagement-scoped" : "global"}
          </Badge>
          <ActionIcon
            color="red"
            variant="subtle"
            loading={del.isPending}
            onClick={() => {
              if (confirm("Delete this template?")) del.mutate();
            }}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
        <Group grow>
          <TextInput
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
          />
          <Select
            label="Category"
            data={CATEGORY_OPTIONS}
            value={category}
            onChange={(v) => v && setCategory(v as InjectTemplateCategory)}
          />
        </Group>
        <TagsInput
          label="Tags"
          value={tags}
          onChange={setTags}
        />
        <Textarea
          label="Body (markdown)"
          autosize
          minRows={8}
          value={body}
          onChange={(e) => setBody(e.currentTarget.value)}
          styles={{ input: { fontFamily: "monospace" } }}
        />
        <Group justify="flex-end">
          <Button onClick={() => save.mutate()} color="usfGreen" loading={save.isPending}>
            Save
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

function NewTemplateModal({
  opened,
  onClose,
  loading,
  onSubmit,
}: {
  opened: boolean;
  onClose: () => void;
  loading: boolean;
  onSubmit: (body: {
    category: InjectTemplateCategory;
    title: string;
    body_md: string;
    tags: string[];
    is_global: boolean;
  }) => void;
}) {
  const [category, setCategory] = useState<InjectTemplateCategory>("general_question");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isGlobal, setIsGlobal] = useState(false);

  return (
    <Modal opened={opened} onClose={onClose} title="New template" size="lg">
      <Stack gap="sm">
        <Group grow>
          <TextInput
            label="Title"
            required
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
          />
          <Select
            label="Category"
            data={CATEGORY_OPTIONS}
            value={category}
            onChange={(v) => v && setCategory(v as InjectTemplateCategory)}
          />
        </Group>
        <TagsInput label="Tags" value={tags} onChange={setTags} />
        <Textarea
          label="Body (markdown)"
          autosize
          minRows={6}
          value={body}
          onChange={(e) => setBody(e.currentTarget.value)}
          styles={{ input: { fontFamily: "monospace" } }}
        />
        <Switch
          label="Save as global (reusable across engagements)"
          checked={isGlobal}
          onChange={(e) => setIsGlobal(e.currentTarget.checked)}
          color="usfGreen"
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="usfGold"
            c="dark.9"
            disabled={!title.trim() || !body.trim()}
            loading={loading}
            onClick={() =>
              onSubmit({
                category,
                title: title.trim(),
                body_md: body.trim(),
                tags,
                is_global: isGlobal,
              })
            }
          >
            Save template
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
