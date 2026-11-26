import React from "react";
import { NavLink } from "react-router-dom";
import { Globe, LogOut, Moon, Sun, Volume2, VolumeX, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavGroup } from "../../app/navigation";
import { Button } from "../ui/button";

interface MobileMoreSheetProps {
  open: boolean;
  onClose: () => void;
  navGroups: NavGroup[];
  userName: string;
  roleLabel: string;
  isDark: boolean;
  onToggleTheme: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
  onToggleLanguage: () => void;
  onLogout: () => void;
}

export const MobileMoreSheet: React.FC<MobileMoreSheetProps> = ({
  open,
  onClose,
  navGroups,
  userName,
  roleLabel,
  isDark,
  onToggleTheme,
  soundOn,
  onToggleSound,
  onToggleLanguage,
  onLogout,
}) => {
  const { i18n } = useTranslation();
  const isTa = i18n.language.startsWith("ta");

  if (!open) return null;

  return (
    <div
      data-testid="mobile-more-sheet"
      className="fixed inset-0 z-50 bg-background flex flex-col select-none"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-border bg-card shrink-0">
        <div>
          <h2 className="text-base font-bold text-foreground">
            {isTa ? "அனைத்து விருப்பங்கள்" : "All Options"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {userName} · {roleLabel}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          className="min-h-[48px] min-w-[48px] rounded-full"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Quick Controls */}
      <div className="grid grid-cols-3 gap-2 p-4 border-b border-border bg-muted/30 shrink-0">
        <button
          type="button"
          onClick={onToggleSound}
          className="flex flex-col items-center justify-center gap-1 min-h-[56px] rounded-xl border border-border bg-card p-2 text-xs font-semibold"
        >
          {soundOn ? (
            <Volume2 className="h-5 w-5 text-[#FF6A00]" />
          ) : (
            <VolumeX className="h-5 w-5 text-muted-foreground" />
          )}
          <span>{soundOn ? (isTa ? "ஒலி இயக்கம்" : "Sound On") : isTa ? "அமைதி" : "Muted"}</span>
        </button>

        <button
          type="button"
          onClick={onToggleLanguage}
          className="flex flex-col items-center justify-center gap-1 min-h-[56px] rounded-xl border border-border bg-card p-2 text-xs font-semibold"
        >
          <Globe className="h-5 w-5 text-[#FF6A00]" />
          <span>{isTa ? "English" : "தமிழ்"}</span>
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          className="flex flex-col items-center justify-center gap-1 min-h-[56px] rounded-xl border border-border bg-card p-2 text-xs font-semibold"
        >
          {isDark ? (
            <Sun className="h-5 w-5 text-[#FF6A00]" />
          ) : (
            <Moon className="h-5 w-5 text-foreground" />
          )}
          <span>{isDark ? (isTa ? "வெளிச்சம்" : "Light") : isTa ? "இருள்" : "Dark"}</span>
        </button>
      </div>

      {/* All Permitted Navigation Options */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
              {group.label}
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-3 min-h-[56px] px-3.5 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                        isActive
                          ? "bg-[#FF6A00] text-[#0B1F3B] border-[#FF6A00]"
                          : "bg-card text-foreground border-border hover:bg-muted/50"
                      }`
                    }
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}

        {/* Sign Out */}
        <div className="pt-2 pb-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="w-full min-h-[56px] border-rose-300 text-rose-600 hover:bg-rose-50 font-bold gap-2"
          >
            <LogOut className="h-5 w-5" />
            <span>{isTa ? "வெளியேறு" : "Sign Out"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
