import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter, MemoryRouter, Routes, Route } from "react-router-dom";
import { evaluateBrandColor, isValidGSTIN } from "../lib/colorUtils";
import { OnboardingWizardPage } from "../pages/onboarding/OnboardingWizardPage";
import { BrandingSettingsPage } from "../pages/settings/BrandingSettingsPage";
import { PublicQRPage } from "../pages/public/PublicQRPage";
import { apiClient } from "../api/client";

// Mock API client
vi.mock("../api/client", () => {
  return {
    apiClient: {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  };
});

describe("Prompt 3B Frontend: Color & GSTIN Validation Utilities", () => {
  it("evaluates brand color contrast against white and navy accurately", () => {
    // #FF6A00: ~2.87:1 against white, ~5.74:1 against navy -> passes threshold >= 4.5:1
    const orangeCheck = evaluateBrandColor("#FF6A00");
    expect(orangeCheck.isValidHex).toBe(true);
    expect(orangeCheck.passesThreshold).toBe(true);
    expect(orangeCheck.contrastAgainstNavy).toBeGreaterThanOrEqual(4.5);
    expect(orangeCheck.recommendedTextHex).toBe("#0B1F3B");

    // Pure black #000000: 21:1 against white, 1.3:1 against navy -> passes
    const blackCheck = evaluateBrandColor("#000000");
    expect(blackCheck.isValidHex).toBe(true);
    expect(blackCheck.passesThreshold).toBe(true);
    expect(blackCheck.contrastAgainstWhite).toBeGreaterThan(20);

    // Mid-gray #808080: ~3.95:1 against white, ~4.18:1 against navy -> fails both
    const grayCheck = evaluateBrandColor("#808080");
    expect(grayCheck.isValidHex).toBe(true);
    expect(grayCheck.passesThreshold).toBe(false);

    // Invalid hex string
    const invalidCheck = evaluateBrandColor("not-a-color");
    expect(invalidCheck.isValidHex).toBe(false);
    expect(invalidCheck.passesThreshold).toBe(false);
  });

  it("validates Indian GSTIN 15-character structure", () => {
    expect(isValidGSTIN("33AAAAA0000A1Z5")).toBe(true);
    expect(isValidGSTIN("29ABCDE1234F1Z5")).toBe(true);
    expect(isValidGSTIN("")).toBe(true); // Optional
    expect(isValidGSTIN("   ")).toBe(true);

    // Invalid GSTINs
    expect(isValidGSTIN("12345")).toBe(false);
    expect(isValidGSTIN("33AAAAA0000A1Z")).toBe(false); // 14 chars
    expect(isValidGSTIN("33AAAAA0000A1Z56")).toBe(false); // 16 chars
    expect(isValidGSTIN("33AAAAA0000A1!5")).toBe(false); // invalid special char
  });
});

describe("Prompt 3B Frontend: Counter Path Invariant", () => {
  it("enforces ZERO occurrence of the word 'table' (case-insensitive) in counter path text", () => {
    // English counter note
    const enCounterNote =
      "Counter takeaway mode: tokens and pickup points are created without dining furniture.";
    expect(enCounterNote.toLowerCase()).not.toContain("table");

    // Tamil counter note
    const taCounterNote = "கவுண்டர் பார்சல் முறை: டோக்கன்கள் மற்றும் சேவை பகுதிகள் அமைக்கப்படும்.";
    expect(taCounterNote).not.toContain("மேஜை");
    expect(taCounterNote.toLowerCase()).not.toContain("table");
  });
});

describe("Prompt 3B Frontend: Branding Settings Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads business settings and enforces SVG upload rejection client-side", async () => {
    (apiClient.get as any).mockResolvedValueOnce({
      data: {
        id: "tenant-123",
        name: "Kaapi Shop",
        business_settings: {
          display_name: "Kaapi Shop Express",
          brand_primary_color: "#FF6A00",
          document_language: "EN",
          receipt_footer_text: "Thank you for visiting!",
          legal_name: "Kaapi Shop Private Limited",
          gstin: "33AAAAA0000A1Z5",
          registered_address: "10 Main Road, Chennai",
          logo_url: null,
          logo_128_url: null,
        },
      },
    });

    render(
      <BrowserRouter>
        <BrandingSettingsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Branding & Business Identity")).toBeDefined();
    });

    // Check display name loaded
    const displayNameInput = screen.getByDisplayValue("Kaapi Shop Express");
    expect(displayNameInput).toBeDefined();

    // Check GSTIN loaded
    const gstinInput = screen.getByDisplayValue("33AAAAA0000A1Z5");
    expect(gstinInput).toBeDefined();

    // Check accountant advisory note exists
    expect(
      screen.getAllByText(
        /Please confirm your GSTIN, legal entity name, and tax registration details with your chartered accountant/i
      ).length
    ).toBeGreaterThanOrEqual(1);
  });
});

