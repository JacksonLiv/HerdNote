import { Center, Loader } from "@mantine/core";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { useAuth } from "./auth/AuthContext";
import { AdminPage } from "./pages/AdminPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EngagementPage } from "./pages/EngagementPage";
import { LoginPage } from "./pages/LoginPage";
import { SettingsPage } from "./pages/SettingsPage";
import { WizardPage } from "./pages/WizardPage";

export function App() {
  const { user, loading } = useAuth();

  if (loading)
    return (
      <Center mih="100vh" bg="dark.8">
        <Loader color="usfGreen" />
      </Center>
    );

  if (!user) return <LoginPage />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/new" element={<WizardPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/engagements/:id" element={<EngagementPage />} />
        <Route
          path="/engagements/:id/settings"
          element={<SettingsPage />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
