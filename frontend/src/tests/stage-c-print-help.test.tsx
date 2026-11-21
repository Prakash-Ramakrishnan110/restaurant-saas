import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DeviceSettingsPage } from "../pages/settings/DeviceSettingsPage";
import { HelpCenterPage } from "../pages/help/HelpCenterPage";
import { AuthProvider } from "../context/AuthContext";
import { ThemeProvider } from "../context/ThemeContext";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithProviders = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <MemoryRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            {ui}
          </MemoryRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );

describe("Stage C: Printer Setup Wizard & Help Center", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders 5-step Guided Printer Setup Wizard with interactive checkboxes and 0 axe violations", async () => {
    const { container } = renderWithProviders(<DeviceSettingsPage />);
    expect(await screen.findByText("Guided Thermal Printer Setup Wizard")).toBeInTheDocument();
    expect(screen.getByText(/--kiosk-printing/i)).toBeInTheDocument();

    const firstCheckbox = screen
      .getAllByRole("checkbox")
      .find((el) => el.closest("label")?.textContent?.includes("1. Connect the printer"));
    expect(firstCheckbox).toBeDefined();
    if (firstCheckbox) {
      fireEvent.click(firstCheckbox);
      expect(screen.getByText(/1\. Connect the printer — I did this/i)).toBeInTheDocument();
    }

    const results = await axe(container);
    const seriousOrCritical = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(seriousOrCritical).toHaveLength(0);
  });

  it("renders Help Center guides, search, keyboard shortcuts, and 0 axe violations", async () => {
    const { container } = renderWithProviders(<HelpCenterPage />);
    expect(await screen.findByText("Help Center & Guides")).toBeInTheDocument();

    const searchInput = screen.getByLabelText("Search help guides");
    fireEvent.change(searchInput, { target: { value: "printer" } });
    expect(screen.getByText(/Thermal Printer Setup/i)).toBeInTheDocument();

    const results = await axe(container);
    const seriousOrCritical = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(seriousOrCritical).toHaveLength(0);
  });
});
