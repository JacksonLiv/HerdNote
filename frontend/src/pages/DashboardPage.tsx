import {
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { listEngagements } from "../api/client";

export function DashboardPage() {
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["engagements"], queryFn: listEngagements });

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Engagements</Title>
          <Text c="dimmed" size="sm">
            Track hosts, access, and notes during a pentest.
          </Text>
        </div>
        <Button
          size="md"
          color="usfGold"
          c="dark.9"
          leftSection={<IconPlus size={18} />}
          onClick={() => navigate("/new")}
        >
          Start Pentest
        </Button>
      </Group>

      {q.data && q.data.length === 0 && (
        <Card withBorder padding="xl">
          <Stack align="center" gap="xs">
            <Text fw={600}>No engagements yet</Text>
            <Text c="dimmed" size="sm">
              Click “Start Pentest” to spin one up in under a minute.
            </Text>
          </Stack>
        </Card>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {q.data?.map((e) => (
          <Card
            key={e.id}
            withBorder
            padding="lg"
            style={{ cursor: "pointer" }}
            onClick={() => navigate(`/engagements/${e.id}`)}
          >
            <Group justify="space-between">
              <Text fw={600}>{e.name}</Text>
              <Badge color="usfGreen" variant="light">
                {e.status}
              </Badge>
            </Group>
            <Text c="dimmed" size="sm">
              {e.client ?? "—"} · {e.type}
            </Text>
            <Group gap="xs" mt="sm">
              <Badge variant="outline" color="gray">
                {e.workstream_count} workstreams
              </Badge>
              <Badge variant="outline" color="gray">
                {e.member_count} members
              </Badge>
            </Group>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
