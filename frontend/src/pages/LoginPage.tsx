import {
  Alert,
  Button,
  Card,
  Center,
  Image,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { bootstrapStatus, login, registerFirstAdmin } from "../api/client";
import logo from "../assets/logo.jpg";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const setup = useQuery({ queryKey: ["bootstrap"], queryFn: bootstrapStatus });

  const form = useForm({
    initialValues: { username: "", password: "", display_name: "" },
    validate: {
      username: (v) => (v.length < 3 ? "Min 3 characters" : null),
      password: (v) => (v.length < 8 ? "Min 8 characters" : null),
    },
  });

  const needsSetup = setup.data?.needs_setup === true;

  const submit = form.onSubmit(async (values) => {
    setError(null);
    try {
      if (needsSetup) {
        await registerFirstAdmin({
          username: values.username,
          password: values.password,
          display_name: values.display_name || values.username,
        });
      }
      const me = await login({
        username: values.username,
        password: values.password,
      });
      setUser(me);
      navigate("/");
    } catch (e: unknown) {
      setError(
        needsSetup ? "Setup failed — try a different username." : "Invalid credentials.",
      );
      void e;
    }
  });

  return (
    <Center mih="100vh" bg="dark.8">
      <Card shadow="xl" padding="xl" radius="lg" w={420} withBorder>
        <form onSubmit={submit}>
          <Stack align="center" gap="md">
            <Image src={logo} alt="CyberHerd" w={64} h={64} />
            <Title order={2}>CyberHerd</Title>
            <Text c="dimmed" size="sm" ta="center">
              {needsSetup
                ? "First run — create the initial admin account."
                : "Sign in to the engagement tracker."}
            </Text>
            {error && (
              <Alert color="red" w="100%">
                {error}
              </Alert>
            )}
            <TextInput
              label="Username"
              w="100%"
              {...form.getInputProps("username")}
            />
            {needsSetup && (
              <TextInput
                label="Display name"
                w="100%"
                {...form.getInputProps("display_name")}
              />
            )}
            <PasswordInput
              label="Password"
              w="100%"
              {...form.getInputProps("password")}
            />
            <Button
              type="submit"
              color="usfGold"
              c="dark.9"
              fullWidth
              loading={setup.isLoading}
            >
              {needsSetup ? "Create admin & continue" : "Sign in"}
            </Button>
          </Stack>
        </form>
      </Card>
    </Center>
  );
}
