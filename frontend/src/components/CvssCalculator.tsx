import { Badge, Group, Select, SimpleGrid, Stack, Text } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";

import {
  CVSS_OPTIONS,
  computeCvss,
  parseVector,
  type CvssState,
  type Metric,
} from "../lib/cvss";
import { SEVERITY_COLOR } from "../theme";

const LABELS: Record<Metric, string> = {
  AV: "Attack Vector",
  AC: "Attack Complexity",
  PR: "Privileges Req.",
  UI: "User Interaction",
  S: "Scope",
  C: "Confidentiality",
  I: "Integrity",
  A: "Availability",
};

/**
 * CVSS v3.1 base-score calculator. Reports {vector, score, severity}
 * upward so the finding editor can auto-set those fields.
 */
export function CvssCalculator({
  vector,
  onChange,
}: {
  vector: string | null;
  onChange: (v: { vector: string; score: number; severity: string }) => void;
}) {
  const [state, setState] = useState<CvssState>(() => parseVector(vector));
  const result = useMemo(() => computeCvss(state), [state]);

  useEffect(() => {
    onChange(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.vector]);

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text fw={600} size="sm">
          CVSS 3.1
        </Text>
        <Group gap="xs">
          <Badge size="lg" color={SEVERITY_COLOR[result.severity]}>
            {result.score.toFixed(1)} · {result.severity}
          </Badge>
        </Group>
      </Group>
      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        {(Object.keys(CVSS_OPTIONS) as Metric[]).map((m) => (
          <Select
            key={m}
            size="xs"
            label={LABELS[m]}
            allowDeselect={false}
            data={CVSS_OPTIONS[m].map((o) => ({
              value: o.value,
              label: o.label,
            }))}
            value={state[m]}
            onChange={(v) => v && setState((s) => ({ ...s, [m]: v }))}
          />
        ))}
      </SimpleGrid>
      <Text size="xs" c="dimmed" ff="monospace">
        {result.vector}
      </Text>
    </Stack>
  );
}
