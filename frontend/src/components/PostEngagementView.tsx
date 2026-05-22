import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Collapse,
  Divider,
  FileButton,
  Group,
  Loader,
  Modal,
  NavLink,
  ScrollArea,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconArrowDown,
  IconArrowUp,
  IconChevronDown,
  IconChevronUp,
  IconCloudUpload,
  IconDownload,
  IconFileText,
  IconInfoCircle,
  IconList,
  IconNotes,
  IconPaperclip,
  IconPencil,
  IconPlus,
  IconSettings,
  IconSortDescending,
  IconStar,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  generateReport,
  getReport,
  listFindings,
  listClients,
  updateReport,
  uploadReportTemplate,
  useDefaultReportTemplate,
  type AppendixItem,
  type Engagement,
  type EngagementReport,
  type Finding,
} from "../api/client";
import { GhostwriterExportModal } from "./GhostwriterExportModal";
import { SEVERITY_COLOR } from "../theme";

type Section =
  | "template"
  | "admin"
  | "summary"
  | "recommendations"
  | "findings"
  | "appendixes"
  | "generate";

const NAV_ITEMS: { value: Section; label: string; icon: React.ReactNode }[] = [
  { value: "template", label: "Template", icon: <IconFileText size={16} /> },
  { value: "admin", label: "Admin Data", icon: <IconInfoCircle size={16} /> },
  { value: "summary", label: "Executive Summary", icon: <IconNotes size={16} /> },
  { value: "recommendations", label: "Recommendations", icon: <IconStar size={16} /> },
  { value: "findings", label: "Technical Findings", icon: <IconList size={16} /> },
  { value: "appendixes", label: "Appendixes", icon: <IconPaperclip size={16} /> },
  { value: "generate", label: "Generate Report", icon: <IconDownload size={16} /> },
];

const DEFAULT_APPENDIXES: AppendixItem[] = [
  { type: "host_inventory", title: "Host Inventory", included: false },
  { type: "creds", title: "Compromised Credentials", included: false },
  { type: "artifacts", title: "Tools & Artifacts Used", included: false },
  { type: "methodology", title: "Methodology & Scope", included: false },
  { type: "attack_paths", title: "Attack Paths & Narrative", included: false },
  { type: "evidence", title: "Evidence Manifest", included: false },
  { type: "oplog", title: "Operations Timeline (Oplog)", included: false },
];

export function PostEngagementView({
  engagement,
  onJsonDownload,
}: {
  engagement: Engagement;
  onJsonDownload: () => void;
}) {
  const [section, setSection] = useState<Section>("summary");
  const qc = useQueryClient();

  const reportQ = useQuery({
    queryKey: ["report", engagement.id],
    queryFn: () => getReport(engagement.id),
  });

  const save = useMutation({
    mutationFn: (body: Parameters<typeof updateReport>[1]) =>
      updateReport(engagement.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["report", engagement.id] });
      notifications.show({ color: "usfGreen", message: "Saved." });
    },
    onError: () => notifications.show({ color: "red", message: "Save failed." }),
  });

  if (reportQ.isLoading) return <Loader />;
  const report = reportQ.data;

  const appendixConfig: AppendixItem[] =
    report?.appendix_config && report.appendix_config.length > 0
      ? (report.appendix_config as AppendixItem[])
      : DEFAULT_APPENDIXES;

  return (
    <Group align="flex-start" gap="lg" wrap="nowrap">
      {/* Left nav */}
      <Box w={220} style={{ flexShrink: 0 }}>
        <Card withBorder padding="xs">
          <Stack gap={2}>
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.value}
                label={item.label}
                leftSection={item.icon}
                active={section === item.value}
                color="usfGreen"
                onClick={() => setSection(item.value)}
              />
            ))}
          </Stack>
        </Card>
      </Box>

      {/* Main content */}
      <Box style={{ flex: 1, minWidth: 0 }}>
        {section === "template" && (
          <TemplateSection
            engagement={engagement}
            report={report ?? null}
            onSaved={() => qc.invalidateQueries({ queryKey: ["report", engagement.id] })}
          />
        )}

        {section === "admin" && (
          <AdminDataSection engagement={engagement} />
        )}

        {section === "summary" && (
          <MarkdownSection
            title="Executive Summary"
            description="Written for non-technical stakeholders. Lead with business risk, not technical detail. Aim for 200–400 words. Inserted directly into the report as {{ exec_summary }}."
            value={report?.exec_summary_md ?? ""}
            onSave={(v) => save.mutate({ exec_summary_md: v })}
            saving={save.isPending}
            placeholder={EXEC_SUMMARY_PLACEHOLDER}
          />
        )}

        {section === "recommendations" && (
          <MarkdownSection
            title="High-Level Recommendations"
            description="Strategic, prioritised recommendations based on findings. Frame in business terms. Inserted into the report as {{ recommendations }}."
            value={report?.recommendations_md ?? ""}
            onSave={(v) => save.mutate({ recommendations_md: v })}
            saving={save.isPending}
            placeholder={RECOMMENDATIONS_PLACEHOLDER}
          />
        )}

        {section === "findings" && (
          <FindingsSection
            engagement={engagement}
            selectedIds={report?.selected_finding_ids ?? []}
            onSave={(ids) => save.mutate({ selected_finding_ids: ids })}
            saving={save.isPending}
          />
        )}

        {section === "appendixes" && (
          <AppendixesSection
            config={appendixConfig}
            onSave={(cfg) => save.mutate({ appendix_config: cfg })}
            saving={save.isPending}
          />
        )}

        {section === "generate" && (
          <GenerateSection
            engagement={engagement}
            report={report ?? null}
            onJsonDownload={onJsonDownload}
          />
        )}
      </Box>
    </Group>
  );
}

