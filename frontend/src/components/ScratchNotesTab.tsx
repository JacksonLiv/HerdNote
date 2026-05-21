import {
  ActionIcon,
  Button,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import {
  createScratchNote,
  deleteScratchNote,
  listScratchNotes,
  updateScratchNote,
  type ScratchNote,
} from "../api/client";

export function ScratchNotesTab({ eid, wsId }: { eid: string; wsId: string }) {
  const qc = useQueryClient();
  const qk = ["scratch-notes", eid, wsId];

  const q = useQuery({ queryKey: qk, queryFn: () => listScratchNotes(eid, wsId) });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const notes = q.data ?? [];
  const selected = notes.find((n) => n.id === selectedId) ?? notes[0] ?? null;

  useEffect(() => {
    if (!selectedId && notes.length > 0) setSelectedId(notes[0].id);
  }, [notes, selectedId]);

  const invalidate = () => qc.invalidateQueries({ queryKey: qk });

  const addNote = useMutation({
    mutationFn: () => createScratchNote(eid, wsId, { title: "New note" }),
    onSuccess: (note) => {
      invalidate();
      setSelectedId(note.id);
    },
  });

  const delNote = useMutation({
    mutationFn: (id: string) => deleteScratchNote(eid, wsId, id),
    onSuccess: (_, id) => {
      invalidate();
      if (selectedId === id) setSelectedId(null);
    },
  });

  if (q.isLoading) return <Loader />;

  return (
    <Group align="flex-start" gap="md" style={{ height: "100%" }}>
      {/* Sidebar: note list */}
      <Stack gap="xs" style={{ width: 220, flexShrink: 0 }}>
        <Button
          size="xs"
          variant="light"
          color="usfGold"
          leftSection={<IconPlus size={14} />}
          loading={addNote.isPending}
          onClick={() => addNote.mutate()}
        >
          New note
        </Button>
        {notes.length === 0 && (
          <Text size="xs" c="dimmed">No notes yet.</Text>
        )}
        {notes.map((n) => (
          <Paper
            key={n.id}
            withBorder
            p="xs"
            style={{
              cursor: "pointer",
              background: n.id === (selected?.id ?? "") ? "var(--mantine-color-dark-5)" : undefined,
            }}
            onClick={() => setSelectedId(n.id)}
          >
            <Group justify="space-between" wrap="nowrap" gap={4}>
              <Text size="sm" fw={500} lineClamp={1} style={{ flex: 1 }}>
                {n.title}
              </Text>
              <ActionIcon
                size="xs"
                color="red"
                variant="subtle"
                onClick={(e) => { e.stopPropagation(); delNote.mutate(n.id); }}
              >
                <IconTrash size={12} />
              </ActionIcon>
            </Group>
            <Text size="xs" c="dimmed">
              {new Date(n.updated_at).toLocaleDateString()}
            </Text>
          </Paper>
        ))}
      </Stack>

      {/* Editor */}
      {selected ? (
        <NoteEditor key={selected.id} eid={eid} wsId={wsId} note={selected} onSaved={invalidate} />
      ) : (
        <Text c="dimmed" size="sm" mt="xl">
          Select a note or create one.
        </Text>
      )}
    </Group>
  );
}

function NoteEditor({
  eid,
  wsId,
  note,
  onSaved,
}: {
  eid: string;
  wsId: string;
  note: ScratchNote;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body ?? "");

  const save = useMutation({
    mutationFn: (patch: { title?: string; body?: string | null }) =>
      updateScratchNote(eid, wsId, note.id, patch),
    onSuccess: onSaved,
    onError: () => notifications.show({ color: "red", message: "Save failed." }),
  });

  return (
    <Stack style={{ flex: 1 }} gap="sm">
      <TextInput
        value={title}
        onChange={(e) => setTitle(e.currentTarget.value)}
        onBlur={() => { if (title !== note.title) save.mutate({ title }); }}
        placeholder="Note title"
        fw={600}
        size="sm"
        variant="unstyled"
        styles={{ input: { fontSize: 18, fontWeight: 600 } }}
      />
      <Textarea
        value={body}
        onChange={(e) => setBody(e.currentTarget.value)}
        onBlur={() => { if (body !== (note.body ?? "")) save.mutate({ body }); }}
        placeholder="Paste anything here — commands, output, IPs, hashes, observations..."
        autosize
        minRows={12}
        ff="monospace"
        size="sm"
      />
      <Text size="xs" c="dimmed">
        Autosaves on blur · {new Date(note.updated_at).toLocaleString()}
      </Text>
    </Stack>
  );
}
