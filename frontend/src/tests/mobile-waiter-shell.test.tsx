import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Utensils } from "lucide-react";
import { MobileBottomNav } from "../components/layout/MobileBottomNav";
import { MobileMoreSheet } from "../components/layout/MobileMoreSheet";
import { triggerLiveSync, useLiveSync } from "../realtime/liveSync";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

const LiveSyncHarness: React.FC<{ onSync: () => void }> = ({ onSync }) => {
  useLiveSync(onSync);
  return <div data-testid="live-sync-harness" />;
};

describe("Waiter Mobile App Shell & Live Sync", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders Waiter bottom navigation tabs with live badges and More button", () => {
    const onOpenMore = vi.fn();
    render(
      <MemoryRouter initialEntries={["/floor"]}>
        <MobileBottomNav
          role="WAITER"
          allowsRoomService={false}
          readyCount={4}
          liveOrdersCount={7}
          onOpenMore={onOpenMore}
          moreOpen={false}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Floor POS")).toBeInTheDocument();
    expect(screen.getByText("Orders")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("More")).toBeInTheDocument();

    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();

    fireEvent.click(screen.getByText("More"));
    expect(onOpenMore).toHaveBeenCalledTimes(1);
  });

  it("renders MobileMoreSheet All Options, quick toggles, navGroups, and sign out", () => {
    const onClose = vi.fn();
    const onToggleTheme = vi.fn();
    const onToggleSound = vi.fn();
    const onToggleLanguage = vi.fn();
    const onLogout = vi.fn();

    const { rerender } = render(
      <MemoryRouter>
        <MobileMoreSheet
          open={false}
          onClose={onClose}
          navGroups={[]}
          userName="Arjun Waiter"
          roleLabel="Waiter"
          isDark={false}
          onToggleTheme={onToggleTheme}
          soundOn={true}
          onToggleSound={onToggleSound}
          onToggleLanguage={onToggleLanguage}
          onLogout={onLogout}
        />
      </MemoryRouter>
    );

    expect(screen.queryByTestId("mobile-more-sheet")).toBeNull();

    rerender(
      <MemoryRouter>
        <MobileMoreSheet
          open={true}
          onClose={onClose}
          navGroups={[
            {
              label: "Operations",
              items: [
                {
                  label: "Table Floor",
                  path: "/floor",
                  icon: Utensils,
                },
              ],
            },
          ]}
          userName="Arjun Waiter"
          roleLabel="Waiter"
          isDark={false}
          onToggleTheme={onToggleTheme}
          soundOn={true}
          onToggleSound={onToggleSound}
          onToggleLanguage={onToggleLanguage}
          onLogout={onLogout}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId("mobile-more-sheet")).toBeInTheDocument();
    expect(screen.getByText("All Options")).toBeInTheDocument();
    expect(screen.getByText("Arjun Waiter · Waiter")).toBeInTheDocument();
    expect(screen.getByText("Table Floor")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Sound On"));
    expect(onToggleSound).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("தமிழ்"));
    expect(onToggleLanguage).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Dark"));
    expect(onToggleTheme).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Sign Out"));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("triggers useLiveSync callbacks on smf:live-sync and smf:native-resume", () => {
    const onSync = vi.fn();
    render(<LiveSyncHarness onSync={onSync} />);

    triggerLiveSync({ type: "order.created" });
    expect(onSync).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new CustomEvent("smf:native-resume"));
    expect(onSync).toHaveBeenCalledTimes(2);
  });
});