// ─── Template Section ─────────────────────────────────────────────────────────

function TemplateSection({
  engagement,
  report,
  onSaved,
}: {
  engagement: Engagement;
  report: { template_file_path: string | null } | null;
  onSaved: () => void;
}) {
  const upload = useMutation({
    mutationFn: (file: File) => uploadReportTemplate(engagement.id, file),
    onSuccess: () => {
      onSaved();
      notifications.show({ color: "usfGreen", message: "Template uploaded." });
    },
    onError: () => notifications.show({ color: "red", message: "Upload failed." }),
  });

  const loadDefault = useMutation({
    mutationFn: () => useDefaultReportTemplate(engagement.id),
    onSuccess: () => {
      onSaved();
      notifications.show({ color: "usfGreen", message: "Default template loaded." });
    },
    onError: () => notifications.show({ color: "red", message: "Failed to load default template." }),
  });

  const templateName = report?.template_file_path
    ? report.template_file_path.split("/").pop()
    : null;

  return (
    <Card withBorder padding="lg">
      <Title order={4} mb="xs">
        Report Template
      </Title>
      <Text size="sm" c="dimmed" mb="lg">
        Upload a <code>.docx</code> file with{" "}
        <Text span c="usfGreen.4" ff="monospace" size="sm">
          {"{{ placeholder }}"}
        </Text>{" "}
        tags. The app will fill them in when generating the report. Or load the built-in
        default template to get started immediately.
      </Text>

      {templateName && (
        <Group mb="md" gap="xs">
          <IconFileText size={16} />
          <Text size="sm" fw={500}>
            {templateName}
          </Text>
          <Badge color="usfGreen" variant="light" size="sm">
            uploaded
          </Badge>
        </Group>
      )}

      <Group gap="sm">
        <FileButton
          onChange={(file) => file && upload.mutate(file)}
          accept=".docx"
        >
          {(props) => (
            <Button
              {...props}
              variant={templateName ? "default" : "filled"}
              color="usfGreen"
              leftSection={<IconCloudUpload size={16} />}
              loading={upload.isPending}
            >
              {templateName ? "Replace Template" : "Upload Template (.docx)"}
            </Button>
          )}
        </FileButton>
        <Button
          variant="default"
          leftSection={<IconFileText size={16} />}
          loading={loadDefault.isPending}
          onClick={() => loadDefault.mutate()}
        >
          Use Default Template
        </Button>
      </Group>

      <Divider my="lg" />
      <Title order={5} mb="xs">
        Available Placeholders
      </Title>
      <PlaceholderTable />
    </Card>
  );
}

type PlaceholderGroup = {
  heading: string;
  rows: [string, string][];
};

