import {
  AppShell as MantineAppShell,
  Avatar,
  Badge,
  Group,
  Image,
  Menu,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { IconBrandDiscord, IconLogout, IconShieldLock, IconUser } from "@tabler/icons-react";
import { Outlet, useNavigate } from "react-router-dom";

import logo from "../assets/logo.jpg";
import { useAuth } from "../auth/AuthContext";

export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <MantineAppShell header={{ height: 56 }} padding="lg">
      <MantineAppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <UnstyledButton onClick={() => navigate("/")}>
            <Group gap="xs">
              <Image src={logo} alt="CyberHerd" w={28} h={28} />
              <Text fw={700}>CyberHerd</Text>
              <Badge variant="light" color="usfGreen" size="sm">
                tracker
              </Badge>
            </Group>
          </UnstyledButton>

          <Menu position="bottom-end" withArrow>
            <Menu.Target>
              <UnstyledButton>
                <Group gap="xs">
                  <Avatar color="usfGreen" radius="xl" size="sm">
                    {user?.display_name?.[0]?.toUpperCase() ?? "?"}
                  </Avatar>
                  <Text size="sm">{user?.display_name}</Text>
                  {user?.role === "admin" && (
                    <Badge size="xs" color="usfGold" c="dark.9">
                      admin
                    </Badge>
                  )}
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconUser size={16} />}
                onClick={() => navigate("/account")}
              >
                Account
              </Menu.Item>
              <Menu.Item
                leftSection={<IconBrandDiscord size={16} color={user?.discord_webhook_url ? "#5865F2" : undefined} />}
                onClick={() => navigate("/account")}
                rightSection={!user?.discord_webhook_url ? (
                  <Badge size="xs" color="orange">not set</Badge>
                ) : undefined}
              >
                Discord alerts
              </Menu.Item>
              {user?.role === "admin" && (
                <>
                  <Menu.Divider />
                  <Menu.Item
                    leftSection={<IconShieldLock size={16} />}
                    onClick={() => navigate("/admin")}
                  >
                    Admin
                  </Menu.Item>
                </>
              )}
              <Menu.Divider />
              <Menu.Item
                leftSection={<IconLogout size={16} />}
                onClick={async () => {
                  await signOut();
                  navigate("/");
                }}
              >
                Sign out
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Main>
        <Outlet />
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}
