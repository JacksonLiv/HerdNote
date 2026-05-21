import {
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconBrandDiscord, IconCheck, IconUser, IconX } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { testDiscordWebhook, updateProfile } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export function AccountPage() {
  const { user, setUser } = useAuth();

  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [webhookUrl, setWebhookUrl] = useState(user?.discord_webhook_url ?? "");
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  useEffect(() => {
    setDisplayName(user?.display_name ?? "");
    setWebhookUrl(user?.discord_webhook_url ?? "");
  }, [user]);

  const saveProfile = useMutation({
    mutationFn: () => updateProfile({
      display_name: displayName.trim() || undefined,
      discord_webhook_url: webhookUrl.trim() || null,
    }),
    onSuccess: (updated) => setUser(updated),
  });

  const testWebhook = useMutation({
    mutationFn: testDiscordWebhook,
    onSuccess: () => { setTestResult("success"); setTimeout(() => setTestResult(null), 4000); },
    onError: () => { setTestResult("error"); setTimeout(() => setTestResult(null), 4000); },
  });

  const dirty =
    displayName.trim() !== (user?.display_name ?? "") ||
    (webhookUrl.trim() || null) !== (user?.discord_webhook_url ?? null);

  return (
    <Stack maw={560} mx="auto" mt="xl" gap="lg">
      <Title order={2}>Account</Title>

      <Paper withBorder p="lg" radius="md">
        <Stack gap="sm">
          <Group gap="xs">
            <IconUser size={16} />
            <Text fw={600}>Profile</Text>
          </Group>
          <Divider />
          <TextInput
            label="Username"
            value={user?.username ?? ""}
            disabled
            description="Username cannot be changed."
          />
          <TextInput
            label="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.currentTarget.value)}
          />
          <Group>
            <Text size="sm">Role</Text>
            <Badge color={user?.role === "admin" ? "usfGold" : "gray"} c={user?.role === "admin" ? "dark.9" : undefined}>
              {user?.role}
            </Badge>
          </Group>
        </Stack>
      </Paper>

      <Paper withBorder p="lg" radius="md">
        <Stack gap="sm">
          <Group gap="xs">
            <IconBrandDiscord size={16} color="#5865F2" />
            <Text fw={600}>Discord notifications</Text>
          </Group>
          <Divider />
          <Text size="sm" c="dimmed">
            Enter a Discord webhook URL and you'll receive a notification whenever a new credential is captured in any engagement you're a member of.
          </Text>
          <Text size="xs" c="dimmed">
            To create a webhook: Discord channel settings → Integrations → Webhooks → New Webhook → Copy Webhook URL.
          </Text>
          <TextInput
            label="Webhook URL"
            placeholder="https://discord.com/api/webhooks/..."
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.currentTarget.value)}
            ff="monospace"
          />
          {testResult === "success" && (
            <Alert color="green" icon={<IconCheck size={16} />}>
              Test message sent! Check your Discord channel.
            </Alert>
          )}
          {testResult === "error" && (
            <Alert color="red" icon={<IconX size={16} />}>
              Failed to send. Check your webhook URL and try again.
            </Alert>
          )}
          <Group>
            <Button
              variant="default"
              size="sm"
              loading={testWebhook.isPending}
              disabled={!user?.discord_webhook_url && !webhookUrl.trim()}
              onClick={() => testWebhook.mutate()}
            >
              Send test message
            </Button>
            <Text size="xs" c="dimmed">
              {user?.discord_webhook_url ? "Webhook configured" : "No webhook set"}
            </Text>
          </Group>
        </Stack>
      </Paper>

      <Button
        color="usfGreen"
        disabled={!dirty}
        loading={saveProfile.isPending}
        onClick={() => saveProfile.mutate()}
      >
        Save changes
      </Button>
      {saveProfile.isSuccess && (
        <Text size="sm" c="green" ta="center">Saved.</Text>
      )}
    </Stack>
  );
}
