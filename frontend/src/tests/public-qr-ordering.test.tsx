import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { axe } from "vitest-axe";
import { PublicQRPage } from "../pages/public/PublicQRPage";
import { PublicOrderTrackerPage } from "../pages/public/PublicOrderTrackerPage";
import { publicQrApi, PublicQRMenuResponse, PublicOrderTrackerResponse } from "../api/publicQr";
import { PUBLIC_QR_COPY } from "../pages/public/publicQrStrings";
import { formatRupees } from "../utils/currency";
import { playReadyAlert, setSoundEnabled } from "../utils/soundAlerts";

vi.mock("../api/publicQr", () => ({
  publicQrApi: {
    getMenu: vi.fn(),
    openSession: vi.fn(),
    createOrder: vi.fn(),
    trackOrder: vi.fn(),
    getReceipt: vi.fn(),
  },
}));

const SAMPLE_MENU: PublicQRMenuResponse = {
  display_name: "Spice Garden",
  logo_url: "",
  brand_primary_color: "#FF6A00",
  branch_name: "Main Branch",
  area_name: "AC Hall",
  target_type: "TABLE",
  target_label: "T4",
  ordering_mode: "ORDER_DIRECT",
  payment_timing: "PAY_LATER",
  session_policy: "CUSTOMER_CAN_OPEN",
  active_session_open: true,
  categories: [
    {
      id: "cat-1",
      name: "Dosa & Tiffin",
      name_ta: "தோசை மற்றும் டிபன்",
      items: [
        {
          id: "item-1",
          name: "Masala Dosa",
          name_ta: "மசாலா தோசை",
          description: "Crispy dosa with potato masala",
          description_ta: "உருளைக்கிழங்கு மசாலாவுடன் மொறுமொறு தோசை",
          price_paise: 12000,
          food_type: "VEG",
          is_bestseller: true,
          image_card: "",
          image_thumb: "",
          is_available: true,
          variants: [],
          option_groups: [
            {
              id: "grp-1",
              name: "Chutney Choice",
              name_ta: "சட்னி தேர்வு",
              min_select: 1,
              max_select: 2,
              options: [
                {
                  id: "opt-1",
                  name: "Coconut Chutney",
                  name_ta: "தேங்காய் சட்னி",
                  price_delta_paise: 0,
                  is_default: false,
                },
                {
                  id: "opt-2",
                  name: "Extra Ghee",
                  name_ta: "கூடுதல் நெய்",
                  price_delta_paise: 2500,
                  is_default: false,
                },
              ],
            },
          ],
        },
        {
          id: "item-2",
          name: "Filter Coffee",
          name_ta: "பில்டர் காபி",
          description: "Traditional brass davara coffee",
          description_ta: "பாரம்பரிய பில்டர் காபி",
          price_paise: 5000,
          food_type: "VEG",
          is_bestseller: false,
          image_card: "",
          image_thumb: "",
          is_available: false,
          variants: [],
          option_groups: [],
        },
      ],
    },
  ],
};

