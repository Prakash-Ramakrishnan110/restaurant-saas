import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./pages/auth/LoginPage";
import { ChangePasswordPage } from "./pages/auth/ChangePasswordPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { OnboardingWizardPage } from "./pages/onboarding/OnboardingWizardPage";
import { BranchesPage } from "./pages/venue/BranchesPage";
import { VenueLayoutHubPage } from "./pages/venue/VenueLayoutHubPage";
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
import { PlanBillingPage } from "./pages/settings/PlanBillingPage";
import { FloorPOSPage } from "./pages/orders/FloorPOSPage";
import { LiveOrdersPage } from "./pages/orders/LiveOrdersPage";
import { ReadyToServePage } from "./pages/orders/ReadyToServePage";
import { InvoicesHistoryPage } from "./pages/billing/InvoicesHistoryPage";
import { AccountPage } from "./pages/settings/AccountPage";
import { KDSPage } from "./pages/kds/KDSPage";
import { BillingPage } from "./pages/billing/BillingPage";
import { ShiftCloseoutPage } from "./pages/billing/ShiftCloseoutPage";
import { PlatformAdminPage } from "./pages/admin/PlatformAdminPage";
import { TenantsDirectoryPage } from "./pages/admin/TenantsDirectoryPage";
import { NewCustomerWizardPage } from "./pages/admin/NewCustomerWizardPage";
import { CustomerDetailPage } from "./pages/admin/CustomerDetailPage";
import { PublicQRPage } from "./pages/public/PublicQRPage";
import { SuspendedPage } from "./pages/error/SuspendedPage";
import { ForbiddenPage } from "./pages/error/ForbiddenPage";
import { NotFoundPage } from "./pages/error/NotFoundPage";
import { DevBrandPage } from "./pages/dev/DevBrandPage";
import { DevDesignSystemPage } from "./pages/dev/DevDesignSystemPage";
import { SalesReportsPage } from "./pages/reports/SalesReportsPage";
import { ItemReportsPage } from "./pages/reports/ItemReportsPage";
import { PaymentReportsPage } from "./pages/reports/PaymentReportsPage";
import { ActivityLogPage } from "./pages/activity/ActivityLogPage";
import { MenuOptionsPage } from "./pages/menu/MenuOptionsPage";
import { SoundSettingsPage } from "./pages/settings/SoundSettingsPage";
import { DeviceSettingsPage } from "./pages/settings/DeviceSettingsPage";
import { PlatformPlansPage } from "./pages/admin/PlatformPlansPage";
import { PlatformActivityPage } from "./pages/admin/PlatformActivityPage";
import { RoomsPage } from "./pages/venue/RoomsPage";
import { RoomServicePage } from "./pages/orders/RoomServicePage";
import { RoomChargesPage } from "./pages/billing/RoomChargesPage";
import { TakeawayPage } from "./pages/orders/TakeawayPage";
import { ExceptionsReportPage } from "./pages/reports/ExceptionsReportPage";
import { StaffReportPage } from "./pages/reports/StaffReportPage";
import { OutletComparisonPage } from "./pages/reports/OutletComparisonPage";
import { CustomersPage } from "./pages/customers/CustomersPage";
import { RolesGuidePage } from "./pages/team/RolesGuidePage";
import { PlatformSupportPage } from "./pages/admin/PlatformSupportPage";
import { PlatformAnnouncementsPage } from "./pages/admin/PlatformAnnouncementsPage";
import { PlatformHealthPage } from "./pages/admin/PlatformHealthPage";
import { StockOverviewPage } from "./pages/inventory/StockOverviewPage";
import { RecipesPage } from "./pages/inventory/RecipesPage";
import { SuppliersPurchasesPage } from "./pages/inventory/SuppliersPurchasesPage";
import { WastagePage } from "./pages/inventory/WastagePage";
import { InventoryReportsPage } from "./pages/inventory/InventoryReportsPage";
import "./i18n";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  requirePlatformAdmin?: boolean;
}> = ({ children, requirePlatformAdmin = false }) => {
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

  if (requirePlatformAdmin && !user.is_platform_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!requirePlatformAdmin && user.is_platform_admin) {
    return <Navigate to="/admin" replace />;
  }

  return <AppShell>{children}</AppShell>;
};

