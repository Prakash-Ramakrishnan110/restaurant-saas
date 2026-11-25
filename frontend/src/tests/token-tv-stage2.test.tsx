import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { axe } from "vitest-axe";
import { PublicTokenTVPage } from "../pages/public/PublicTokenTVPage";
import { TokenSlipModal } from "../components/orders/TokenSlipModal";
import { publicQrApi } from "../api/publicQr";
import * as soundAlerts from "../utils/soundAlerts";

vi.mock("../api/publicQr", async () => {
  const actual = await vi.importActual<typeof import("../api/publicQr")>("../api/publicQr");
  return {
    ...actual,
    publicQrApi: {
      ...actual.publicQrApi,
      getTokenTV: vi.fn(),
    },
  };
});

describe("Stage 2: Token Slip, Token TV & Call", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders TokenSlipModal with server token number and strict non-tax label", () => {
    const { container } = render(
      <TokenSlipModal
        open={true}
        onOpenChange={() => {}}
        restaurantName="Madras Chai Point"
        branchName="T. Nagar Counter"
        order={{
          order_number: "ORD-202611-0001",
          token_number: 42,
          placed_at: "2026-11-25T09:00:00Z",
          items: [{ item_name: "Filter Coffee", quantity: 2 }],
        }}
      />
    );

    expect(screen.getByTestId("token-slip-number")).toHaveTextContent("#42");
    expect(screen.getByText(/TOKEN SLIP - NOT A TAX INVOICE/i)).toBeInTheDocument();
    expect(screen.getByText(/2x Filter Coffee/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/CGST|SGST|GST/i);
  });

  it("renders PublicTokenTVPage in EN and Tamil, supports dark/light toggle, and passes axe", async () => {
    vi.mocked(publicQrApi.getTokenTV).mockResolvedValue({
      data: {
        display_name: "Madras Chai Point",
        branch_name: "T. Nagar",
        logo_url: "",
        brand_primary_color: "#FF6A00",
        qr_token: "tok-tv-demo",
        server_time: "2026-11-25T09:00:00Z",
        now_calling: {
          token_number: 18,
          order_number: "ORD-202611-0018",
          status: "READY",
          call_count: 2,
          last_called_at: "2026-11-25T09:00:00Z",
          ready_at: "2026-11-25T08:59:00Z",
        },
        ready_tokens: [
          {
            token_number: 18,
            order_number: "ORD-202611-0018",
            status: "READY",
            call_count: 2,
            last_called_at: "2026-11-25T09:00:00Z",
            ready_at: "2026-11-25T08:59:00Z",
          },
        ],
        preparing_tokens: [
          {
            token_number: 19,
            order_number: "ORD-202611-0019",
            status: "PREPARING",
            call_count: 0,
            last_called_at: null,
            ready_at: null,
          },
        ],
      },
    } as never);

    const { container } = render(
      <MemoryRouter initialEntries={["/tv/tok-tv-demo"]}>
        <Routes>
          <Route path="/tv/:token" element={<PublicTokenTVPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByTestId("tv-now-calling")).toBeInTheDocument());
    expect(screen.getByTestId("tv-now-calling")).toHaveTextContent("#18");
    expect(screen.getByTestId("tv-ready-token-18")).toBeInTheDocument();
    expect(screen.getByTestId("tv-preparing-token-19")).toBeInTheDocument();

    // Switch to Tamil
    fireEvent.click(screen.getByTestId("tv-lang-toggle"));
    expect(screen.getByText(/தற்போது அழைக்கப்படுகிறது/)).toBeInTheDocument();

    // Switch sound toggle triggers chime/voice helper
    const spyAlert = vi.spyOn(soundAlerts, "playTokenCallAlert");
    fireEvent.click(screen.getByTestId("tv-sound-toggle"));
    fireEvent.click(screen.getByTestId("tv-sound-toggle"));
    expect(spyAlert).toHaveBeenCalledWith(18, "TA", expect.any(Object));

    const results = await axe(container);
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(serious).toHaveLength(0);
  });

  it("shows generic unavailable state on invalid Token TV link", async () => {
    vi.mocked(publicQrApi.getTokenTV).mockRejectedValue(new Error("404"));

    render(
      <MemoryRouter initialEntries={["/tv/invalid-token"]}>
        <Routes>
          <Route path="/tv/:token" element={<PublicTokenTVPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByTestId("tv-unavailable")).toBeInTheDocument());
    expect(screen.getByText("Display unavailable")).toBeInTheDocument();
  });
});
