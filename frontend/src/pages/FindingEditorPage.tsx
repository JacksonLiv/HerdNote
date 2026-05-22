import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  FileButton,
  Grid,
  Group,
  Image,
  Loader,
  MultiSelect,
  Progress,
  ScrollArea,
  Select,
  Stack,
  Tabs,
  TagsInput,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArrowLeft,
  IconPhoto,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  deleteEvidence,
  getEngagement,
  listAssets,
  listEvidence,
  updateFinding,
  uploadEvidence,
  type Evidence,
  type Finding,
  type FindingStatus,
  type Severity,
} from "../api/client";
import { CvssCalculator } from "../components/CvssCalculator";
import { MarkdownTextarea, type MarkdownHandle } from "../components/MarkdownTextarea";
import { SEVERITY_COLOR } from "../theme";

// ── Helpers ───────────────────────────────────────────────────────────────────

function mdWordCount(text: string | null | undefined): number {
  if (!text) return 0;
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** Compact word count badge shown under markdown textareas. */
function FieldWordCount({ text }: { text: string | null | undefined }) {
  const n = mdWordCount(text);
  return (
    <Text size="xs" c={n === 0 ? "dimmed" : "dimmed"} ta="right" mt={2}>
      {n} {n === 1 ? "word" : "words"}
    </Text>
  );
}

/** Visual CVSS score bar (0–10). */
function CvssScoreBar({ score }: { score: number | null | undefined }) {
  if (score == null) return null;
  const pct = Math.min(Math.max(score / 10, 0), 1) * 100;
  const color =
    score >= 9.0 ? "red" :
    score >= 7.0 ? "orange" :
    score >= 4.0 ? "yellow" :
    score > 0    ? "blue"   : "gray";
  return (
    <Box mt={4}>
      <Progress value={pct} color={color} size="xs" radius="xl" />
      <Text size="xs" c="dimmed" ta="right" mt={2}>
        CVSS {score.toFixed(1)} / 10.0
      </Text>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "informational"];
const STATUSES: { value: FindingStatus; label: string }[] = [
  { value: "not_done", label: "Not Done" },
  { value: "draft",    label: "Draft"    },
  { value: "done",     label: "Done"     },
];
const STATUS_COLOR: Record<FindingStatus, string> = {
  not_done: "red",
  draft:    "yellow",
  done:     "usfGreen",
};

export function FindingEditorPage() {
  const { id: eid = "", fid = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const engQ = useQuery({ queryKey: ["engagement", eid], queryFn: () => getEngagement(eid) });
  const findingsQ = useQuery({
    queryKey: ["findings", eid],
    queryFn: async () => {
      const { listFindings } = await import("../api/client");
      return listFindings(eid);
    },
  });
  const assetsQ = useQuery({ queryKey: ["assets", eid, "all"], queryFn: () => listAssets(eid) });
  const evidenceQ = useQuery({
    queryKey: ["evidence", eid, "finding", fid],
    queryFn: () => listEvidence(eid, "finding", fid),
    enabled: !!fid,
  });

  const finding = findingsQ.data?.find((f) => f.id === fid);

  const [draft, setDraft] = useState<Partial<Finding> & { title: string }>({ title: "" });
  const [initialized, setInitialized] = useState(false);

  if (finding && !initialized) {
    setDraft({ ...finding });
    setInitialized(true);
  }

  // Track which MarkdownTextarea was last focused for image insertion.
  // Store the RefObject (not the handle value) so we always get the latest
  // handle even after re-renders update it via useImperativeHandle.
  const activeFieldRef = useRef<React.RefObject<MarkdownHandle | null> | null>(null);
  const fieldRefs = {
    description: useRef<MarkdownHandle>(null),
    impact: useRef<MarkdownHandle>(null),
    reproduction: useRef<MarkdownHandle>(null),
    remediation: useRef<MarkdownHandle>(null),
    host_detection: useRef<MarkdownHandle>(null),
    network_detection: useRef<MarkdownHandle>(null),
    references: useRef<MarkdownHandle>(null),
  };

  const set = (patch: Partial<typeof draft>) => setDraft((p) => ({ ...p, ...patch }));

  const save = useMutation({
    mutationFn: () =>
      updateFinding(eid, fid, {
        title: draft.title,
        finding_type: draft.finding_type ?? null,
        severity: draft.severity,
        status: draft.status,
        cvss_vector: draft.cvss_vector ?? null,
        cvss_score: draft.cvss_score ?? null,
        cwe: draft.cwe ?? null,
        cve: draft.cve ?? null,
        description_md: draft.description_md ?? null,
        impact_md: draft.impact_md ?? null,
        reproduction_md: draft.reproduction_md ?? null,
        remediation_md: draft.remediation_md ?? null,
        host_detection_md: draft.host_detection_md ?? null,
        network_detection_md: draft.network_detection_md ?? null,
        references_md: draft.references_md ?? null,
        tags: draft.tags ?? [],
        asset_ids: draft.asset_ids ?? [],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["findings", eid] });
      notifications.show({ color: "usfGreen", message: "Finding saved." });
    },
  });

  const uploadEv = useMutation({
    mutationFn: (file: File) => uploadEvidence(eid, "finding", fid, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["evidence", eid, "finding", fid] }),
  });

  const deleteEv = useMutation({
    mutationFn: (evId: string) => deleteEvidence(eid, evId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["evidence", eid, "finding", fid] }),
  });

  const insertImage = (ev: Evidence) => {
    const target = activeFieldRef.current?.current;
    if (!target) {
      notifications.show({ color: "yellow", message: "Click inside a text field first, then click the image." });
      return;
    }
    const mdImg = `\n![${ev.caption || ev.filename}](${ev.url})\n`;
    target.insertAtCursor(mdImg);
  };

  const makeFieldFocusHandler = (ref: React.RefObject<MarkdownHandle | null>) => () => {
    activeFieldRef.current = ref;
  };

  const assetOpts = assetsQ.data?.map((a) => ({ value: a.id, label: a.identifier })) ?? [];
  const images = (evidenceQ.data ?? []).filter((e) => e.content_type.startsWith("image/"));
  const otherFiles = (evidenceQ.data ?? []).filter((e) => !e.content_type.startsWith("image/"));

  if (findingsQ.isLoading || engQ.isLoading) return <Loader />;
  if (!finding) return <Text c="red">Finding not found.</Text>;

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between" align="center">
        <Group gap="sm">
          <ActionIcon variant="subtle" onClick={() => navigate(`/engagements/${eid}`)}>
            <IconArrowLeft size={18} />
          </ActionIcon>
          <div>
            <Text size="xs" c="dimmed">
              {engQ.data?.name ?? "—"} / Findings
            </Text>
            <Title order={3}>{draft.title || finding.title}</Title>
          </div>
        </Group>
        <Group gap="sm">
          <Badge color={STATUS_COLOR[draft.status ?? finding.status as FindingStatus] ?? "gray"} size="lg" variant="light">
            {STATUSES.find((s) => s.value === (draft.status ?? finding.status))?.label ?? draft.status ?? finding.status}
          </Badge>
          <Badge color={SEVERITY_COLOR[draft.severity ?? finding.severity] ?? "gray"} size="lg">
            {draft.severity ?? finding.severity}
          </Badge>
          <Button color="usfGreen" loading={save.isPending} onClick={() => save.mutate()}>
            Save Finding
          </Button>
        </Group>
      </Group>

      <Grid gutter="md">
        {/* Left: Editor */}
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Tabs defaultValue="overview" color="usfGreen" keepMounted={false}>
            <Tabs.List mb="sm">
              <Tabs.Tab value="overview">Overview</Tabs.Tab>
              <Tabs.Tab value="description">Description</Tabs.Tab>
              <Tabs.Tab value="replication">Steps to Reproduce</Tabs.Tab>
              <Tabs.Tab value="remediation">Remediation</Tabs.Tab>
              <Tabs.Tab value="detection">Detection</Tabs.Tab>
              <Tabs.Tab value="references">References</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="overview">
              <Stack gap="sm">
                <TextInput
                  label="Title"
                  value={draft.title}
                  onChange={(e) => set({ title: e.currentTarget.value })}
                />
                <Group grow>
                  <TextInput
                    label="Finding Type"
                    placeholder="Web, Active Directory, Network…"
                    value={draft.finding_type ?? ""}
                    onChange={(e) => set({ finding_type: e.currentTarget.value })}
                  />
                  <Select
                    label="Writing Status"
                    data={STATUSES}
                    allowDeselect={false}
                    value={draft.status ?? finding.status}
                    onChange={(v) => set({ status: (v ?? "not_done") as FindingStatus })}
                  />
                </Group>
                <Box>
                  <CvssCalculator
                    vector={draft.cvss_vector ?? null}
                    onChange={({ vector, score, severity }) =>
                      set({ cvss_vector: vector, cvss_score: score, severity: severity as Severity })
                    }
                  />
                  <CvssScoreBar score={draft.cvss_score ?? finding.cvss_score} />
                </Box>
                <Group grow>
                  <Select
                    label="Severity"
                    data={SEVERITIES}
                    allowDeselect={false}
                    value={draft.severity ?? finding.severity}
                    onChange={(v) => set({ severity: (v ?? "medium") as Severity })}
                  />
                  <TextInput
                    label="CWE"
                    value={draft.cwe ?? ""}
                    onChange={(e) => set({ cwe: e.currentTarget.value })}
                  />
                  <TextInput
                    label="CVE"
                    value={draft.cve ?? ""}
                    onChange={(e) => set({ cve: e.currentTarget.value })}
                  />
                </Group>
                <MultiSelect
                  label="Affected Hosts"
                  data={assetOpts}
                  searchable
                  value={draft.asset_ids ?? []}
                  onChange={(v) => set({ asset_ids: v })}
                />
                <TagsInput
                  label="Tags"
                  value={draft.tags ?? []}
                  onChange={(v) => set({ tags: v })}
                />
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="description">
              <Stack gap="sm">
                <Box>
                  <MarkdownTextarea
                    ref={fieldRefs.description}
                    label="Description"
                    description="What is the vulnerability? Explain it clearly and concisely. Click a field then click an evidence image to insert it."
                    value={draft.description_md ?? ""}
                    onChange={(v) => set({ description_md: v })}
                    minRows={6}
                    onFocus={makeFieldFocusHandler(fieldRefs.description)}
                  />
                  <FieldWordCount text={draft.description_md} />
                </Box>
                <Box>
                  <MarkdownTextarea
                    ref={fieldRefs.impact}
                    label="Business Impact"
                    description="What is the real-world consequence of exploitation? Reference data breach, privilege escalation, compliance, or operational disruption."
                    value={draft.impact_md ?? ""}
                    onChange={(v) => set({ impact_md: v })}
                    minRows={4}
                    onFocus={makeFieldFocusHandler(fieldRefs.impact)}
                  />
                  <FieldWordCount text={draft.impact_md} />
                </Box>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="replication">
              <Box>
                <MarkdownTextarea
                  ref={fieldRefs.reproduction}
                  label="Steps to Reproduce"
                  description="Step-by-step proof of concept. Use numbered steps and code blocks for commands. Click an evidence image to insert it at the cursor."
                  value={draft.reproduction_md ?? ""}
                  onChange={(v) => set({ reproduction_md: v })}
                  minRows={12}
                  placeholder={"1. Navigate to...\n2. Run:\n```\ncommand here\n```\n3. Observe the following response...\n\nExpected result: ...\nActual result: ..."}
                  onFocus={makeFieldFocusHandler(fieldRefs.reproduction)}
                />
                <FieldWordCount text={draft.reproduction_md} />
              </Box>
            </Tabs.Panel>

            <Tabs.Panel value="remediation">
              <Box>
                <MarkdownTextarea
                  ref={fieldRefs.remediation}
                  label="Remediation"
                  description="Specific, actionable steps to resolve the vulnerability. Reference patch versions, configuration changes, or architectural improvements."
                  value={draft.remediation_md ?? ""}
                  onChange={(v) => set({ remediation_md: v })}
                  minRows={8}
                  onFocus={makeFieldFocusHandler(fieldRefs.remediation)}
                />
                <FieldWordCount text={draft.remediation_md} />
              </Box>
            </Tabs.Panel>

            <Tabs.Panel value="detection">
              <Stack gap="sm">
                <Box>
                  <MarkdownTextarea
                    ref={fieldRefs.host_detection}
                    label="Host-Based Detection"
                    description="Indicators of compromise, log signatures, EDR rules, or file-system artefacts that reveal exploitation."
                    value={draft.host_detection_md ?? ""}
                    onChange={(v) => set({ host_detection_md: v })}
                    minRows={4}
                    onFocus={makeFieldFocusHandler(fieldRefs.host_detection)}
                  />
                  <FieldWordCount text={draft.host_detection_md} />
                </Box>
                <Box>
                  <MarkdownTextarea
                    ref={fieldRefs.network_detection}
                    label="Network-Based Detection"
                    description="IDS/IPS signatures, firewall rules, anomalous traffic patterns, or SIEM correlation logic."
                    value={draft.network_detection_md ?? ""}
                    onChange={(v) => set({ network_detection_md: v })}
                    minRows={4}
                    onFocus={makeFieldFocusHandler(fieldRefs.network_detection)}
                  />
                  <FieldWordCount text={draft.network_detection_md} />
                </Box>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="references">
              <MarkdownTextarea
                ref={fieldRefs.references}
                label="References"
                description="CVEs, NVD links, vendor advisories, OWASP entries, or research papers. Use markdown links: [CVE-2021-44228](https://nvd.nist.gov/vuln/detail/CVE-2021-44228)"
                value={draft.references_md ?? ""}
                onChange={(v) => set({ references_md: v })}
                minRows={5}
                placeholder={"- [CVE-XXXX-XXXXX](https://nvd.nist.gov/...)\n- [OWASP A03:2021 – Injection](https://owasp.org/Top10/A03_2021-Injection/)\n- [Vendor Advisory](https://...)"}
                onFocus={makeFieldFocusHandler(fieldRefs.references)}
              />
            </Tabs.Panel>
          </Tabs>
        </Grid.Col>

        {/* Right: Evidence panel */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder padding="sm" style={{ position: "sticky", top: 16 }}>
            <Group justify="space-between" mb="sm">
              <Text fw={600} size="sm">
                Evidence
              </Text>
              <FileButton
                onChange={(file) => file && uploadEv.mutate(file)}
                accept="image/*,application/pdf,text/plain"
              >
                {(props) => (
                  <Tooltip label="Upload evidence">
                    <ActionIcon {...props} size="sm" variant="default" loading={uploadEv.isPending}>
                      <IconUpload size={14} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </FileButton>
            </Group>

            {evidenceQ.isLoading && <Loader size="xs" />}

            {images.length === 0 && otherFiles.length === 0 && !evidenceQ.isLoading && (
              <Text size="xs" c="dimmed">
                No evidence yet. Upload screenshots or files above.
              </Text>
            )}

            {/* Images — click to insert */}
            {images.length > 0 && (
              <>
                <Text size="xs" c="dimmed" mb="xs">
                  Click an image to insert it at the cursor.
                </Text>
                <ScrollArea mah={400}>
                  <Stack gap="xs">
                    {images.map((ev) => (
                      <EvidenceImageCard
                        key={ev.id}
                        ev={ev}
                        onInsert={() => insertImage(ev)}
                        onDelete={() => deleteEv.mutate(ev.id)}
                      />
                    ))}
                  </Stack>
                </ScrollArea>
              </>
            )}

            {/* Non-image files */}
            {otherFiles.length > 0 && (
              <>
                <Text size="xs" c="dimmed" mt="sm" mb="xs">
                  Other files
                </Text>
                <Stack gap={4}>
                  {otherFiles.map((ev) => (
                    <Group key={ev.id} justify="space-between" gap="xs">
                      <Text size="xs" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {ev.filename}
                      </Text>
                      <Group gap={2}>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          component="a"
                          href={ev.url}
                          target="_blank"
                        >
                          <IconPhoto size={12} />
                        </ActionIcon>
                        <ActionIcon
                          size="xs"
                          color="red"
                          variant="subtle"
                          onClick={() => deleteEv.mutate(ev.id)}
                        >
                          <IconTrash size={12} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  ))}
                </Stack>
              </>
            )}
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

function EvidenceImageCard({
  ev,
  onInsert,
  onDelete,
}: {
  ev: Evidence;
  onInsert: () => void;
  onDelete: () => void;
}) {
  return (
    <Box
      style={{
        border: "1px solid var(--mantine-color-dark-4)",
        borderRadius: "var(--mantine-radius-sm)",
        overflow: "hidden",
        cursor: "pointer",
        transition: "border-color 150ms",
      }}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onInsert}
    >
      <Image
        src={ev.url}
        alt={ev.caption || ev.filename}
        fit="contain"
        mah={160}
        style={{ background: "var(--mantine-color-dark-6)" }}
      />
      <Group justify="space-between" p={6} gap="xs">
        <Text size="xs" c="dimmed" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {ev.caption || ev.filename}
        </Text>
        <ActionIcon
          size="xs"
          color="red"
          variant="subtle"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <IconTrash size={12} />
        </ActionIcon>
      </Group>
    </Box>
  );
}
