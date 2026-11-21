import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MenuTranslationsPage } from "../pages/menu/MenuTranslationsPage";
import { AuthProvider } from "../context/AuthContext";
import { ThemeProvider } from "../context/ThemeContext";
import { apiClient } from "../api/client";

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

describe("Stage B: Menu Tools (Translations Editor & A11y)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiClient, "get").mockResolvedValue({
      data: {
        language: "ta",
        provider_available: false,
        languages: [
          {
            code: "en",
            english_name: "English",
            native_name: "English",
            direction: "ltr",
            chrome_ready: true,
          },
          {
            code: "ta",
            english_name: "Tamil",
            native_name: "தமிழ்",
            direction: "ltr",
            chrome_ready: true,
          },
          {
            code: "ar",
            english_name: "Arabic",
            native_name: "العربية",
            direction: "rtl",
            chrome_ready: false,
          },
        ],
        entries: [
          {
            id: "tr-1",
            entity_type: "ITEM",
            entity_id: "item-1",
            entity_label: "Item: Masala Dosa",
            language: "ta",
            field: "name",
            original_text: "Masala Dosa",
            text: "மசாலா தோசை",
            status: "PUBLISHED",
            source: "MANUAL",
          },
        ],
      },
    } as any);
  });

  it("renders Menu Translations editor with manual fallback notice and 0 serious/critical axe violations", async () => {
    const { container } = renderWithProviders(<MenuTranslationsPage />);
    expect(await screen.findByText("Menu Translations")).toBeInTheDocument();
    expect(
      await screen.findByText(
        /Automatic suggestions are not set up\. You can type translations yourself\./i
      )
    ).toBeInTheDocument();
    expect(await screen.findByText("Masala Dosa")).toBeInTheDocument();

    const results = await axe(container);
    const seriousOrCritical = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(seriousOrCritical).toHaveLength(0);
  });
});
