import {
  ActionIcon,
  Badge,
  Button,
  Collapse,
  Drawer,
  Group,
  Loader,
  Modal,
  MultiSelect,
  Select,
  Stack,
  Table,
  TagsInput,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconBook,
  IconPaperclip,
  IconPlus,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  createFinding,
  createTemplate,
  deleteFinding,
  deleteTemplate,
  listAssets,
  listFindings,
  listTemplates,
  updateFinding,
  type Finding,
  type FindingStatus,
  type Severity,
  type Workstream,
} from "../api/client";
import { SEVERITY_COLOR } from "../theme";
import { CvssCalculator } from "./CvssCalculator";
import { useWorkstreamTarget } from "./useWorkstreamTarget";
import { EvidenceDropzone } from "./EvidenceDropzone";

const SEVERITIES: Severity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "informational",
];
const SEV_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  informational: 4,
};
const STATUSES: { value: FindingStatus; label: string }[] = [
  { value: "not_done", label: "Not Done" },
  { value: "draft",    label: "Draft"    },
  { value: "done",     label: "Done"     },
];

type Editable = Partial<Finding> & { title: string };

function FindingEditor({
  eid,
  finding,
  onClose,
}: {
  eid: string;
  finding: Finding;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const assets = useQuery({
    queryKey: ["assets", eid, "all"],
    queryFn: () => listAssets(eid),
  });
  const [f, setF] = useState<Editable>({ ...finding });
  const [adv, advCtl] = useDisclosure(false);
  const set = (patch: Partial<Editable>) => setF((p) => ({ ...p, ...patch }));

  const save = useMutation({
    mutationFn: () =>
      updateFinding(eid, finding.id, {
        title: f.title,
        finding_type: f.finding_type ?? null,
        severity: f.severity,
        status: f.status,
        cvss_vector: f.cvss_vector ?? null,
        cvss_score: f.cvss_score ?? null,
        cwe: f.cwe ?? null,
        cve: f.cve ?? null,
        description_md: f.description_md ?? null,
        impact_md: f.impact_md ?? null,
        reproduction_md: f.reproduction_md ?? null,
        remediation_md: f.remediation_md ?? null,
        host_detection_md: f.host_detection_md ?? null,
        network_detection_md: f.network_detection_md ?? null,
        references_md: f.references_md ?? null,
        tags: f.tags ?? [],
        asset_ids: f.asset_ids ?? [],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["findings", eid] });
      notifications.show({ color: "usfGreen", message: "Finding saved." });
      onClose();
    },
  });

  const saveTpl = useMutation({
    mutationFn: () =>
      createTemplate({
        name: f.title?.trim() || "Untitled template",
        finding_type: f.finding_type ?? null,
        severity_default: f.severity ?? "medium",
        cwe: f.cwe ?? null,
        description_md: f.description_md ?? null,
        impact_md: f.impact_md ?? null,
        remediation_md: f.remediation_md ?? null,
        host_detection_md: f.host_detection_md ?? null,
        network_detection_md: f.network_detection_md ?? null,
        references_md: f.references_md ?? null,
        tags: f.tags ?? [],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      notifications.show({
        color: "usfGreen",
        message: "Saved as reusable template.",
      });
    },
    onError: () =>
      notifications.show({
        color: "red",
        message: "Template name already exists — rename the finding.",
      }),
  });

  const assetOpts =
    assets.data?.map((a) => ({ value: a.id, label: a.identifier })) ?? [];

  return (
    <Drawer
      opened
      onClose={onClose}
      position="right"
      size="xl"
      title={<Title order={4}>Edit finding</Title>}
    >
      <Stack>
        <TextInput
          label="Title"
          value={f.title}
          onChange={(e) => set({ title: e.currentTarget.value })}
        />
        <Group grow>
          <TextInput
            label="Finding type"
            placeholder="Web, Active Directory, Network…"
            value={f.finding_type ?? ""}
            onChange={(e) => set({ finding_type: e.currentTarget.value })}
          />
          <Select
            label="Status"
            data={STATUSES}
            allowDeselect={false}
            value={f.status}
            onChange={(v) => set({ status: (v ?? "not_done") as FindingStatus })}
          />
        </Group>

        <CvssCalculator
          vector={f.cvss_vector ?? null}
          onChange={({ vector, score, severity }) =>
            set({
              cvss_vector: vector,
              cvss_score: score,
              severity: severity as Severity,
            })
          }
        />
        <Group grow>
          <Select
            label="Severity (auto from CVSS; override if needed)"
            data={SEVERITIES}
            allowDeselect={false}
            value={f.severity}
            onChange={(v) => set({ severity: (v ?? "medium") as Severity })}
          />
          <TextInput
            label="CWE"
            value={f.cwe ?? ""}
            onChange={(e) => set({ cwe: e.currentTarget.value })}
          />
          <TextInput
            label="CVE"
            value={f.cve ?? ""}
            onChange={(e) => set({ cve: e.currentTarget.value })}
          />
        </Group>

        <Textarea
          label="Description"
          autosize
          minRows={3}
          value={f.description_md ?? ""}
          onChange={(e) => set({ description_md: e.currentTarget.value })}
        />
        <Textarea
          label="Impact"
          autosize
          minRows={2}
          value={f.impact_md ?? ""}
          onChange={(e) => set({ impact_md: e.currentTarget.value })}
        />
        <Textarea
          label="Mitigation / remediation"
          autosize
          minRows={2}
          value={f.remediation_md ?? ""}
          onChange={(e) => set({ remediation_md: e.currentTarget.value })}
        />

        <MultiSelect
          label="Affected hosts"
          data={assetOpts}
          searchable
          value={f.asset_ids ?? []}
          onChange={(v) => set({ asset_ids: v })}
        />
        <TagsInput
          label="Tags"
          value={f.tags ?? []}
          onChange={(v) => set({ tags: v })}
        />

        <Button variant="subtle" size="xs" onClick={advCtl.toggle}>
          {adv ? "Hide" : "Show"} replication & detection
        </Button>
        <Collapse in={adv}>
          <Stack>
            <Textarea
              label="Replication steps"
              autosize
              minRows={2}
              value={f.reproduction_md ?? ""}
              onChange={(e) => set({ reproduction_md: e.currentTarget.value })}
            />
            <Textarea
              label="Host detection techniques"
              autosize
              minRows={2}
              value={f.host_detection_md ?? ""}
              onChange={(e) => set({ host_detection_md: e.currentTarget.value })}
            />
            <Textarea
              label="Network detection techniques"
              autosize
              minRows={2}
              value={f.network_detection_md ?? ""}
              onChange={(e) =>
                set({ network_detection_md: e.currentTarget.value })
              }
            />
            <Textarea
              label="References"
              autosize
              minRows={2}
              value={f.references_md ?? ""}
              onChange={(e) => set({ references_md: e.currentTarget.value })}
            />
          </Stack>
        </Collapse>

        <Title order={6}>Evidence</Title>
        <EvidenceDropzone eid={eid} parentType="finding" parentId={finding.id} />

        <Group>
          <Button
            color="usfGreen"
            loading={save.isPending}
            onClick={() => save.mutate()}
            style={{ flex: 1 }}
          >
            Save finding
          </Button>
          <Button
            variant="default"
            loading={saveTpl.isPending}
            onClick={() => saveTpl.mutate()}
          >
            Save as template
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}

function LibraryModal({
  eid,
  workstreamId,
  workstreamKind,
  onClose,
  onUsed,
}: {
  eid: string;
  workstreamId?: string;
  workstreamKind?: string;
  onClose: () => void;
  onUsed: (f: Finding) => void;
}) {
  const qc = useQueryClient();
  const tpls = useQuery({
    queryKey: ["templates", workstreamKind ?? "all"],
    queryFn: () => listTemplates(workstreamKind),
  });
  const [search, setSearch] = useState("");
  const [showNew, newCtl] = useDisclosure(false);

  const filtered = (tpls.data ?? []).filter((t) =>
    search.trim() === "" ||
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.category ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const [t, setT] = useState({
    name: "",
    finding_type: "",
    severity_default: "medium" as Severity,
    description_md: "",
    remediation_md: "",
    host_detection_md: "",
    network_detection_md: "",
    finding_guidance_md: "",
  });

  const add = useMutation({
    mutationFn: () => createTemplate({ ...t }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      newCtl.close();
      setT({
        name: "",
        finding_type: "",
        severity_default: "medium",
        description_md: "",
        remediation_md: "",
        host_detection_md: "",
        network_detection_md: "",
        finding_guidance_md: "",
      });
    },
    onError: () =>
      notifications.show({ color: "red", message: "Name already exists." }),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
  const use = useMutation({
    mutationFn: (tplId: string) => {
      const tpl = tpls.data?.find((x) => x.id === tplId);
      return createFinding(eid, {
        title: tpl?.name ?? "Finding",
        template_id: tplId,
        workstream_id: workstreamId ?? null,
      });
    },
    onSuccess: (f) => {
      qc.invalidateQueries({ queryKey: ["findings", eid] });
      onUsed(f);
    },
  });

  return (
    <Modal opened onClose={onClose} title="Findings library" size="lg" centered>
      <Stack>
        <Group justify="space-between">
          <Text c="dimmed" size="sm">
            Reusable boilerplate — clone into this engagement.
          </Text>
          <Button size="xs" variant="light" onClick={newCtl.toggle}>
            {showNew ? "Cancel" : "+ New template"}
          </Button>
        </Group>

        <Collapse in={showNew}>
          <Stack gap="xs" mb="sm">
            <TextInput
              label="Name"
              required
              value={t.name}
              onChange={(e) => setT({ ...t, name: e.currentTarget.value })}
            />
            <Group grow>
              <TextInput
                label="Finding type"
                value={t.finding_type}
                onChange={(e) =>
                  setT({ ...t, finding_type: e.currentTarget.value })
                }
              />
              <Select
                label="Default severity"
                data={SEVERITIES}
                allowDeselect={false}
                value={t.severity_default}
                onChange={(v) =>
                  setT({ ...t, severity_default: (v ?? "medium") as Severity })
                }
              />
            </Group>
            <Textarea
              label="Description"
              autosize
              minRows={2}
              value={t.description_md}
              onChange={(e) =>
                setT({ ...t, description_md: e.currentTarget.value })
              }
            />
            <Textarea
              label="Remediation"
              autosize
              minRows={2}
              value={t.remediation_md}
              onChange={(e) =>
                setT({ ...t, remediation_md: e.currentTarget.value })
              }
            />
            <Textarea
              label="Host detection"
              autosize
              minRows={1}
              value={t.host_detection_md}
              onChange={(e) =>
                setT({ ...t, host_detection_md: e.currentTarget.value })
              }
            />
            <Textarea
              label="Guidance (internal — not in reports)"
              autosize
              minRows={1}
              value={t.finding_guidance_md}
              onChange={(e) =>
                setT({ ...t, finding_guidance_md: e.currentTarget.value })
              }
            />
            <Button
              size="xs"
              color="usfGreen"
              disabled={!t.name.trim()}
              loading={add.isPending}
              onClick={() => add.mutate()}
            >
              Save template
            </Button>
          </Stack>
        </Collapse>

        <TextInput
          placeholder="Search templates…"
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />

        {tpls.isLoading && <Loader />}
        {!tpls.isLoading && filtered.length === 0 && (
          <Text c="dimmed" size="sm">
            {search.trim() ? "No templates match your search." : "Library is empty."}
          </Text>
        )}
        {filtered.map((tpl) => (
          <Group key={tpl.id} justify="space-between" wrap="nowrap">
            <div>
              <Text fw={600} size="sm">
                {tpl.name}
              </Text>
              <Text size="xs" c="dimmed">
                {tpl.finding_type ?? "—"} ·{" "}
                <Text span c={SEVERITY_COLOR[tpl.severity_default]}>
                  {tpl.severity_default}
                </Text>
              </Text>
            </div>
            <Group gap="xs">
              <Button
                size="xs"
                color="usfGreen"
                loading={use.isPending}
                onClick={() => use.mutate(tpl.id)}
              >
                Use
              </Button>
              <ActionIcon
                color="red"
                variant="subtle"
                onClick={() => del.mutate(tpl.id)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          </Group>
        ))}
      </Stack>
    </Modal>
  );
}

export function FindingsTab({
  eid,
  workstreams,
  workstreamId,
  workstreamKind,
}: {
  eid: string;
  workstreams: Workstream[];
  workstreamId?: string;
  workstreamKind?: string;
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["findings", eid, workstreamId ?? "all"],
    queryFn: () => listFindings(eid, workstreamId),
  });

  const [search, setSearch] = useState("");
  const [sevFilter, setSevFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sort, setSort] = useState("severity");
  const [editing, setEditing] = useState<Finding | null>(null);
  const [evidenceFor, setEvidenceFor] = useState<Finding | null>(null);
  const [libOpen, libCtl] = useDisclosure(false);
  const [newOpen, newCtl] = useDisclosure(false);
  const [newTitle, setNewTitle] = useState("");
  const wsT = useWorkstreamTarget(workstreams, workstreamId);

  const create = useMutation({
    mutationFn: () =>
      createFinding(eid, {
        title: newTitle.trim() || "Untitled finding",
        workstream_id: wsT.wsId,
      }),
    onSuccess: (f) => {
      qc.invalidateQueries({ queryKey: ["findings", eid] });
      newCtl.close();
      setNewTitle("");
      setEditing(f);
    },
  });
  const patch = useMutation({
    mutationFn: (v: { id: string; data: Partial<Finding> }) =>
      updateFinding(eid, v.id, v.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["findings", eid] }),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteFinding(eid, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["findings", eid] }),
  });

  const rows = useMemo(() => {
    let r = q.data ?? [];
    if (search.trim()) {
      const s = search.toLowerCase();
      r = r.filter(
        (f) =>
          f.title.toLowerCase().includes(s) ||
          (f.finding_type ?? "").toLowerCase().includes(s) ||
          f.tags.some((t) => t.toLowerCase().includes(s)),
      );
    }
    if (sevFilter.length) r = r.filter((f) => sevFilter.includes(f.severity));
    if (statusFilter) r = r.filter((f) => f.status === statusFilter);
    r = [...r].sort((a, b) => {
      if (sort === "severity")
        return SEV_RANK[a.severity] - SEV_RANK[b.severity];
      if (sort === "title") return a.title.localeCompare(b.title);
      return 0;
    });
    return r;
  }, [q.data, search, sevFilter, statusFilter, sort]);

  return (
    <Stack>
      <Group justify="space-between" wrap="wrap">
        <Group gap="xs">
          <TextInput
            placeholder="Search title / type / tag"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            w={220}
          />
          <MultiSelect
            placeholder="Severity"
            data={SEVERITIES}
            value={sevFilter}
            onChange={setSevFilter}
            clearable
            w={200}
          />
          <Select
            placeholder="Status"
            data={STATUSES}
            value={statusFilter}
            onChange={setStatusFilter}
            clearable
            w={150}
          />
          <Select
            data={[
              { value: "severity", label: "Sort: severity" },
              { value: "title", label: "Sort: title" },
            ]}
            value={sort}
            onChange={(v) => setSort(v ?? "severity")}
            allowDeselect={false}
            w={150}
          />
        </Group>
        <Group gap="xs">
          <Button
            variant="default"
            leftSection={<IconBook size={16} />}
            onClick={libCtl.open}
          >
            Library
          </Button>
          <Button
            color="usfGold"
            c="dark.9"
            leftSection={<IconPlus size={16} />}
            onClick={newCtl.open}
          >
            New finding
          </Button>
        </Group>
      </Group>

      {q.isLoading && <Loader />}
      {q.data && rows.length === 0 && (
        <Text c="dimmed" ta="center">
          No findings match.
        </Text>
      )}
      {rows.length > 0 && (
        <Table highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Title</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Severity</Table.Th>
              <Table.Th>CVSS</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Hosts</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((fd) => (
              <Table.Tr key={fd.id}>
                <Table.Td>
                  <Text
                    fw={600}
                    style={{ cursor: "pointer" }}
                    onClick={() => setEditing(fd)}
                  >
                    {fd.title}
                  </Text>
                  {fd.tags.length > 0 && (
                    <Group gap={4} mt={2}>
                      {fd.tags.map((tg) => (
                        <Badge key={tg} size="xs" variant="outline" color="gray">
                          {tg}
                        </Badge>
                      ))}
                    </Group>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {fd.finding_type ?? "—"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Select
                    size="xs"
                    w={140}
                    allowDeselect={false}
                    data={SEVERITIES}
                    value={fd.severity}
                    onChange={(v) =>
                      v &&
                      patch.mutate({
                        id: fd.id,
                        data: { severity: v as Severity },
                      })
                    }
                    leftSection={
                      <Badge size="xs" color={SEVERITY_COLOR[fd.severity]} circle>
                        {" "}
                      </Badge>
                    }
                  />
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {fd.cvss_score != null ? fd.cvss_score.toFixed(1) : "—"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Select
                    size="xs"
                    w={150}
                    allowDeselect={false}
                    data={STATUSES}
                    value={fd.status}
                    onChange={(v) =>
                      v &&
                      patch.mutate({
                        id: fd.id,
                        data: { status: v as FindingStatus },
                      })
                    }
                  />
                </Table.Td>
                <Table.Td>
                  <Badge variant="outline" color="gray">
                    {fd.asset_ids.length}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    color="usfGreen"
                    title="Evidence"
                    onClick={() => setEvidenceFor(fd)}
                  >
                    <IconPaperclip size={16} />
                  </ActionIcon>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    ml={4}
                    onClick={() => del.mutate(fd.id)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal
        opened={newOpen}
        onClose={newCtl.close}
        title="New finding"
        centered
      >
        <Stack>
          <TextInput
            label="Title"
            required
            placeholder="e.g. SQL injection in /login"
            value={newTitle}
            onChange={(e) => setNewTitle(e.currentTarget.value)}
          />
          {wsT.picker}
          <Button
            color="usfGreen"
            disabled={!newTitle.trim() || !wsT.ready}
            loading={create.isPending}
            onClick={() => create.mutate()}
          >
            Create & edit
          </Button>
        </Stack>
      </Modal>

      {editing && (
        <FindingEditor
          eid={eid}
          finding={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {libOpen && (
        <LibraryModal
          eid={eid}
          workstreamId={workstreamId}
          workstreamKind={workstreamKind}
          onClose={libCtl.close}
          onUsed={(f) => {
            libCtl.close();
            setEditing(f);
          }}
        />
      )}
      <Modal
        opened={evidenceFor !== null}
        onClose={() => setEvidenceFor(null)}
        title={evidenceFor ? `Evidence — ${evidenceFor.title}` : "Evidence"}
        size="lg"
        centered
      >
        {evidenceFor && (
          <EvidenceDropzone
            eid={eid}
            parentType="finding"
            parentId={evidenceFor.id}
          />
        )}
      </Modal>
    </Stack>
  );
}