function PlaceholderTable() {
  const groups: PlaceholderGroup[] = [
    {
      heading: "Client & Engagement",
      rows: [
        ["{{ client_name }}", "Full client organisation name"],
        ["{{ client_short_name }}", "Client short name (falls back to client_name)"],
        ["{{ engagement_name }}", "Name of the engagement"],
        ["{{ engagement_type }}", "e.g. pentest, redteam, phishing"],
        ["{{ engagement_status }}", "planning | active | reporting | closed"],
        ["{{ start_date }}", "Formatted start date — e.g. May 1, 2026"],
        ["{{ end_date }}", "Formatted end date — e.g. May 14, 2026"],
        ["{{ report_date }}", "Date the report was generated — e.g. May 21, 2026"],
      ],
    },
    {
      heading: "Narrative Sections",
      rows: [
        ["{{ scope }}", "Scope text (from Pre-Engagement)"],
        ["{{ roe }}", "Rules of engagement text"],
        ["{{ exec_summary }}", "Executive summary narrative"],
        ["{{ recommendations }}", "High-level strategic recommendations"],
      ],
    },
    {
      heading: "Finding Statistics",
      rows: [
        ["{{ finding_count }}", "Total number of findings included in the report"],
        ["{{ severity_counts.critical }}", "Count of Critical findings"],
        ["{{ severity_counts.high }}", "Count of High findings"],
        ["{{ severity_counts.medium }}", "Count of Medium findings"],
        ["{{ severity_counts.low }}", "Count of Low findings"],
        ["{{ severity_counts.informational }}", "Count of Informational findings"],
      ],
    },
    {
      heading: "Loops",
      rows: [
        ["{% for m in team %}…{% endfor %}", "Iterate team members — fields: m.name, m.username, m.role"],
        ["{% for c in contacts %}…{% endfor %}", "Iterate client contacts — fields: c.name, c.role, c.email, c.phone"],
        ["{% for f in findings %}…{% endfor %}", "Iterate findings — see Finding Fields below"],
        ["{% for a in appendixes %}…{% endfor %}", "Iterate appendixes — fields: a.title, a.content"],
        ["{{ loop.index }}", "1-based loop counter (use inside any for loop)"],
        ["{% if not loop.last %}, {% endif %}", "Conditional — only when not the last item in a loop"],
      ],
    },
    {
      heading: "Finding Fields (inside {% for f in findings %} loop)",
      rows: [
        ["{{ f.title }}", "Finding title"],
        ["{{ f.severity }}", "Manually-set severity: critical | high | medium | low | informational"],
        ["{{ f.severity | upper }}", "Severity in all-caps"],
        ["{{ f.cvss_score }}", "CVSS base score as formatted string, e.g. '7.8'"],
        ["{{ f.cvss_vector }}", "Full CVSS v3.1 vector string"],
        ["{{ f.cvss_severity }}", "Severity derived from CVSS score (may differ from manually-set severity)"],
        ["{{ f.cwe }}", "CWE identifier, e.g. CWE-79"],
        ["{{ f.cve }}", "CVE identifier, e.g. CVE-2021-44228"],
        ["{{ f.status }}", "Writing status: not_done | draft | done"],
        ["{{ f.tags_str }}", "Comma-separated tag list, e.g. 'web, injection, owasp-a03'"],
        ["{{ f.tags }}", "Tags as a list (use with {% for t in f.tags %})"],
        ["{{ f.description }}", "Technical description of the vulnerability"],
        ["{{ f.impact }}", "Business and technical impact"],
        ["{{ f.reproduction }}", "Steps to reproduce / proof of concept"],
        ["{{ f.remediation }}", "Remediation guidance"],
        ["{{ f.host_detection }}", "Host-based detection guidance"],
        ["{{ f.network_detection }}", "Network-based detection guidance"],
        ["{{ f.references }}", "CVEs, advisories, research links"],
        ["{{ f.affected_assets_str }}", "Comma-joined affected asset identifiers"],
        ["{{ f.affected_assets }}", "Affected assets as a list (use with {% for a in f.affected_assets %})"],
      ],
    },
  ];

  return (
    <Stack gap="md">
      {groups.map((group) => (
        <Box key={group.heading}>
          <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={4} style={{ letterSpacing: "0.05em" }}>
            {group.heading}
          </Text>
          <ScrollArea>
            <Table withColumnBorders fz="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: "42%" }}>Placeholder</Table.Th>
                  <Table.Th>Description</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {group.rows.map(([ph, desc]) => (
                  <Table.Tr key={ph}>
                    <Table.Td>
                      <Text ff="monospace" size="xs" c="usfGreen.4" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                        {ph}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{desc}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Box>
      ))}
    </Stack>
  );
}

// ─── Admin Data Section ───────────────────────────────────────────────────────

function AdminDataSection({ engagement }: { engagement: Engagement }) {
  const clientQ = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const client = clientQ.data?.find((c) => c.id === engagement.client_id) ?? null;

  return (
    <Card withBorder padding="lg">
      <Title order={4} mb="xs">
        Admin Data (Auto-Filled)
      </Title>
      <Text size="sm" c="dimmed" mb="lg">
        This data is pulled automatically from Pre-Engagement and inserted into the report. Edit it
        in the Pre-Engagement phase.
      </Text>
      <Stack gap="xs">
        <DataRow label="Client Name" value={engagement.client ?? "—"} />
        <DataRow label="Short Name" value={client?.short_name ?? "—"} />
        <DataRow label="Engagement Name" value={engagement.name} />
        <DataRow label="Type" value={engagement.type} />
        <DataRow label="Status" value={engagement.status} />
        <DataRow label="Start Date" value={engagement.start_date ?? "—"} />
        <DataRow label="End Date" value={engagement.end_date ?? "—"} />
        <DataRow
          label="Scope"
          value={
            engagement.scope_md
              ? `${engagement.scope_md.slice(0, 80)}${engagement.scope_md.length > 80 ? "…" : ""}`
              : "—"
          }
        />
        <DataRow
          label="Rules of Engagement"
          value={
            engagement.roe_md
              ? `${engagement.roe_md.slice(0, 80)}${engagement.roe_md.length > 80 ? "…" : ""}`
              : "—"
          }
        />
        <Divider my="xs" label="Contacts" labelPosition="left" />
        {client?.contacts.length ? (
          client.contacts.map((c) => (
            <DataRow
              key={c.id}
              label={c.role ?? "Contact"}
              value={`${c.name}${c.email ? ` — ${c.email}` : ""}${c.phone ? ` — ${c.phone}` : ""}`}
            />
          ))
        ) : (
          <Text size="sm" c="dimmed">
            No contacts. Add them in Pre-Engagement.
          </Text>
        )}
        <Divider my="xs" label="Team" labelPosition="left" />
        {engagement.members.map((m) => (
          <DataRow
            key={m.user.id}
            label={m.role}
            value={m.user.display_name}
          />
        ))}
      </Stack>
    </Card>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <Group gap="sm" align="flex-start">
      <Text size="sm" fw={600} w={160} style={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Text size="sm" c="dimmed" style={{ flex: 1 }}>
        {value}
      </Text>
    </Group>
  );
}

// ─── Markdown Sections ────────────────────────────────────────────────────────

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

const EXEC_SUMMARY_PLACEHOLDER = `[Opening sentence: state the engagement type, target, and testing window.]

During the period of [START DATE] to [END DATE], [YOUR COMPANY] conducted a [ENGAGEMENT TYPE] assessment of [CLIENT NAME]'s [SYSTEMS/APPLICATIONS]. The assessment identified [N] findings across [N] severity levels, including [N Critical / N High / N Medium / N Low].

[Risk posture paragraph: summarise the overall security posture in 2–3 sentences. Lead with business risk.]

[Critical/High summary: briefly describe the highest-severity issues in plain language — no jargon.]

[Forward-looking close: end with a positive, actionable statement about remediation priorities and the client's path to improved security.]`;

const RECOMMENDATIONS_PLACEHOLDER = `[List your top strategic recommendations, ordered by priority and business impact.]

1. **[CRITICAL] Address [issue]** — [1-2 sentences on what to do and why it matters now.]
2. **[HIGH] Harden [component]** — [Brief description of the improvement.]
3. **[MEDIUM] Implement [control]** — [Description.]
4. **Establish recurring assessment cadence** — Schedule quarterly vulnerability scans and annual penetration tests to maintain visibility into the evolving attack surface.`;

function MarkdownSection({
  title,
  description,
  value,
  onSave,
  saving,
  placeholder,
}: {
  title: string;
  description: string;
  value: string;
  onSave: (v: string) => void;
  saving: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  const dirty = draft !== value;
  const words = wordCount(draft);

  return (
    <Card withBorder padding="lg">
      <Group justify="space-between" mb="xs" align="flex-start">
        <Title order={4}>{title}</Title>
        <Text size="xs" c={words === 0 ? "red" : words < 50 ? "yellow" : "dimmed"}>
          {words} {words === 1 ? "word" : "words"}
        </Text>
      </Group>
      <Text size="sm" c="dimmed" mb="md">
        {description}
      </Text>
      <Textarea
        minRows={12}
        autosize
        value={draft}
        onChange={(e) => setDraft(e.currentTarget.value)}
        placeholder={placeholder ?? "Write in markdown…"}
        styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)" } }}
      />
      <Group justify="flex-end" mt="md">
        <Button
          color="usfGreen"
          disabled={!dirty}
          loading={saving}
          onClick={() => onSave(draft)}
        >
          Save
        </Button>
      </Group>
    </Card>
  );
}

// ─── Findings Section ─────────────────────────────────────────────────────────

function FindingsSection({
  engagement,
  selectedIds,
  onSave,
  saving,
}: {
  engagement: Engagement;
  selectedIds: string[];
  onSave: (ids: string[]) => void;
  saving: boolean;
}) {
  const findingsQ = useQuery({
    queryKey: ["findings", engagement.id],
    queryFn: () => listFindings(engagement.id),
  });

  const [localIds, setLocalIds] = useState<string[]>(selectedIds);
  const [autoSorted, setAutoSorted] = useState(selectedIds.length > 0);

  const findings = findingsQ.data ?? [];

  // Auto-populate all findings sorted by CVSS desc on first load if none saved yet.
  useEffect(() => {
    if (autoSorted || findingsQ.isLoading || findings.length === 0) return;
    if (selectedIds.length === 0) {
      const sorted = [...findings]
        .sort((a, b) => (b.cvss_score ?? 0) - (a.cvss_score ?? 0))
        .map((f) => f.id);
      setLocalIds(sorted);
    }
    setAutoSorted(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findingsQ.isLoading, findings.length]);

  const toggle = (id: string) => {
    setLocalIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const move = (id: string, dir: -1 | 1) => {
    setLocalIds((prev) => {
      const idx = prev.indexOf(id);
      if (idx === -1) return prev;
      const next = [...prev];
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  };

  const sortByCvss = () => {
    setLocalIds((prev) => {
      const selected = prev
        .map((id) => findings.find((f) => f.id === id))
        .filter(Boolean) as Finding[];
      return selected
        .sort((a, b) => (b.cvss_score ?? 0) - (a.cvss_score ?? 0))
        .map((f) => f.id);
    });
  };

  const dirty = JSON.stringify(localIds) !== JSON.stringify(selectedIds);

  const selectedFindings = localIds
    .map((id) => findings.find((f) => f.id === id))
    .filter(Boolean) as Finding[];

  const unselectedFindings = findings.filter((f) => !localIds.includes(f.id));

  return (
    <Card withBorder padding="lg">
      <Group justify="space-between" mb="xs">
        <Title order={4}>Technical Findings</Title>
        <Button
          variant="default"
          size="xs"
          leftSection={<IconSortDescending size={14} />}
          onClick={sortByCvss}
          disabled={selectedFindings.length === 0}
        >
          Sort by CVSS
        </Button>
      </Group>
      <Text size="sm" c="dimmed" mb="md">
        Select which findings to include and reorder them. Sorted by CVSS score by default.
      </Text>

      {findings.length === 0 && findingsQ.isLoading && <Loader size="sm" />}
      {findings.length === 0 && !findingsQ.isLoading && (
        <Text size="sm" c="dimmed">
          No findings recorded for this engagement yet.
        </Text>
      )}

      {selectedFindings.length > 0 && (
        <>
          <Text size="xs" fw={600} c="usfGreen.4" mb="xs">
            INCLUDED ({selectedFindings.length})
          </Text>
          <Stack gap="xs" mb="md">
            {selectedFindings.map((f, idx) => (
              <FindingRow
                key={f.id}
                finding={f}
                engagementId={engagement.id}
                included
                canMoveUp={idx > 0}
                canMoveDown={idx < selectedFindings.length - 1}
                onToggle={() => toggle(f.id)}
                onMoveUp={() => move(f.id, -1)}
                onMoveDown={() => move(f.id, 1)}
              />
            ))}
          </Stack>
        </>
      )}

      {unselectedFindings.length > 0 && (
        <>
          <Text size="xs" fw={600} c="dimmed" mb="xs">
            NOT INCLUDED ({unselectedFindings.length})
          </Text>
          <Stack gap="xs">
            {unselectedFindings.map((f) => (
              <FindingRow
                key={f.id}
                finding={f}
                engagementId={engagement.id}
                included={false}
                canMoveUp={false}
                canMoveDown={false}
                onToggle={() => toggle(f.id)}
                onMoveUp={() => {}}
                onMoveDown={() => {}}
              />
            ))}
          </Stack>
        </>
      )}

      <Group justify="flex-end" mt="md">
        <Button
          color="usfGreen"
          disabled={!dirty}
          loading={saving}
          onClick={() => onSave(localIds)}
        >
          Save Selection
        </Button>
      </Group>
    </Card>
  );
}

function FindingRow({
  finding,
  engagementId,
  included,
  canMoveUp,
  canMoveDown,
  onToggle,
  onMoveUp,
  onMoveDown,
}: {
  finding: Finding;
  engagementId: string;
  included: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const navigate = useNavigate();

  return (
    <Group
      gap="sm"
      p="xs"
      style={{
        border: "1px solid var(--mantine-color-dark-4)",
        borderRadius: "var(--mantine-radius-sm)",
        opacity: included ? 1 : 0.6,
      }}
    >
      <Checkbox checked={included} onChange={onToggle} color="usfGreen" />
      <Badge
        color={SEVERITY_COLOR[finding.severity] ?? "gray"}
        variant="light"
        size="sm"
        style={{ flexShrink: 0 }}
      >
        {finding.severity}
      </Badge>
      {finding.cvss_score != null && (
        <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
          {finding.cvss_score.toFixed(1)}
        </Text>
      )}
      <Text size="sm" style={{ flex: 1 }}>
        {finding.title}
      </Text>
      <Group gap={2}>
        <ActionIcon
          size="sm"
          variant="subtle"
          title="Edit finding"
          onClick={() => navigate(`/engagements/${engagementId}/findings/${finding.id}`)}
        >
          <IconPencil size={14} />
        </ActionIcon>
        {included && (
          <>
            <ActionIcon
              size="sm"
              variant="subtle"
              disabled={!canMoveUp}
              onClick={onMoveUp}
            >
              <IconArrowUp size={14} />
            </ActionIcon>
            <ActionIcon
              size="sm"
              variant="subtle"
              disabled={!canMoveDown}
              onClick={onMoveDown}
            >
              <IconArrowDown size={14} />
            </ActionIcon>
          </>
        )}
      </Group>
    </Group>
  );
}

// ─── Appendixes Section ───────────────────────────────────────────────────────

function AppendixesSection({
  config,
  onSave,
  saving,
}: {
  config: AppendixItem[];
  onSave: (cfg: AppendixItem[]) => void;
  saving: boolean;
}) {
  const [items, setItems] = useState<AppendixItem[]>(config);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [customOpen, { open: openCustom, close: closeCustom }] = useDisclosure(false);

  const toggle = (idx: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, included: !item.included } : item,
      ),
    );
  };

  const move = (idx: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      // Keep expanded item tracking correct after move.
      if (expandedIdx === idx) setExpandedIdx(swapIdx);
      else if (expandedIdx === swapIdx) setExpandedIdx(idx);
      return next;
    });
  };

  const updateCustomMd = (idx: number, value: string) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, custom_md: value } : item)),
    );
  };

  const addCustom = (title: string, custom_md: string) => {
    setItems((prev) => [
      ...prev,
      { type: "custom", title, included: true, custom_md },
    ]);
    closeCustom();
  };

  const remove = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    if (expandedIdx === idx) setExpandedIdx(null);
  };

  const dirty = JSON.stringify(items) !== JSON.stringify(config);

  return (
    <Card withBorder padding="lg">
      <Title order={4} mb="xs">
        Appendixes
      </Title>
      <Text size="sm" c="dimmed" mb="md">
        Toggle which appendixes to include and reorder them. Click the expand arrow to add
        report-specific content. Custom appendixes let you write freeform content.
      </Text>

      <Stack gap={4} mb="md">
        {items.map((item, idx) => (
          <Box
            key={idx}
            style={{
              border: "1px solid var(--mantine-color-dark-4)",
              borderRadius: "var(--mantine-radius-sm)",
              opacity: item.included ? 1 : 0.6,
              overflow: "hidden",
            }}
          >
            <Group gap="sm" p="xs">
              <Checkbox
                checked={item.included}
                onChange={() => toggle(idx)}
                color="usfGreen"
              />
              <Text size="sm" style={{ flex: 1 }}>
                {item.title}
              </Text>
              {item.type === "custom" && (
                <Badge variant="outline" size="xs">custom</Badge>
              )}
              {item.custom_md && (
                <Badge color="usfGreen" variant="dot" size="xs">edited</Badge>
              )}
              <Group gap={2}>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  title={expandedIdx === idx ? "Collapse" : "Edit content"}
                  onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                >
                  {expandedIdx === idx ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                </ActionIcon>
                <ActionIcon size="sm" variant="subtle" disabled={idx === 0} onClick={() => move(idx, -1)}>
                  <IconArrowUp size={14} />
                </ActionIcon>
                <ActionIcon size="sm" variant="subtle" disabled={idx === items.length - 1} onClick={() => move(idx, 1)}>
                  <IconArrowDown size={14} />
                </ActionIcon>
                {item.type === "custom" && (
                  <ActionIcon size="sm" color="red" variant="subtle" onClick={() => remove(idx)}>
                    <IconTrash size={14} />
                  </ActionIcon>
                )}
              </Group>
            </Group>
            <Collapse in={expandedIdx === idx}>
              <Box
                p="sm"
                style={{ borderTop: "1px solid var(--mantine-color-dark-5)" }}
              >
                <Textarea
                  label={item.type === "custom" ? "Content" : "Report-specific content (optional)"}
                  description={
                    item.type !== "custom"
                      ? "Overrides the auto-generated content for this appendix. Leave empty to use data from the engagement."
                      : undefined
                  }
                  placeholder="Markdown content..."
                  minRows={6}
                  autosize
                  value={item.custom_md ?? ""}
                  onChange={(e) => updateCustomMd(idx, e.currentTarget.value)}
                  styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)", fontSize: 13 } }}
                />
              </Box>
            </Collapse>
          </Box>
        ))}
      </Stack>

      <Group justify="space-between" mt="md">
        <Button
          variant="default"
          leftSection={<IconPlus size={14} />}
          onClick={openCustom}
          size="sm"
        >
          Add Custom Appendix
        </Button>
        <Button
          color="usfGreen"
          disabled={!dirty}
          loading={saving}
          onClick={() => onSave(items)}
        >
          Save Appendixes
        </Button>
      </Group>

      <CustomAppendixModal
        opened={customOpen}
        onClose={closeCustom}
        onAdd={addCustom}
      />
    </Card>
  );
}

