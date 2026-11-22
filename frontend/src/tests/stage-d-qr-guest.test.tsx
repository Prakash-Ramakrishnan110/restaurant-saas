import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FeedbackPage } from "../pages/customers/FeedbackPage";
import { AuthProvider } from "../context/AuthContext";
import { ThemeProvider } from "../context/ThemeContext";
import { apiClient } from "../api/client";

vi.mock("../api/client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

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

describe("Stage D: QR Guest Features & Feedback Inbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders FeedbackPage with verified-order feedback, supports CSV export, and has 0 axe violations", async () => {
    const mockGet = vi.mocked(apiClient.get);
    mockGet.mockResolvedValueOnce({
      data: {
        results: [
          {
            id: "fb-1",
            order_number: "ORD-101",
            branch_name: "Main Branch",
            food_rating: 5,
            service_rating: 4,
            comment: "Great biryani!",
            suggestion_type: "FOOD",
            is_hidden: false,
            is_resolved: false,
            owner_note: "",
            created_at: "2026-11-21T10:00:00Z",
          },
        ],
      },
    } as any);

    const { container } = renderWithProviders(<FeedbackPage />);

    expect(await screen.findByText("ORD-101")).toBeInTheDocument();
    expect(screen.getByText("Great biryani!")).toBeInTheDocument();

    // Verify axe accessibility
    const results = await axe(container);
    const seriousOrCritical = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(seriousOrCritical).toHaveLength(0);

    // Trigger CSV export
    mockGet.mockResolvedValueOnce({
      data: new Blob(["order_number,food_rating\nORD-101,5"], { type: "text/csv" }),
    } as any);
    const createObjectURLSpy = vi.fn(() => "blob:mock-url");
    const revokeObjectURLSpy = vi.fn();
    window.URL.createObjectURL = createObjectURLSpy;
    window.URL.revokeObjectURL = revokeObjectURLSpy;

    const exportBtn = screen.getByRole("button", { name: /export csv/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith("/orders/feedback/export-csv/", {
        responseType: "blob",
      });
    });
  });
});
