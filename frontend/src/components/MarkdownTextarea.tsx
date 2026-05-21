import {
  ActionIcon,
  Box,
  Group,
  Text,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { IconBold, IconCode, IconBraces } from "@tabler/icons-react";
import { forwardRef, useImperativeHandle, useRef } from "react";

export interface MarkdownHandle {
  /** Insert text at the current cursor position (or at end). */
  insertAtCursor: (text: string) => void;
}

interface Props {
  label?: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  minRows?: number;
  placeholder?: string;
  onFocus?: () => void;
}

export const MarkdownTextarea = forwardRef<MarkdownHandle, Props>(
  ({ label, description, value, onChange, minRows = 4, placeholder, onFocus }, ref) => {
    const taRef = useRef<HTMLTextAreaElement>(null);
    // Saved whenever the textarea blurs so toolbar buttons and external
    // insertions can find the last cursor position even when unfocused.
    const savedSel = useRef({ start: 0, end: 0 });

    const insert = (text: string) => {
      const el = taRef.current;
      if (!el) {
        onChange(value + text);
        return;
      }
      const active = document.activeElement === el;
      const start = active ? el.selectionStart : savedSel.current.start;
      const end   = active ? el.selectionEnd   : savedSel.current.end;
      const next = value.slice(0, start) + text + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        const cursor = start + text.length;
        el.setSelectionRange(cursor, cursor);
      });
    };

    useImperativeHandle(ref, () => ({ insertAtCursor: insert }));

    return (
      <Box>
        {(label || description) && (
          <Box mb={4}>
            {label && (
              <Text size="sm" fw={500} component="label">
                {label}
              </Text>
            )}
            {description && (
              <Text size="xs" c="dimmed">
                {description}
              </Text>
            )}
          </Box>
        )}
        <Group gap={4} mb={4}>
          <Tooltip label="Code block (```)">
            <ActionIcon
              size="xs"
              variant="default"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert("\n```\n\n```")}
            >
              <IconCode size={12} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Inline code">
            <ActionIcon
              size="xs"
              variant="default"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert("`code`")}
            >
              <IconBraces size={12} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Bold">
            <ActionIcon
              size="xs"
              variant="default"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert("**text**")}
            >
              <IconBold size={12} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          minRows={minRows}
          autosize
          placeholder={placeholder}
          onFocus={onFocus}
          onBlur={() => {
            const el = taRef.current;
            if (el) savedSel.current = { start: el.selectionStart, end: el.selectionEnd };
          }}
          styles={{
            input: { fontFamily: "var(--mantine-font-family-monospace)", fontSize: 13 },
          }}
        />
      </Box>
    );
  },
);

MarkdownTextarea.displayName = "MarkdownTextarea";
