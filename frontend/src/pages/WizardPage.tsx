import {
  ActionIcon,
  Button,
  Card,
  Group,
  MultiSelect,
  Select,
  Stack,
  Stepper,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  createEngagement,
  listUsers,
  type WorkstreamInput,
  type WorkstreamKind,
} from "../api/client";

const KINDS: { value: WorkstreamKind; label: string }[] = [
  { value: "active_directory", label: "Active Directory" },
  { value: "web", label: "Web" },
  { value: "external", label: "External" },
  { value: "internal", label: "Internal" },
  { value: "wireless", label: "Wireless" },
  { value: "cloud", label: "Cloud" },
  { value: "social", label: "Social Engineering" },
  { value: "physical", label: "Physical" },
  { value: "inject", label: "Inject" },
  { value: "other", label: "Other" },
];

export function WizardPage() {
  const navigate = useNavigate();
  const [active, setActive] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [type, setType] = useState("pentest");
  const [scope, setScope] = useState("");
  const [workstreams, setWorkstreams] = useState<WorkstreamInput[]>([
    { name: "Active Directory", kind: "active_directory", assignee_ids: [] },
  ]);
  const [memberIds, setMemberIds] = useState<string[]>([]);

  // Member assignment needs the user list (admin-only). Degrade gracefully.
  const users = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
    retry: false,
  });
  const userOptions =
    users.data?.map((u) => ({ value: u.id, label: `${u.display_name} (@${u.username})` })) ??
    [];

  const addWorkstream = () =>
    setWorkstreams((w) => [...w, { name: "", kind: "other", assignee_ids: [] }]);
  const updateWorkstream = (i: number, patch: Partial<WorkstreamInput>) =>
    setWorkstreams((w) => w.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeWorkstream = (i: number) =>
    setWorkstreams((w) => w.filter((_, idx) => idx !== i));

  const canNext =
    active === 0 ? name.trim().length > 0 : active === 1 ? workstreams.every((w) => w.name.trim()) : true;

  const submit = async () => {
    setSubmitting(true);
    try {
      const eng = await createEngagement({
        name: name.trim(),
        client: client || null,
        type,
        status: "active",
        scope_md: scope || null,
        workstreams: workstreams.map((w) => ({ ...w, name: w.name.trim() })),
        member_ids: memberIds,
      });
      navigate(`/engagements/${eng.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack gap="lg" maw={760} mx="auto">
      <Title order={2}>Start Pentest</Title>

      <Stepper active={active} onStepClick={setActive} color="usfGreen">
        <Stepper.Step label="Basics" description="Name & target">
          <Stack mt="md">
            <TextInput
              label="Engagement name"
              placeholder="USF CCDC Prep"
              required
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
            />
            <TextInput
              label="Client / target"
              placeholder="Optional"
              value={client}
              onChange={(e) => setClient(e.currentTarget.value)}
            />
            <Select
              label="Type"
              data={["pentest", "redteam", "webapp", "external", "internal", "other"]}
              value={type}
              onChange={(v) => setType(v ?? "pentest")}
            />
            <Textarea
              label="Scope / RoE notes"
              placeholder="Optional — editable later"
              autosize
              minRows={2}
              value={scope}
              onChange={(e) => setScope(e.currentTarget.value)}
            />
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Areas" description="Workstreams">
          <Stack mt="md">
            <Text size="sm" c="dimmed">
              Split the engagement into areas (AD, Web, External…). Different
              operators can own different areas.
            </Text>
            {workstreams.map((w, i) => (
              <Card key={i} withBorder padding="sm">
                <Group align="flex-end" wrap="nowrap">
                  <TextInput
                    label="Name"
                    style={{ flex: 1 }}
                    value={w.name}
                    onChange={(e) => updateWorkstream(i, { name: e.currentTarget.value })}
                  />
                  <Select
                    label="Kind"
                    data={KINDS}
                    value={w.kind}
                    onChange={(v) =>
                      updateWorkstream(i, { kind: (v ?? "other") as WorkstreamKind })
                    }
                  />
                  <MultiSelect
                    label="Assignees"
                    data={userOptions}
                    value={w.assignee_ids}
                    onChange={(v) => updateWorkstream(i, { assignee_ids: v })}
                    disabled={userOptions.length === 0}
                    style={{ flex: 1 }}
                  />
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={() => removeWorkstream(i)}
                    disabled={workstreams.length === 1}
                  >
                    <IconTrash size={18} />
                  </ActionIcon>
                </Group>
              </Card>
            ))}
            <Button variant="light" color="usfGreen" onClick={addWorkstream}>
              + Add workstream
            </Button>
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Team" description="Members">
          <Stack mt="md">
            {userOptions.length === 0 ? (
              <Text size="sm" c="dimmed">
                Only you will be added. An admin can add more members later.
              </Text>
            ) : (
              <MultiSelect
                label="Engagement members"
                description="You are added automatically as lead."
                data={userOptions}
                value={memberIds}
                onChange={setMemberIds}
              />
            )}
          </Stack>
        </Stepper.Step>

        <Stepper.Completed>
          <Stack mt="md" align="center">
            <Text fw={600}>Ready to create “{name || "…"}”.</Text>
            <Text size="sm" c="dimmed">
              {workstreams.length} workstream(s) · {memberIds.length} extra member(s)
            </Text>
          </Stack>
        </Stepper.Completed>
      </Stepper>

      <Group justify="space-between">
        <Button
          variant="default"
          onClick={() => (active === 0 ? navigate("/") : setActive((a) => a - 1))}
        >
          {active === 0 ? "Cancel" : "Back"}
        </Button>
        {active < 3 ? (
          <Button
            color="usfGreen"
            disabled={!canNext}
            onClick={() => setActive((a) => a + 1)}
          >
            Next
          </Button>
        ) : (
          <Button color="usfGold" c="dark.9" loading={submitting} onClick={submit}>
            Create engagement
          </Button>
        )}
      </Group>
    </Stack>
  );
}
