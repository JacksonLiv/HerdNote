import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { theme } from "./theme";

vi.mock("./api/client", () => ({
  setCsrf: vi.fn(),
  fetchMe: vi.fn().mockRejectedValue(new Error("401")),
  logout: vi.fn().mockResolvedValue(undefined),
  bootstrapStatus: vi.fn().mockResolvedValue({ needs_setup: false }),
  login: vi.fn(),
  registerFirstAdmin: vi.fn(),
}));

describe("App", () => {
  it("shows the CyberHerd login when unauthenticated", async () => {
    render(
      <MantineProvider theme={theme}>
        <QueryClientProvider client={new QueryClient()}>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </MantineProvider>,
    );
    expect(await screen.findByText("CyberHerd")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /sign in/i }),
    ).toBeInTheDocument();
  });
});