const RootRedirect: React.FC = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-[#FF6A00] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.is_platform_admin) {
    return <Navigate to="/admin" replace />;
  }
  return <Navigate to="/dashboard" replace />;
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
                path="/serve"
                element={
                  <ProtectedRoute>
                    <ReadyToServePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/room-service"
                element={
                  <ProtectedRoute>
                    <RoomServicePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/takeaway"
                element={
                  <ProtectedRoute>
                    <TakeawayPage />
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
                path="/billing/bills"
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
                path="/billing/room-charges"
                element={
                  <ProtectedRoute>
                    <RoomChargesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports/sales"
                element={
                  <ProtectedRoute>
                    <SalesReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports/items"
                element={
                  <ProtectedRoute>
                    <ItemReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports/payments"
                element={
                  <ProtectedRoute>
                    <PaymentReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports/exceptions"
                element={
                  <ProtectedRoute>
                    <ExceptionsReportPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports/staff"
                element={
                  <ProtectedRoute>
                    <StaffReportPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports/outlets"
                element={
                  <ProtectedRoute>
                    <OutletComparisonPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory"
                element={
                  <ProtectedRoute>
                    <StockOverviewPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory/recipes"
                element={
                  <ProtectedRoute>
                    <RecipesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory/purchases"
                element={
                  <ProtectedRoute>
                    <SuppliersPurchasesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory/wastage"
                element={
                  <ProtectedRoute>
                    <WastagePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory/reports"
                element={
                  <ProtectedRoute>
                    <InventoryReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/activity"
                element={
                  <ProtectedRoute>
                    <ActivityLogPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/menu/options"
                element={
                  <ProtectedRoute>
                    <MenuOptionsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/sound"
                element={
                  <ProtectedRoute>
                    <SoundSettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/devices"
                element={
                  <ProtectedRoute>
                    <DeviceSettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requirePlatformAdmin>
                    <PlatformAdminPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/tenants"
                element={
                  <ProtectedRoute requirePlatformAdmin>
                    <TenantsDirectoryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/tenants/new"
                element={
                  <ProtectedRoute requirePlatformAdmin>
                    <NewCustomerWizardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/tenants/:id"
                element={
                  <ProtectedRoute requirePlatformAdmin>
                    <CustomerDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute requirePlatformAdmin>
                    <PlatformAdminPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/plans"
                element={
                  <ProtectedRoute requirePlatformAdmin>
                    <PlatformPlansPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/activity"
                element={
                  <ProtectedRoute requirePlatformAdmin>
                    <PlatformActivityPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/support"
                element={
                  <ProtectedRoute requirePlatformAdmin>
                    <PlatformSupportPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/announcements"
                element={
                  <ProtectedRoute requirePlatformAdmin>
                    <PlatformAnnouncementsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/health"
                element={
                  <ProtectedRoute requirePlatformAdmin>
                    <PlatformHealthPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <OnboardingWizardPage />
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
                path="/venue"
                element={
                  <ProtectedRoute>
                    <VenueLayoutHubPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/venue/layout"
                element={
                  <ProtectedRoute>
                    <VenueLayoutHubPage />
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
                path="/venue/rooms"
                element={
                  <ProtectedRoute>
                    <RoomsPage />
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
                path="/customers"
                element={
                  <ProtectedRoute>
                    <CustomersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/team/roles"
                element={
                  <ProtectedRoute>
                    <RolesGuidePage />
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
              <Route
                path="/settings/plan"
                element={
                  <ProtectedRoute>
                    <PlanBillingPage />
                  </ProtectedRoute>
                }
              />

              {/* Default Redirects & 404 */}
              <Route path="/" element={<RootRedirect />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
