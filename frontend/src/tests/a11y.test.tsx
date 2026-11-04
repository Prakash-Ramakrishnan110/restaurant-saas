import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LoginPage } from "../pages/auth/LoginPage";
import { ChangePasswordPage } from "../pages/auth/ChangePasswordPage";
import { DashboardPage } from "../pages/dashboard/DashboardPage";
import { DevDesignSystemPage } from "../pages/dev/DevDesignSystemPage";
import { AuthProvider } from "../context/AuthContext";
import { ThemeProvider } from "../context/ThemeContext";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <MemoryRouter>{ui}</MemoryRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe("Automated Accessibility Audits (vitest-axe)", () => {
  it("LoginPage has zero serious or critical accessibility violations", async () => {
    const { container } = renderWithProviders(<LoginPage />);
    const results = await axe(container);
    const seriousOrCritical = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(seriousOrCritical).toHaveLength(0);
  });

  it("ChangePasswordPage has zero serious or critical accessibility violations", async () => {
    const { container } = renderWithProviders(<ChangePasswordPage />);
    const results = await axe(container);
    const seriousOrCritical = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(seriousOrCritical).toHaveLength(0);
  });

  it("DashboardPage has zero serious or critical accessibility violations", async () => {
    const { container } = renderWithProviders(<DashboardPage />);
    const results = await axe(container);
    const seriousOrCritical = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(seriousOrCritical).toHaveLength(0);
  });

  it("DevDesignSystemPage has zero serious or critical accessibility violations", async () => {
    const { container } = renderWithProviders(<DevDesignSystemPage />);
    const results = await axe(container);
    const seriousOrCritical = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(seriousOrCritical).toHaveLength(0);
  });
});