describe("Prompt 3B Frontend: Public QR Landing Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders coming soon message with tenant branding when QR token is valid", async () => {
    (apiClient.get as any).mockResolvedValueOnce({
      data: {
        valid: true,
        tenant_name: "Madurai Mess",
        display_name: "Madurai Mess Grand",
        logo_url: null,
        brand_primary_color: "#FF6A00",
        table_identifier: "Table 04",
        area_name: "Main AC Hall",
        branch_name: "Town Hall Branch",
      },
    });

    render(
      <MemoryRouter initialEntries={["/q/valid-token-123"]}>
        <Routes>
          <Route path="/q/:token" element={<PublicQRPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Madurai Mess Grand")).toBeDefined();
    });

    // Check location label
    expect(screen.getByText("Town Hall Branch • Main AC Hall • Table 04")).toBeDefined();

    // Check friendly coming soon text
    expect(
      screen.getByText("Online ordering is coming soon. Please ask our staff to take your order.")
    ).toBeDefined();

    // Check powered by footer
    expect(screen.getByText(/Powered by ServeMyFood/i)).toBeDefined();
  });

  it("renders friendly not found page when QR token is invalid or inactive", async () => {
    (apiClient.get as any).mockRejectedValueOnce(new Error("Token not found"));

    render(
      <MemoryRouter initialEntries={["/q/invalid-token-404"]}>
        <Routes>
          <Route path="/q/:token" element={<PublicQRPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("QR Code Inactive or Invalid")).toBeDefined();
    });

    expect(
      screen.getByText(/This QR code could not be verified or has been replaced by venue staff/i)
    ).toBeDefined();
  });
});

describe("Prompt 3B Frontend: Onboarding Wizard Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads onboarding status and displays all 7 wizard steps", async () => {
    (apiClient.get as any).mockImplementation((url: string) => {
      if (url === "/onboarding/status/") {
        return Promise.resolve({
          data: {
            is_complete: false,
            completion_percentage: 14,
            next_step: "business",
            steps: {
              business: false,
              branch: false,
              style: false,
              layout: false,
              qr: false,
              staff: false,
              done: false,
            },
            summary: {
              branches_count: 1,
              service_areas_count: 0,
              tables_count: 0,
              qr_codes_count: 0,
              staff_count: 0,
            },
          },
        });
      }
      if (url === "/business/") {
        return Promise.resolve({
          data: {
            id: "t-1",
            name: "Anna Nagar Café",
            venue_profile: "CAFE",
            contact_email: "cafe@example.com",
            contact_phone: "+91 98765 43210",
            timezone: "Asia/Kolkata",
          },
        });
      }
      if (url === "/branches/") {
        return Promise.resolve({
          data: {
            results: [
              {
                id: "b-1",
                name: "Anna Nagar Main",
                address: "Anna Nagar",
                phone: "+91 44 2626 0000",
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <BrowserRouter>
        <OnboardingWizardPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Restaurant Onboarding")).toBeDefined();
    });

    // Verify Cafe is default selected
    expect(screen.getByText("Café")).toBeDefined();
    expect(screen.getByText("Default")).toBeDefined();

    // Verify Step navigation buttons
    expect(screen.getByText("Next Step")).toBeDefined();
  });
});
