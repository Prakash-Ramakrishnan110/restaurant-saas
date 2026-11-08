import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./pages/auth/LoginPage";
import { ChangePasswordPage } from "./pages/auth/ChangePasswordPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { OnboardingPage } from "./pages/onboarding/OnboardingPage";
import { BranchesPage } from "./pages/venue/BranchesPage";
import { AreasPage } from "./pages/venue/AreasPage";
import { TablesPage } from "./pages/venue/TablesPage";
import { CountersPage } from "./pages/venue/CountersPage";
import { FloorPlanPage } from "./pages/venue/FloorPlanPage";
import { QRCodesPage } from "./pages/venue/QRCodesPage";
import { StaffPage } from "./pages/staff/StaffPage";
import { MenuPage } from "./pages/menu/MenuPage";
import { MenuAvailabilityPage } from "./pages/menu/MenuAvailabilityPage";
import { VenueSettingsPage } from "./pages/settings/VenueSettingsPage";
import { BrandingSettingsPage } from "./pages/settings/BrandingSettingsPage";
import { FloorPOSPage } from "./pages/orders/FloorPOSPage";
import { LiveOrdersPage } from "./pages/orders/LiveOrdersPage";
import { ReadyToServePage } from "./pages/orders/ReadyToServePage";
import { InvoicesHistoryPage } from "./pages/billing/InvoicesHistoryPage";
import { AccountPage } from "./pages/settings/AccountPage";
import { KDSPage } from "./pages/kds/KDSPage";
import { BillingPage } from "./pages/billing/BillingPage";
import { ShiftCloseoutPage } from "./pages/billing/ShiftCloseoutPage";
import { PlatformAdminPage } from "./pages/admin/PlatformAdminPage";
import { NewCustomerWizardPage } from "./pages/admin/NewCustomerWizardPage";
import { CustomerDetailPage } from "./pages/admin/CustomerDetailPage";
import { PublicQRPage } from "./pages/public/PublicQRPage";
import { SuspendedPage } from "./pages/error/SuspendedPage";
import { ForbiddenPage } from "./pages/error/ForbiddenPage";
import { NotFoundPage } from "./pages/error/NotFoundPage";
import { DevBrandPage } from "./pages/dev/DevBrandPage";
import { DevDesignSystemPage } from "./pages/dev/DevDesignSystemPage";
import "./i18n";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, mustChangePassword, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#FF6A00] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-muted-foreground font-semibold">
            Loading ServeMyFood...
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  return <AppShell>{children}</AppShell>;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <Routes>
              {/* Public Auth & Customer Landing Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/change-password" element={<ChangePasswordPage />} />
              <Route path="/suspended" element={<SuspendedPage />} />
              <Route path="/403" element={<ForbiddenPage />} />
              <Route path="/q/:token" element={<PublicQRPage />} />

              {/* Dev Showcase Routes */}
              <Route path="/dev/brand" element={<DevBrandPage />} />
              <Route path="/dev/design-system" element={<DevDesignSystemPage />} />

              {/* Protected App Routes inside AppShell */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pos"
                element={
                  <ProtectedRoute>
                    <FloorPOSPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders/floor"
                element={
                  <ProtectedRoute>
                    <FloorPOSPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders"
                element={
                  <ProtectedRoute>
                    <LiveOrdersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders/live"
                element={
                  <ProtectedRoute>
                    <LiveOrdersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders/ready"
                element={
                  <ProtectedRoute>
                    <ReadyToServePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/kds"
                element={
                  <ProtectedRoute>
                    <KDSPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders/kds"
                element={
                  <ProtectedRoute>
                    <KDSPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/billing"
                element={
                  <ProtectedRoute>
                    <BillingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders/billing"
                element={
                  <ProtectedRoute>
                    <BillingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/billing/invoices"
                element={
                  <ProtectedRoute>
                    <InvoicesHistoryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/billing/closeout"
                element={
                  <ProtectedRoute>
                    <ShiftCloseoutPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <PlatformAdminPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/tenants"
                element={
                  <ProtectedRoute>
                    <PlatformAdminPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/tenants/new"
                element={
                  <ProtectedRoute>
                    <NewCustomerWizardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/tenants/:id"
                element={
                  <ProtectedRoute>
                    <CustomerDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute>
                    <PlatformAdminPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <OnboardingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/branches"
                element={
                  <ProtectedRoute>
                    <BranchesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/venue/branches"
                element={
                  <ProtectedRoute>
                    <BranchesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/venue/areas"
                element={
                  <ProtectedRoute>
                    <AreasPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/venue/tables"
                element={
                  <ProtectedRoute>
                    <TablesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/venue/counters"
                element={
                  <ProtectedRoute>
                    <CountersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/venue/floor"
                element={
                  <ProtectedRoute>
                    <FloorPlanPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/venue/floor-plan"
                element={
                  <ProtectedRoute>
                    <FloorPlanPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/qr"
                element={
                  <ProtectedRoute>
                    <QRCodesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/staff"
                element={
                  <ProtectedRoute>
                    <StaffPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/menu"
                element={
                  <ProtectedRoute>
                    <MenuPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/menu/availability"
                element={
                  <ProtectedRoute>
                    <MenuAvailabilityPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/venue"
                element={
                  <ProtectedRoute>
                    <VenueSettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/branding"
                element={
                  <ProtectedRoute>
                    <BrandingSettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/account"
                element={
                  <ProtectedRoute>
                    <AccountPage />
                  </ProtectedRoute>
                }
              />

              {/* Default Redirects & 404 */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
