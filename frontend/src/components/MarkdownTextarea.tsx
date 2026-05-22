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
    // Always tracks the latest cursor position. Updated on every selection
    // change so insert() never has to guess the position.
    const savedSel = useRef({ start: 0, end: 0 });

    const saveSel = () => {
      const el = taRef.current;
      if (el) savedSel.current = { start: el.selectionStart, end: el.selectionEnd };
    };

    const insert = (text: string) => {
      const el = taRef.current;
      if (!el) { onChange(value + text); return; }

      // Use the saved cursor — it's kept current by onSelect/onKeyUp/onMouseUp.
      const { start, end } = savedSel.current;
      const next = value.slice(0, start) + text + value.slice(end);
      onChange(next);

      // Restore cursor after React re-renders the controlled textarea.
      const cursor = start + text.length;
      savedSel.current = { start: cursor, end: cursor };
      requestAnimationFrame(() => {
        el.focus();
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
          onFocus={() => {
            saveSel();
            onFocus?.();
          }}
          onSelect={saveSel}
          onKeyUp={saveSel}
          onMouseUp={saveSel}
          styles={{
            input: { fontFamily: "var(--mantine-font-family-monospace)", fontSize: 13 },
          }}
        />
      </Box>
    );
  },
);

MarkdownTextarea.displayName = "MarkdownTextarea";
