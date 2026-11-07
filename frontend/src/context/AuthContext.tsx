import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiClient, setAccessToken, setActiveTenantId } from "../api/client";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone_number?: string;
  is_platform_admin: boolean;
}

export interface TenantMembership {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  role: string;
  is_active: boolean;
  branch_ids?: string[];
  permissions?: string[];
}

export interface AuthContextType {
  user: UserProfile | null;
  memberships: TenantMembership[];
  activeTenant: TenantMembership | null;
  activeRole: string | null;
  permissions: string[];
  mustChangePassword: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ mustChangePassword: boolean }>;
  logout: () => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  selectTenant: (tenantId: string) => void;
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [memberships, setMemberships] = useState<TenantMembership[]>([]);
  const [activeTenant, setActiveTenant] = useState<TenantMembership | null>(null);
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchProfile = useCallback(async () => {
    try {
      const response = await apiClient.get<{
        user: UserProfile & { must_change_password?: boolean };
        memberships: TenantMembership[];
        active_role?: string;
        permissions?: string[];
        must_change_password?: boolean;
      }>("/auth/me/");
      setUser(response.data.user);
      setMemberships(response.data.memberships || []);
      setActiveRole(response.data.active_role || null);
      setPermissions(response.data.permissions || []);
      setMustChangePassword(
        Boolean(response.data.must_change_password ?? response.data.user?.must_change_password)
      );

      // Select first membership by default if none selected
      if (response.data.memberships && response.data.memberships.length > 0) {
        const savedTenantId = localStorage.getItem("servemyfood_tenant_id");
        const found =
          response.data.memberships.find((m) => m.tenant_id === savedTenantId) ||
          response.data.memberships[0];
        setActiveTenant(found);
        setActiveTenantId(found.tenant_id);
      }
      return response.data;
    } catch {
      setUser(null);
      setMemberships([]);
      setActiveTenant(null);
      setActiveRole(null);
      setPermissions([]);
      setActiveTenantId(null);
      return null;
    }
  }, []);

  // Initial silent authentication via refresh cookie
  useEffect(() => {
    const initAuth = async () => {
      const hasSession = localStorage.getItem("servemyfood_has_session");
      if (!hasSession) {
        setIsLoading(false);
        return;
      }

      try {
        const refreshRes = await apiClient.post<{ access: string }>("/auth/refresh/");
        setAccessToken(refreshRes.data.access);
        await fetchProfile();
      } catch {
        // Not logged in or expired refresh token
        setAccessToken(null);
        localStorage.removeItem("servemyfood_has_session");
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [fetchProfile]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await apiClient.post<{
        access: string;
        user?: { must_change_password?: boolean };
      }>("/auth/login/", {
        email,
        password,
      });
      setAccessToken(res.data.access);
      localStorage.setItem("servemyfood_has_session", "true");
      const profile = await fetchProfile();
      const needsChange = Boolean(
        profile?.must_change_password ??
        profile?.user?.must_change_password ??
        res.data?.user?.must_change_password
      );
      return { mustChangePassword: needsChange };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await apiClient.post("/auth/logout/");
    } catch {
      // Ignore errors on logout
    } finally {
      setAccessToken(null);
      setUser(null);
      setMemberships([]);
      setActiveTenant(null);
      setActiveRole(null);
      setPermissions([]);
      setActiveTenantId(null);
      localStorage.removeItem("servemyfood_tenant_id");
      localStorage.removeItem("servemyfood_has_session");
      setIsLoading(false);
    }
  };

  const changePassword = async (oldPassword: string, newPassword: string) => {
    const res = await apiClient.post<{ access: string }>("/auth/change-password/", {
      old_password: oldPassword,
      new_password: newPassword,
    });
    setAccessToken(res.data.access);
    setMustChangePassword(false);
    await fetchProfile();
  };

  const selectTenant = (tenantId: string) => {
    const target = memberships.find((m) => m.tenant_id === tenantId);
    if (target) {
      setActiveTenant(target);
      setActiveTenantId(target.tenant_id);
      localStorage.setItem("servemyfood_tenant_id", target.tenant_id);
    }
  };

  const can = useCallback(
    (permission: string) => {
      if (user?.is_platform_admin) return true;
      return permissions.includes(permission);
    },
    [user, permissions]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        memberships,
        activeTenant,
        activeRole,
        permissions,
        mustChangePassword,
        isLoading,
        login,
        logout,
        changePassword,
        selectTenant,
        can,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const useCan = (permission: string): boolean => {
  const { can } = useAuth();
  return can(permission);
};

export const Can: React.FC<{
  permission: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}> = ({ permission, fallback = null, children }) => {
  const allowed = useCan(permission);
  return allowed ? <>{children}</> : <>{fallback}</>;
};
