import { Box, Group, Text, UnstyledButton, useMantineTheme } from "@mantine/core";

export type Phase = "pre" | "engagement" | "post";

const PHASES: { value: Phase; label: string; num: string }[] = [
  { value: "pre", label: "Pre-Engagement", num: "1" },
  { value: "engagement", label: "Engagement", num: "2" },
  { value: "post", label: "Post-Engagement", num: "3" },
];

export function PhaseBar({
  phase,
  onChange,
}: {
  phase: Phase;
  onChange: (p: Phase) => void;
}) {
  const theme = useMantineTheme();
  const activeIdx = PHASES.findIndex((p) => p.value === phase);

  return (
    <Group gap={0} align="center">
      {PHASES.map((p, idx) => {
        const isActive = p.value === phase;
        const isPast = idx < activeIdx;
        const isLast = idx === PHASES.length - 1;

        const circleColor = isActive
          ? theme.colors.usfGreen[6]
          : isPast
          ? theme.colors.usfGreen[8]
          : "var(--mantine-color-dark-4)";

        const textColor = isActive
          ? "var(--mantine-color-white)"
          : isPast
          ? theme.colors.usfGreen[4]
          : "var(--mantine-color-dimmed)";

        const lineColor = isPast
          ? theme.colors.usfGreen[7]
          : "var(--mantine-color-dark-4)";

        return (
          <Group key={p.value} gap={0} align="center">
            <UnstyledButton onClick={() => onChange(p.value)}>
              <Group gap={8} align="center" px={4} py={6}>
                <Box
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    backgroundColor: circleColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "background-color 150ms ease",
                  }}
                >
                  <Text size="xs" fw={700} c="white" lh={1}>
                    {p.num}
                  </Text>
                </Box>
                <Text
                  size="sm"
                  fw={isActive ? 700 : 500}
                  style={{
                    color: textColor,
                    transition: "color 150ms ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.label}
                </Text>
              </Group>
            </UnstyledButton>

            {!isLast && (
              <Box
                style={{
                  height: 2,
                  width: 48,
                  backgroundColor: lineColor,
                  transition: "background-color 150ms ease",
                  flexShrink: 0,
                }}
              />
            )}
          </Group>
        );
      })}
    </Group>
  );
}
