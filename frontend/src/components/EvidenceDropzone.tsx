import { ActionIcon, Group, Image, Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import { Dropzone, type FileWithPath } from "@mantine/dropzone";
import { notifications } from "@mantine/notifications";
import { IconPhoto, IconTrash, IconUpload } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import {
  deleteEvidence,
  listEvidence,
  uploadEvidence,
  type EvidenceParent,
} from "../api/client";

interface Props {
  eid: string;
  parentType: EvidenceParent;
  parentId: string;
}

/**
 * Frictionless evidence: drag-drop OR Ctrl/Cmd-V a screenshot anywhere
 * while open → auto-attached to this parent entity, thumbnailed at once.
 */
export function EvidenceDropzone({ eid, parentType, parentId }: Props) {
  const qc = useQueryClient();
  const key = ["evidence", eid, parentType, parentId];

  const q = useQuery({
    queryKey: key,
    queryFn: () => listEvidence(eid, parentType, parentId),
  });

  const upload = useMutation({
    mutationFn: (file: File) =>
      uploadEvidence(eid, parentType, parentId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      notifications.show({ color: "usfGreen", message: "Evidence attached." });
    },
    onError: () =>
      notifications.show({ color: "red", message: "Upload failed." }),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteEvidence(eid, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  // Clipboard-paste capture while this panel is mounted.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of items) {
        if (it.kind === "file") {
          const f = it.getAsFile();
          if (f) {
            e.preventDefault();
            upload.mutate(f);
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [upload]);

  const isImage = (ct: string) => ct.startsWith("image/");

  return (
    <Stack gap="sm">
      <Dropzone
        onDrop={(files: FileWithPath[]) => files.forEach((f) => upload.mutate(f))}
        loading={upload.isPending}
        radius="md"
        py="lg"
      >
        <Group justify="center" gap="sm" style={{ pointerEvents: "none" }}>
          <Dropzone.Accept>
            <IconUpload size={28} />
          </Dropzone.Accept>
          <Dropzone.Idle>
            <IconPhoto size={28} />
          </Dropzone.Idle>
          <Text size="sm" c="dimmed">
            Drop files here, or press Ctrl/Cmd-V to paste a screenshot.
          </Text>
        </Group>
      </Dropzone>

      {q.data && q.data.length > 0 && (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }}>
          {q.data.map((ev) => (
            <Paper key={ev.id} withBorder p={4} pos="relative">
              {isImage(ev.content_type) ? (
                <Image src={ev.url} h={110} fit="cover" radius="sm" alt={ev.filename} />
              ) : (
                <Group h={110} justify="center">
                  <IconPhoto size={32} />
                </Group>
              )}
              <Text size="xs" truncate mt={4}>
                {ev.filename}
              </Text>
              <ActionIcon
                color="red"
                variant="filled"
                size="sm"
                pos="absolute"
                top={6}
                right={6}
                onClick={() => del.mutate(ev.id)}
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Paper>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
