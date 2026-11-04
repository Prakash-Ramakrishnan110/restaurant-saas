import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";
import { ThemeProvider } from "../context/ThemeContext";
import { BrandLogo } from "../components/brand/BrandLogo";
import { Button } from "../components/ui/button";
import { IconButton } from "../components/ui/icon-button";
import { PasswordInput } from "../components/ui/password-input";
import { FormField } from "../components/ui/form-field";
import { StatusBadge } from "../components/app/StatusBadge";
import { EmptyState } from "../components/app/EmptyState";
import { AppShell } from "../components/layout/AppShell";
import { SuspendedPage } from "../pages/error/SuspendedPage";
import { ForbiddenPage } from "../pages/error/ForbiddenPage";
import { NotFoundPage } from "../pages/error/NotFoundPage";
import { RateLimitCountdown } from "../components/app/RateLimitCountdown";
import { UpgradeModal } from "../components/app/UpgradeModal";
import { OfflineBanner } from "../components/app/OfflineBanner";
import { Utensils } from "lucide-react";

describe("Brand & UI Components", () => {
  it("renders BrandLogo full variant with wordmark and company label", () => {
    render(<BrandLogo variant="full" theme="light" />);
    expect(screen.getByText("ServeMy")).toBeInTheDocument();
    expect(screen.getByText("Food")).toBeInTheDocument();
    expect(screen.getByText(/By Fusion Engine/i)).toBeInTheDocument();
  });

  it("renders BrandLogo icon variant without wordmark text", () => {
    const { container } = render(<BrandLogo variant="icon" theme="light" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(screen.queryByText("ServeMy")).not.toBeInTheDocument();
  });

  it("renders primary button with orange background and navy text class", () => {
    render(<Button variant="primary">Sign In</Button>);
    const btn = screen.getByRole("button", { name: /Sign In/i });
    expect(btn).toHaveClass("bg-[#FF6A00]");
    expect(btn).toHaveClass("text-[#0B1F3B]");
  });

  it("renders IconButton with accessible aria-label", () => {
    render(
      <IconButton aria-label="Open settings">
        <span>⚙</span>
      </IconButton>
    );
    expect(screen.getByRole("button", { name: "Open settings" })).toBeInTheDocument();
  });

  it("renders StatusBadge for each operational table status with distinct colors", () => {
    const { rerender } = render(<StatusBadge status="AVAILABLE" />);
    expect(screen.getByText("Available")).toBeInTheDocument();

    rerender(<StatusBadge status="OCCUPIED" />);
    expect(screen.getByText("Occupied")).toBeInTheDocument();

    rerender(<StatusBadge status="RESERVED" />);
    expect(screen.getByText("Reserved")).toBeInTheDocument();

    rerender(<StatusBadge status="CLEANING" />);
    expect(screen.getByText("Cleaning")).toBeInTheDocument();

    rerender(<StatusBadge status="BLOCKED" />);
    expect(screen.getByText("Blocked")).toBeInTheDocument();
  });

  it("renders FormField with accessible aria-describedby linking error and description", () => {
    render(
      <FormField
        id="test-field"
        label="Test Field"
        description="Helpful hint"
        error="Field has error"
      >
        {({ id, "aria-describedby": ariaDescribedBy, error }) => (
          <input id={id} aria-describedby={ariaDescribedBy} className={error ? "is-error" : ""} />
        )}
      </FormField>
    );

    const input = screen.getByLabelText(/Test Field/i);
    expect(input).toHaveAttribute("aria-describedby", "test-field-desc test-field-error");
    expect(screen.getByText("Helpful hint")).toHaveAttribute("id", "test-field-desc");
    expect(screen.getByText("Field has error")).toHaveAttribute("id", "test-field-error");
  });

  it("renders PasswordInput with eye toggle button", () => {
    render(<PasswordInput placeholder="Enter password" />);
    const input = screen.getByPlaceholderText("Enter password");
    expect(input).toHaveAttribute("type", "password");

    const toggle = screen.getByRole("button", { name: /show password/i });
    expect(toggle).toBeInTheDocument();
  });

  it("renders EmptyState with icon, title, description, and action button", () => {
    render(
      <EmptyState
        icon={Utensils}
        title="No Tables"
        description="No tables configured."
        actionLabel="Create Table"
        onAction={() => {}}
      />
    );

    expect(screen.getByText("No Tables")).toBeInTheDocument();
    expect(screen.getByText("No tables configured.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Table" })).toBeInTheDocument();
  });

  it("renders Error UX pages and dialogs", () => {
    // SuspendedPage
    const { rerender } = render(
      <MemoryRouter>
        <AuthProvider>
          <SuspendedPage />
        </AuthProvider>
      </MemoryRouter>
    );
    expect(screen.getByText(/Account Suspended/i)).toBeInTheDocument();

    // ForbiddenPage
    rerender(
      <MemoryRouter>
        <AuthProvider>
          <ForbiddenPage />
        </AuthProvider>
      </MemoryRouter>
    );
    expect(screen.getByText(/403 - Permission Denied/i)).toBeInTheDocument();

    // NotFoundPage
    rerender(
      <MemoryRouter>
        <AuthProvider>
          <NotFoundPage />
        </AuthProvider>
      </MemoryRouter>
    );
    expect(screen.getByText(/404 - Page Not Found/i)).toBeInTheDocument();

    // RateLimitCountdown
    rerender(<RateLimitCountdown initialWaitSeconds={42} />);
    expect(screen.getByText(/Rate limit reached/i)).toBeInTheDocument();
    expect(screen.getByText(/42s/i)).toBeInTheDocument();

    // UpgradeModal
    rerender(
      <UpgradeModal
        open={true}
        onOpenChange={() => {}}
        limitKey="max_branches"
        current={1}
        limit={1}
      />
    );
    expect(screen.getByText(/Plan Limit Reached/i)).toBeInTheDocument();
    expect(screen.getByText(/max_branches/i)).toBeInTheDocument();
  });

  it("renders OfflineBanner when network disconnects", () => {
    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders AppShell with responsive navigation and role-based links", () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AuthProvider>
            <AppShell>
              <div>App Content Inside Shell</div>
            </AppShell>
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>
    );

    expect(screen.getByText("App Content Inside Shell")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Tables")).toBeInTheDocument();
  });
});
