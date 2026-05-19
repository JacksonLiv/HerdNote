import {
  ActionIcon,
  Badge,
  Button,
  Collapse,
  FileButton,
  Group,
  Loader,
  Modal,
  MultiSelect,
  Select,
  Stack,
  Switch,
  Table,
  TagsInput,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconFileUpload,
  IconNetwork,
  IconPaperclip,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  bulkAddAssets,
  deleteAsset,
  importNmap,
  listAssets,
  updateAsset,
  type Asset,
  type NmapService,
  type Workstream,
} from "../api/client";
import { ASSET_STATE_COLOR, ASSET_STATES } from "../theme";
import { EvidenceDropzone } from "./EvidenceDropzone";
import { NetworkDiagram } from "./NetworkDiagram";

interface Ctx {
  eid: string;
  workstreams: Workstream[];
  workstreamId?: string; // undefined = "All" view
}

const wsOptions = (ws: Workstream[]) =>
  ws.map((w) => ({ value: w.id, label: w.name }));

function AssetRow({
  ctx,
  asset,
  onAttach,
  onPorts,
}: {
  ctx: Ctx;
  asset: Asset;
  onAttach: (a: Asset) => void;
  onPorts: (a: Asset) => void;
}) {
  const { eid, workstreams } = ctx;
  const qc = useQueryClient();
  const [ident, setIdent] = useState(asset.identifier);
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["assets", eid] });
    qc.invalidateQueries({ queryKey: ["network", eid] });
  };
  const patch = useMutation({
    mutationFn: (p: Parameters<typeof updateAsset>[2]) =>
      updateAsset(eid, asset.id, p),
    onSuccess: invalidate,
    onError: () =>
      notifications.show({ color: "red", message: "Update failed." }),
  });
  const del = useMutation({
    mutationFn: () => deleteAsset(eid, asset.id),
    onSuccess: invalidate,
  });

  return (
    <Table.Tr>
      <Table.Td>
        <TextInput
          variant="unstyled"
          value={ident}
          onChange={(e) => setIdent(e.currentTarget.value)}
          onBlur={() =>
            ident !== asset.identifier &&
            ident.trim() &&
            patch.mutate({ identifier: ident.trim() })
          }
        />
      </Table.Td>
      <Table.Td>
        <Badge variant="light" color="gray">
          {asset.type}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Select
          size="xs"
          allowDeselect={false}
          data={ASSET_STATES as unknown as string[]}
          value={asset.state}
          onChange={(v) => v && patch.mutate({ state: v as Asset["state"] })}
          w={140}
          leftSection={
            <Badge size="xs" color={ASSET_STATE_COLOR[asset.state]} circle>
              {" "}
            </Badge>
          }
        />
      </Table.Td>
      <Table.Td>
        <MultiSelect
          size="xs"
          w={210}
          placeholder="workstreams"
          data={wsOptions(workstreams)}
          value={asset.workstream_ids}
          onChange={(ids) => patch.mutate({ workstream_ids: ids })}
        />
      </Table.Td>
      <Table.Td>
        <Switch
          checked={asset.in_scope}
          onChange={(e) => patch.mutate({ in_scope: e.currentTarget.checked })}
          color="usfGreen"
        />
      </Table.Td>
      <Table.Td>
        <TagsInput
          size="xs"
          value={asset.tags}
          onChange={(tags) => patch.mutate({ tags })}
          w={170}
        />
      </Table.Td>
      <Table.Td>
        {asset.services?.length ? (
          <Badge
            variant="light"
            color="usfGreen"
            style={{ cursor: "pointer" }}
            onClick={() => onPorts(asset)}
          >
            {asset.services.length} ports
          </Badge>
        ) : (
          <Text size="xs" c="dimmed">
            —
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        <ActionIcon
          variant="subtle"
          color="usfGreen"
          title="Evidence"
          onClick={() => onAttach(asset)}
        >
          <IconPaperclip size={16} />
        </ActionIcon>
        <ActionIcon
          color="red"
          variant="subtle"
          ml={4}
          loading={del.isPending}
          onClick={() => del.mutate()}
        >
          <IconTrash size={16} />
        </ActionIcon>
      </Table.Td>
    </Table.Tr>
  );
}

function AddHosts({ ctx }: { ctx: Ctx }) {
  const { eid, workstreams, workstreamId } = ctx;
  const qc = useQueryClient();
  const inAll = !workstreamId;
  const [text, setText] = useState("");
  const [pickWs, setPickWs] = useState<string[]>([]);

  const targetWs = inAll ? pickWs : [workstreamId as string];
  const mut = useMutation({
    mutationFn: () => bulkAddAssets(eid, text, targetWs),
    onSuccess: (created) => {
      setText("");
      setPickWs([]);
      qc.invalidateQueries({ queryKey: ["assets", eid] });
      qc.invalidateQueries({ queryKey: ["network", eid] });
      notifications.show({
        color: "usfGreen",
        message: `Added ${created.length} host(s).`,
      });
    },
    onError: () =>
      notifications.show({ color: "red", message: "Nothing added." }),
  });
  const blocked = !text.trim() || (inAll && pickWs.length === 0);

  return (
    <Stack gap="xs">
      <Textarea
        label="Add hosts (paste IPs / CIDRs / hostnames / URLs)"
        placeholder={"10.0.0.0/24\ndc01.corp.local\nhttps://intranet.local"}
        autosize
        minRows={2}
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
      />
      <Group justify="space-between">
        {inAll ? (
          <MultiSelect
            placeholder="Assign workstream(s) — required in All view"
            data={wsOptions(workstreams)}
            value={pickWs}
            onChange={setPickWs}
            w={340}
          />
        ) : (
          <Text size="xs" c="dimmed">
            Will be added to this workstream.
          </Text>
        )}
        <Button
          color="usfGold"
          c="dark.9"
          disabled={blocked}
          loading={mut.isPending}
          onClick={() => mut.mutate()}
        >
          Add hosts
        </Button>
      </Group>
    </Stack>
  );
}

function NmapImport({ ctx }: { ctx: Ctx }) {
  const { eid } = ctx;
  const qc = useQueryClient();
  const [paste, setPaste] = useState("");
  const [autoSplit, setAutoSplit] = useState(true);
  const [opened, { toggle }] = useDisclosure(false);

  const run = useMutation({
    mutationFn: (opts: { file?: File; xmlText?: string }) =>
      importNmap(eid, { ...opts, autoSplit }),
    onSuccess: (r) => {
      setPaste("");
      qc.invalidateQueries({ queryKey: ["assets", eid] });
      qc.invalidateQueries({ queryKey: ["network", eid] });
      qc.invalidateQueries({ queryKey: ["engagement", eid] });
      notifications.show({
        color: "usfGreen",
        title: "Nmap imported",
        message: `${r.created} new, ${r.updated} updated · ${r.assigned_ad} → AD, ${r.assigned_web} → Web`,
      });
    },
    onError: () =>
      notifications.show({
        color: "red",
        message: "Couldn’t read that as nmap XML.",
      }),
  });

  return (
    <Stack gap="xs">
      <Group>
        <FileButton
          onChange={(f) => f && run.mutate({ file: f })}
          accept=".xml,text/xml,application/xml"
        >
          {(props) => (
            <Button
              {...props}
              variant="default"
              leftSection={<IconFileUpload size={16} />}
              loading={run.isPending}
            >
              Upload nmap XML
            </Button>
          )}
        </FileButton>
        <Button variant="subtle" size="xs" onClick={toggle}>
          {opened ? "Hide paste" : "…or paste XML"}
        </Button>
        <Switch
          label="Auto-split AD / Web"
          checked={autoSplit}
          onChange={(e) => setAutoSplit(e.currentTarget.checked)}
          color="usfGreen"
        />
      </Group>
      <Collapse in={opened}>
        <Stack gap="xs">
          <Textarea
            placeholder="Paste full `nmap -oX` output here"
            autosize
            minRows={4}
            value={paste}
            onChange={(e) => setPaste(e.currentTarget.value)}
            styles={{ input: { fontFamily: "monospace", fontSize: 11 } }}
          />
          <Button
            color="usfGold"
            c="dark.9"
            disabled={!paste.trim()}
            loading={run.isPending}
            onClick={() => run.mutate({ xmlText: paste })}
            style={{ alignSelf: "flex-start" }}
          >
            Import pasted scan
          </Button>
        </Stack>
      </Collapse>
    </Stack>
  );
}

export function AssetsTab({
  eid,
  workstreams,
  workstreamId,
}: {
  eid: string;
  workstreams: Workstream[];
  workstreamId?: string;
}) {
  const ctx: Ctx = { eid, workstreams, workstreamId };
  const q = useQuery({
    queryKey: ["assets", eid, workstreamId ?? "all"],
    queryFn: () => listAssets(eid, workstreamId),
  });
  const [evidenceFor, setEvidenceFor] = useState<Asset | null>(null);
  const [servicesFor, setServicesFor] = useState<Asset | null>(null);
  const [showNet, net] = useDisclosure(false);
  const [ev, evCtl] = useDisclosure(false);

  return (
    <Stack>
      <NmapImport ctx={ctx} />
      <AddHosts ctx={ctx} />

      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {workstreamId
            ? "Hosts assigned to this workstream."
            : "All hosts across the engagement."}
        </Text>
        <Button
          variant="light"
          color="usfGreen"
          leftSection={<IconNetwork size={16} />}
          onClick={net.toggle}
        >
          {showNet ? "Hide" : "Network map"}
        </Button>
      </Group>
      <Collapse in={showNet}>
        <NetworkDiagram eid={eid} workstreamId={workstreamId} />
      </Collapse>

      {q.isLoading && <Loader />}
      {q.data && q.data.length === 0 && (
        <Text c="dimmed" ta="center" mt="md">
          No hosts here yet.
        </Text>
      )}
      {q.data && q.data.length > 0 && (
        <Table highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Identifier</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>State</Table.Th>
              <Table.Th>Workstreams</Table.Th>
              <Table.Th>In scope</Table.Th>
              <Table.Th>Tags</Table.Th>
              <Table.Th>Ports</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {q.data.map((a) => (
              <AssetRow
                key={a.id}
                ctx={ctx}
                asset={a}
                onAttach={(x) => {
                  setEvidenceFor(x);
                  evCtl.open();
                }}
                onPorts={setServicesFor}
              />
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal
        opened={ev}
        onClose={evCtl.close}
        title={evidenceFor ? `Evidence — ${evidenceFor.identifier}` : "Evidence"}
        size="lg"
        centered
      >
        {evidenceFor && (
          <EvidenceDropzone
            eid={eid}
            parentType="asset"
            parentId={evidenceFor.id}
          />
        )}
      </Modal>

      <Modal
        opened={servicesFor !== null}
        onClose={() => setServicesFor(null)}
        title={servicesFor ? `Services — ${servicesFor.identifier}` : "Services"}
        size="lg"
        centered
      >
        {servicesFor && (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Port</Table.Th>
                <Table.Th>Proto</Table.Th>
                <Table.Th>Service</Table.Th>
                <Table.Th>Product / version</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(servicesFor.services as NmapService[]).map((s) => (
                <Table.Tr key={`${s.protocol}/${s.port}`}>
                  <Table.Td>
                    <Text ff="monospace">{s.port}</Text>
                  </Table.Td>
                  <Table.Td>{s.protocol}</Table.Td>
                  <Table.Td>{s.name ?? "—"}</Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {[s.product, s.version].filter(Boolean).join(" ") || "—"}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Modal>
    </Stack>
  );
}