function CustomAppendixModal({
  opened,
  onClose,
  onAdd,
}: {
  opened: boolean;
  onClose: () => void;
  onAdd: (title: string, custom_md: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  return (
    <Modal opened={opened} onClose={onClose} title="Add Custom Appendix" size="lg">
      <Stack gap="sm">
        <TextInput
          label="Title"
          placeholder="e.g. Scope Clarification"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          required
        />
        <Textarea
          label="Content"
          placeholder="Markdown content..."
          minRows={8}
          value={body}
          onChange={(e) => setBody(e.currentTarget.value)}
          styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)" } }}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button
            color="usfGreen"
            disabled={!title.trim()}
            onClick={() => onAdd(title.trim(), body)}
          >
            Add
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ─── Generate Section ─────────────────────────────────────────────────────────

type ChecklistItemProps = {
  ok: boolean;
  warn?: boolean;
  label: string;
  detail: string;
};

function ChecklistItem({ ok, warn, label, detail }: ChecklistItemProps) {
  const color = ok ? "usfGreen" : warn ? "yellow" : "red";
  const symbol = ok ? "✓" : warn ? "~" : "✗";
  return (
    <Group gap="sm" align="flex-start">
      <Text size="sm" fw={700} c={color} style={{ width: 16, flexShrink: 0 }}>
        {symbol}
      </Text>
      <Box>
        <Text size="sm" fw={500}>{label}</Text>
        <Text size="xs" c="dimmed">{detail}</Text>
      </Box>
    </Group>
  );
}

function GenerateSection({
  engagement,
  report,
  onJsonDownload,
}: {
  engagement: Engagement;
  report: EngagementReport | null;
  onJsonDownload: () => void;
}) {
  const [gwOpen, { open: openGw, close: closeGw }] = useDisclosure(false);

  const generate = useMutation({
    mutationFn: () => generateReport(engagement.id),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${engagement.name.replace(/\s+/g, "_")}_report.docx`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : "Generation failed. Check template is uploaded.";
      notifications.show({ color: "red", message: msg });
    },
  });

  const hasTemplate = !!report?.template_file_path;
  const findingCount = report?.selected_finding_ids.length ?? 0;
  const execWords = wordCount(report?.exec_summary_md ?? "");
  const recWords = wordCount(report?.recommendations_md ?? "");
  const appendixConfig: AppendixItem[] =
    report?.appendix_config && report.appendix_config.length > 0
      ? (report.appendix_config as AppendixItem[])
      : DEFAULT_APPENDIXES;
  const includedAppendixes = appendixConfig.filter((a) => a.included).length;

  const readyToGenerate = hasTemplate && findingCount > 0 && execWords >= 50;

  return (
    <Card withBorder padding="lg">
      <Title order={4} mb="xs">
        Generate Report
      </Title>
      <Text size="sm" c="dimmed" mb="lg">
        Review the pre-flight checklist, then generate a <code>.docx</code> report from your template and configured data.
      </Text>

      {/* Pre-flight checklist */}
      <Card withBorder padding="md" bg="dark.8" mb="xl">
        <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb="sm" style={{ letterSpacing: "0.06em" }}>
          Pre-Flight Checklist
        </Text>
        <Stack gap="xs">
          <ChecklistItem
            ok={hasTemplate}
            label="Template"
            detail={hasTemplate ? `${report!.template_file_path!.split("/").pop()} is loaded` : "No template — load the default or upload a .docx in the Template section"}
          />
          <ChecklistItem
            ok={execWords >= 50}
            warn={execWords > 0 && execWords < 50}
            label="Executive Summary"
            detail={execWords === 0 ? "Not written — add content in Executive Summary" : `${execWords} words${execWords < 50 ? " (aim for 200–400)" : ""}`}
          />
          <ChecklistItem
            ok={recWords >= 20}
            warn={recWords > 0 && recWords < 20}
            label="Recommendations"
            detail={recWords === 0 ? "Not written — add content in Recommendations" : `${recWords} words`}
          />
          <ChecklistItem
            ok={findingCount > 0}
            label="Technical Findings"
            detail={findingCount === 0 ? "No findings selected — select findings in Technical Findings" : `${findingCount} finding${findingCount !== 1 ? "s" : ""} included`}
          />
          <ChecklistItem
            ok
            warn={includedAppendixes === 0}
            label="Appendixes"
            detail={includedAppendixes === 0 ? "None included (optional)" : `${includedAppendixes} appendix${includedAppendixes !== 1 ? "es" : ""} included`}
          />
        </Stack>
      </Card>

      <Button
        size="lg"
        color="usfGreen"
        leftSection={<IconDownload size={20} />}
        loading={generate.isPending}
        disabled={!hasTemplate}
        onClick={() => generate.mutate()}
        mb="md"
        fullWidth
        variant={readyToGenerate ? "filled" : "light"}
      >
        Generate Report (.docx)
      </Button>

      {!hasTemplate && (
        <Text size="xs" c="dimmed" ta="center">
          Upload a template in the Template section first.
        </Text>
      )}

      <Divider my="lg" label="Other Export Options" labelPosition="center" />

      <Group gap="sm">
        <Button
          variant="default"
          leftSection={<IconSettings size={16} />}
          onClick={openGw}
        >
          Export to Ghostwriter
        </Button>
        <Button
          variant="default"
          leftSection={<IconChevronDown size={16} />}
          onClick={onJsonDownload}
        >
          Download JSON
        </Button>
      </Group>

      <GhostwriterExportModal
        opened={gwOpen}
        onClose={closeGw}
        engagement={engagement}
      />
    </Card>
  );
}
