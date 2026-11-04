import React, { createContext, useContext, useState, useEffect } from "react";

export type ThemeMode = "light" | "dark" | "system";

export interface TenantBrandOverride {
  primary?: string;
  logoUrl?: string;
}

export interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  touchMode: boolean;
  setTouchMode: (enabled: boolean) => void;
  tenantBrand: TenantBrandOverride | null;
  setTenantBrand: (brand: TenantBrandOverride | null) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem("servemyfood_theme") as ThemeMode) || "light";
  });
  const [touchMode, setTouchModeState] = useState<boolean>(() => {
    return localStorage.getItem("servemyfood_touch_mode") === "true";
  });
  const [tenantBrand, setTenantBrand] = useState<TenantBrandOverride | null>(null);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    localStorage.setItem("servemyfood_theme", mode);
  };

  const setTouchMode = (enabled: boolean) => {
    setTouchModeState(enabled);
    localStorage.setItem("servemyfood_touch_mode", String(enabled));
  };

  // Sync dark class on document root
  useEffect(() => {
    const root = document.documentElement;
    const isDark =
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  // Sync touch-mode class on document root
  useEffect(() => {
    const root = document.documentElement;
    if (touchMode) {
      root.classList.add("touch-mode");
    } else {
      root.classList.remove("touch-mode");
    }
  }, [touchMode]);

  // Apply tenant custom brand variables when provided (customer-facing override)
  useEffect(() => {
    const root = document.documentElement;
    if (tenantBrand?.primary) {
      // Set inline css variable for customer view
      root.style.setProperty("--tenant-primary", tenantBrand.primary);
    } else {
      root.style.removeProperty("--tenant-primary");
    }
  }, [tenantBrand]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        touchMode,
        setTouchMode,
        tenantBrand,
        setTenantBrand,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