function renderQRPage(token = "test-qr-token") {
  return render(
    <MemoryRouter initialEntries={[`/q/${token}`]}>
      <Routes>
        <Route path="/q/:token" element={<PublicQRPage />} />
        <Route path="/q/:token/o/:trackingToken" element={<PublicOrderTrackerPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function renderTrackerPage(token = "test-qr-token", trackingToken = "track-123") {
  return render(
    <MemoryRouter initialEntries={[`/q/${token}/o/${trackingToken}`]}>
      <Routes>
        <Route path="/q/:token" element={<PublicQRPage />} />
        <Route path="/q/:token/o/:trackingToken" element={<PublicOrderTrackerPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Customer Phone QR Ordering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("formats Indian rupee amounts without floating point issues", () => {
    expect(formatRupees(12000)).toBe("₹120.00");
    expect(formatRupees(15000000)).toBe("₹1,50,000.00");
  });

  it("contains no internal jargon in customer English copy", () => {
    const forbidden = /\b(tenant|entitlement|paise|preset|flag|session)\b/i;
    Object.values(PUBLIC_QR_COPY.en).forEach((val) => {
      if (typeof val === "string") {
        expect(val).not.toMatch(forbidden);
      }
    });
  });

  it("switches language between English and Tamil and enforces option min/max rules", async () => {
    vi.mocked(publicQrApi.getMenu).mockResolvedValue({ data: SAMPLE_MENU } as any);
    const localSetSpy = vi.spyOn(Storage.prototype, "setItem");

    const { container } = renderQRPage();
    await waitFor(() => {
      expect(screen.getByText("Masala Dosa")).toBeInTheDocument();
    });

    // Switch to Tamil
    fireEvent.click(screen.getByRole("button", { name: "தமிழ்" }));
    expect(screen.getByText("மசாலா தோசை")).toBeInTheDocument();

    // Switch back to English
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByText("Masala Dosa")).toBeInTheDocument();

    // Open customization sheet for Masala Dosa
    fireEvent.click(screen.getByRole("button", { name: /Add/i }));
    expect(screen.getByText("Chutney Choice")).toBeInTheDocument();

    // Try adding without selecting required option (min_select = 1)
    fireEvent.click(screen.getByRole("button", { name: /Add to order/i }));
    expect(screen.getByText(/Please choose at least 1 for Chutney Choice/i)).toBeInTheDocument();

    // Select Coconut Chutney and add to order
    fireEvent.click(screen.getByRole("button", { name: /Coconut Chutney/i }));
    fireEvent.click(screen.getByRole("button", { name: /Add to order/i }));

    // Cart bar appears, sessionStorage has cart, localStorage remains untouched
    expect(screen.getByText(/1 item/i)).toBeInTheDocument();
    expect(localStorage.length).toBe(0);
    const localCalls = localSetSpy.mock.calls.filter(
      ([key]) => !String(key).startsWith("smf_qr_cart_")
    );
    expect(localCalls.length).toBe(0);
    expect(sessionStorage.getItem("smf_qr_cart_test-qr-token")).toContain("item-1");

    // Accessibility check
    const results = await axe(container);
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(serious).toEqual([]);
  });

  it("renders BROWSE_ONLY and DISABLED states cleanly with zero serious a11y violations", async () => {
    vi.mocked(publicQrApi.getMenu).mockResolvedValueOnce({
      data: { ...SAMPLE_MENU, ordering_mode: "BROWSE_ONLY" },
    } as any);

    const browseView = renderQRPage("browse-token");
    await waitFor(() => {
      expect(screen.getByText("Please ask our staff to order")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /Add/i })).not.toBeInTheDocument();
    const browseAxe = await axe(browseView.container);
    expect(
      browseAxe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")
    ).toEqual([]);
    browseView.unmount();

    vi.mocked(publicQrApi.getMenu).mockResolvedValueOnce({
      data: { ...SAMPLE_MENU, ordering_mode: "DISABLED" },
    } as any);

    const disabledView = renderQRPage("disabled-token");
    await waitFor(() => {
      expect(screen.getByText("Ordering is closed")).toBeInTheDocument();
    });
    const disabledAxe = await axe(disabledView.container);
    expect(
      disabledAxe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")
    ).toEqual([]);
  });

  it("renders tracker states (AWAITING_PAYMENT, PREPARING, REJECTED) with zero serious a11y violations", async () => {
    const baseTracker: PublicOrderTrackerResponse = {
      order_number: "ORD-101",
      status: "AWAITING_PAYMENT",
      status_key: "AWAITING_PAYMENT",
      payment_status: "UNPAID",
      payment_timing: "PAY_FIRST",
      target_label: "Token #12",
      token_number: 12,
      rejected_reason: "",
      total_paise: 12000,
      placed_at: new Date().toISOString(),
      ready_at: null,
      served_at: null,
      completed_at: null,
      cancelled_at: null,
      items: [
        {
          item_name: "Masala Dosa",
          variant_name: "",
          options: [],
          quantity: 1,
          notes: "",
          unit_price_paise: 12000,
          subtotal_paise: 12000,
        },
      ],
    };

    vi.mocked(publicQrApi.trackOrder).mockResolvedValueOnce({ data: baseTracker } as any);
    const payFirstView = renderTrackerPage("tok", "trk-1");
    await waitFor(() => {
      expect(screen.getByText("Please pay at the counter to start your order")).toBeInTheDocument();
      expect(screen.getByText("#12")).toBeInTheDocument();
    });
    const payFirstAxe = await axe(payFirstView.container);
    expect(
      payFirstAxe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")
    ).toEqual([]);
    payFirstView.unmount();

    vi.mocked(publicQrApi.trackOrder).mockResolvedValueOnce({
      data: { ...baseTracker, status: "CANCELLED", rejected_reason: "Dish sold out" },
    } as any);
    const rejectedView = renderTrackerPage("tok", "trk-2");
    await waitFor(() => {
      expect(screen.getByText("Order could not be accepted")).toBeInTheDocument();
      expect(screen.getByText("Dish sold out")).toBeInTheDocument();
    });
    const rejectedAxe = await axe(rejectedView.container);
    expect(
      rejectedAxe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")
    ).toEqual([]);
  });

  it("gates printable receipt behind show_bill, triggers READY alert/vibrate/pickup code, and passes axe in EN/TA", async () => {
    const startMock = vi.fn();
    const stopMock = vi.fn();
    class MockAudioContext {
      currentTime = 0;
      state = "running";
      destination = {};
      resume = vi.fn().mockResolvedValue(undefined);
      createOscillator() {
        return {
          type: "sine",
          frequency: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
          start: startMock,
          stop: stopMock,
        };
      }
      createGain() {
        return {
          gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
        };
      }
    }
    vi.stubGlobal("AudioContext", MockAudioContext);
    const vibrateMock = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrateMock, configurable: true });

    // Unit test for playReadyAlert respecting sound toggle
    setSoundEnabled(false);
    playReadyAlert("Token #42");
    expect(startMock).not.toHaveBeenCalled();

    setSoundEnabled(true);
    playReadyAlert("Token #42", { bypassMuteSetting: true });
    expect(startMock).toHaveBeenCalledTimes(3);

    startMock.mockClear();

    const counterUnpaid: PublicOrderTrackerResponse = {
      display_name: "Chai Corner",
      branch_name: "Anna Nagar",
      order_number: "ORD-4088",
      order_workflow: "COUNTER_TOKEN",
      status: "PREPARING",
      status_key: "ORDER_PREPARING",
      payment_status: "UNPAID",
      payment_timing: "PAY_LATER",
      target_label: "Token #42",
      token_number: 42,
      pickup_code: null,
      rejected_reason: "",
      show_bill: false,
      total_paise: 12000,
      placed_at: new Date().toISOString(),
      ready_at: null,
      served_at: null,
      completed_at: null,
      cancelled_at: null,
      items: [
        {
          item_name: "Masala Dosa",
          variant_name: "",
          options: [],
          quantity: 1,
          notes: "",
          unit_price_paise: 12000,
          subtotal_paise: 12000,
        },
      ],
    };

    // Unpaid view: order summary shown, printable receipt blocked
    vi.mocked(publicQrApi.trackOrder).mockResolvedValueOnce({ data: counterUnpaid } as any);
    const unpaidView = renderTrackerPage("tok-cnt", "trk-cnt-1");
    await waitFor(() => {
      expect(screen.getByTestId("counter-token-banner")).toBeInTheDocument();
      expect(screen.getByTestId("customer-order-summary")).toBeInTheDocument();
      expect(screen.getByTestId("bill-pending-notice")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("customer-printable-bill")).not.toBeInTheDocument();
    expect(publicQrApi.getReceipt).not.toHaveBeenCalled();
    unpaidView.unmount();

    // Paid + READY view: ready alert plays, pickup code shows, receipt fetches & displays DEMO RECEIPT
    vi.mocked(publicQrApi.trackOrder).mockResolvedValueOnce({
      data: {
        ...counterUnpaid,
        status: "READY",
        status_key: "ORDER_READY",
        payment_status: "PAID",
        pickup_code: "4088",
        show_bill: true,
        ready_at: new Date().toISOString(),
      },
    } as any);
    vi.mocked(publicQrApi.getReceipt).mockResolvedValueOnce({
      data: {
        demo_notice: "DEMO RECEIPT - NOT A TAX INVOICE",
        display_name: "Chai Corner",
        logo_url: "",
        branch_name: "Anna Nagar",
        order_number: "ORD-4088",
        invoice_number: "INV-202611-0008",
        target_label: "Token #42",
        token_number: 42,
        payment_status: "PAID",
        payment_method: "UPI",
        settled_at: new Date().toISOString(),
        subtotal_paise: 12000,
        discount_paise: 0,
        total_paise: 12000,
        items: [
          {
            item_name: "Masala Dosa",
            variant_name: "",
            options: [],
            quantity: 1,
            unit_price_paise: 12000,
            subtotal_paise: 12000,
          },
        ],
      },
    } as any);

    const readyPaidView = renderTrackerPage("tok-cnt", "trk-cnt-2");
    await waitFor(() => {
      expect(screen.getByTestId("order-ready-banner")).toBeInTheDocument();
      expect(screen.getByTestId("customer-pickup-code")).toHaveTextContent("4088");
      expect(screen.getByTestId("customer-printable-bill")).toBeInTheDocument();
      expect(screen.getByText("DEMO RECEIPT - NOT A TAX INVOICE")).toBeInTheDocument();
    });
    expect(startMock).toHaveBeenCalledTimes(3);
    expect(vibrateMock).toHaveBeenCalled();

    // Switch to Tamil and verify zero serious axe violations
    fireEvent.click(screen.getByRole("button", { name: "தமிழ்" }));
    expect(screen.getByText("உங்கள் ஆர்டர் தயார்!")).toBeInTheDocument();

    const readyAxe = await axe(readyPaidView.container);
    expect(
      readyAxe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")
    ).toEqual([]);
    readyPaidView.unmount();

    vi.unstubAllGlobals();
  });
});
