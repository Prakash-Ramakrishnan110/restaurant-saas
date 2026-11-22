import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import "./i18n";

const lazyNamed = <T extends React.ComponentType<any>>(
  loader: () => Promise<Record<string, any>>,
  name: string
) => React.lazy(() => loader().then((m) => ({ default: m[name] as T })));

const AppShell = lazyNamed(() => import("./components/layout/AppShell"), "AppShell");
const LoginPage = lazyNamed(() => import("./pages/auth/LoginPage"), "LoginPage");
const ChangePasswordPage = lazyNamed(
  () => import("./pages/auth/ChangePasswordPage"),
  "ChangePasswordPage"
);
const DashboardPage = lazyNamed(() => import("./pages/dashboard/DashboardPage"), "DashboardPage");
const OnboardingWizardPage = lazyNamed(
  () => import("./pages/onboarding/OnboardingWizardPage"),
  "OnboardingWizardPage"
);
const BranchesPage = lazyNamed(() => import("./pages/venue/BranchesPage"), "BranchesPage");
const VenueLayoutHubPage = lazyNamed(
  () => import("./pages/venue/VenueLayoutHubPage"),
  "VenueLayoutHubPage"
);
const AreasPage = lazyNamed(() => import("./pages/venue/AreasPage"), "AreasPage");
const TablesPage = lazyNamed(() => import("./pages/venue/TablesPage"), "TablesPage");
const CountersPage = lazyNamed(() => import("./pages/venue/CountersPage"), "CountersPage");
const FloorPlanPage = lazyNamed(() => import("./pages/venue/FloorPlanPage"), "FloorPlanPage");
const StaffPage = lazyNamed(() => import("./pages/staff/StaffPage"), "StaffPage");
const MenuPage = lazyNamed(() => import("./pages/menu/MenuPage"), "MenuPage");
const MenuTranslationsPage = lazyNamed(
  () => import("./pages/menu/MenuTranslationsPage"),
  "MenuTranslationsPage"
);
const MenuAvailabilityPage = lazyNamed(
  () => import("./pages/menu/MenuAvailabilityPage"),
  "MenuAvailabilityPage"
);
const VenueSettingsPage = lazyNamed(
  () => import("./pages/settings/VenueSettingsPage"),
  "VenueSettingsPage"
);
const BrandingSettingsPage = lazyNamed(
  () => import("./pages/settings/BrandingSettingsPage"),
  "BrandingSettingsPage"
);
const PlanBillingPage = lazyNamed(
  () => import("./pages/settings/PlanBillingPage"),
  "PlanBillingPage"
);
const FloorPOSPage = lazyNamed(() => import("./pages/orders/FloorPOSPage"), "FloorPOSPage");
const LiveOrdersPage = lazyNamed(() => import("./pages/orders/LiveOrdersPage"), "LiveOrdersPage");
const ReadyToServePage = lazyNamed(
  () => import("./pages/orders/ReadyToServePage"),
  "ReadyToServePage"
);
const InvoicesHistoryPage = lazyNamed(
  () => import("./pages/billing/InvoicesHistoryPage"),
  "InvoicesHistoryPage"
);
const AccountPage = lazyNamed(() => import("./pages/settings/AccountPage"), "AccountPage");
const KDSPage = lazyNamed(() => import("./pages/kds/KDSPage"), "KDSPage");
const BillingPage = lazyNamed(() => import("./pages/billing/BillingPage"), "BillingPage");
const ShiftCloseoutPage = lazyNamed(
  () => import("./pages/billing/ShiftCloseoutPage"),
  "ShiftCloseoutPage"
);
const PlatformAdminPage = lazyNamed(
  () => import("./pages/admin/PlatformAdminPage"),
  "PlatformAdminPage"
);
const TenantsDirectoryPage = lazyNamed(
  () => import("./pages/admin/TenantsDirectoryPage"),
  "TenantsDirectoryPage"
);
const NewCustomerWizardPage = lazyNamed(
  () => import("./pages/admin/NewCustomerWizardPage"),
  "NewCustomerWizardPage"
);
const CustomerDetailPage = lazyNamed(
  () => import("./pages/admin/CustomerDetailPage"),
  "CustomerDetailPage"
);
const PublicQRPage = lazyNamed(() => import("./pages/public/PublicQRPage"), "PublicQRPage");
const PublicOrderTrackerPage = lazyNamed(
  () => import("./pages/public/PublicOrderTrackerPage"),
  "PublicOrderTrackerPage"
);
const SuspendedPage = lazyNamed(() => import("./pages/error/SuspendedPage"), "SuspendedPage");
const ForbiddenPage = lazyNamed(() => import("./pages/error/ForbiddenPage"), "ForbiddenPage");
const NotFoundPage = lazyNamed(() => import("./pages/error/NotFoundPage"), "NotFoundPage");
const DevBrandPage = lazyNamed(() => import("./pages/dev/DevBrandPage"), "DevBrandPage");
const DevDesignSystemPage = lazyNamed(
  () => import("./pages/dev/DevDesignSystemPage"),
  "DevDesignSystemPage"
);
const SalesReportsPage = lazyNamed(
  () => import("./pages/reports/SalesReportsPage"),
  "SalesReportsPage"
);
const ItemReportsPage = lazyNamed(
  () => import("./pages/reports/ItemReportsPage"),
  "ItemReportsPage"
);
const PaymentReportsPage = lazyNamed(
  () => import("./pages/reports/PaymentReportsPage"),
  "PaymentReportsPage"
);
const ActivityLogPage = lazyNamed(
  () => import("./pages/activity/ActivityLogPage"),
  "ActivityLogPage"
);
const MenuOptionsPage = lazyNamed(() => import("./pages/menu/MenuOptionsPage"), "MenuOptionsPage");
const SoundSettingsPage = lazyNamed(
  () => import("./pages/settings/SoundSettingsPage"),
  "SoundSettingsPage"
);
const DeviceSettingsPage = lazyNamed(
  () => import("./pages/settings/DeviceSettingsPage"),
  "DeviceSettingsPage"
);
const HelpCenterPage = lazyNamed(() => import("./pages/help/HelpCenterPage"), "HelpCenterPage");
const PlatformPlansPage = lazyNamed(
  () => import("./pages/admin/PlatformPlansPage"),
  "PlatformPlansPage"
);
const PlatformActivityPage = lazyNamed(
  () => import("./pages/admin/PlatformActivityPage"),
  "PlatformActivityPage"
);
const RoomsPage = lazyNamed(() => import("./pages/venue/RoomsPage"), "RoomsPage");
const RoomServicePage = lazyNamed(
  () => import("./pages/orders/RoomServicePage"),
  "RoomServicePage"
);
const RoomChargesPage = lazyNamed(
  () => import("./pages/billing/RoomChargesPage"),
  "RoomChargesPage"
);
const TakeawayPage = lazyNamed(() => import("./pages/orders/TakeawayPage"), "TakeawayPage");
const ExceptionsReportPage = lazyNamed(
  () => import("./pages/reports/ExceptionsReportPage"),
  "ExceptionsReportPage"
);
const StaffReportPage = lazyNamed(
  () => import("./pages/reports/StaffReportPage"),
  "StaffReportPage"
);
const OutletComparisonPage = lazyNamed(
  () => import("./pages/reports/OutletComparisonPage"),
  "OutletComparisonPage"
);
const CustomersPage = lazyNamed(() => import("./pages/customers/CustomersPage"), "CustomersPage");
const FeedbackPage = lazyNamed(() => import("./pages/customers/FeedbackPage"), "FeedbackPage");
const RolesGuidePage = lazyNamed(() => import("./pages/team/RolesGuidePage"), "RolesGuidePage");
const PlatformSupportPage = lazyNamed(
  () => import("./pages/admin/PlatformSupportPage"),
  "PlatformSupportPage"
);
const PlatformLeadsPage = lazyNamed(
  () => import("./pages/admin/PlatformLeadsPage"),
  "PlatformLeadsPage"
);
const PlatformAnnouncementsPage = lazyNamed(
  () => import("./pages/admin/PlatformAnnouncementsPage"),
  "PlatformAnnouncementsPage"
);
const PlatformHealthPage = lazyNamed(
  () => import("./pages/admin/PlatformHealthPage"),
  "PlatformHealthPage"
);
const StockOverviewPage = lazyNamed(
  () => import("./pages/inventory/StockOverviewPage"),
  "StockOverviewPage"
);
const RecipesPage = lazyNamed(() => import("./pages/inventory/RecipesPage"), "RecipesPage");
const SuppliersPurchasesPage = lazyNamed(
  () => import("./pages/inventory/SuppliersPurchasesPage"),
  "SuppliersPurchasesPage"
);
const WastagePage = lazyNamed(() => import("./pages/inventory/WastagePage"), "WastagePage");
const InventoryReportsPage = lazyNamed(
  () => import("./pages/inventory/InventoryReportsPage"),
  "InventoryReportsPage"
);
const ReceiveStockPage = lazyNamed(
  () => import("./pages/inventory/ReceiveStockPage"),
  "ReceiveStockPage"
);
const StockCountsPage = lazyNamed(
  () => import("./pages/inventory/StockCountsPage"),
  "StockCountsPage"
);
const InventorySettingsPage = lazyNamed(
  () => import("./pages/inventory/InventorySettingsPage"),
  "InventorySettingsPage"
);

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
  requiredPermission?: string;
}> = ({ children, requirePlatformAdmin = false, requiredPermission }) => {
  const { user, mustChangePassword, isLoading, can } = useAuth();
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

  if (requiredPermission && !can(requiredPermission)) {
    return <Navigate to="/forbidden" replace />;
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

export const StaffApp: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <React.Suspense
            fallback={
              <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-8 h-8 border-4 border-[#FF6A00] border-t-transparent rounded-full animate-spin" />
              </div>
            }
          >
            <Routes>
              {/* Public Auth & Customer Landing Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/change-password" element={<ChangePasswordPage />} />
              <Route path="/suspended" element={<SuspendedPage />} />
              <Route path="/403" element={<ForbiddenPage />} />
              <Route path="/q/:token" element={<PublicQRPage />} />
              <Route path="/q/:token/o/:trackingToken" element={<PublicOrderTrackerPage />} />

              {/* Dev Showcase Routes (DEV builds only) */}
              {import.meta.env.DEV && (
                <>
                  <Route path="/dev/brand" element={<DevBrandPage />} />
                  <Route path="/dev/design-system" element={<DevDesignSystemPage />} />
                </>
              )}

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
                  <ProtectedRoute requiredPermission="billing.manage">
                    <BillingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders/billing"
                element={
                  <ProtectedRoute requiredPermission="billing.manage">
                    <BillingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/billing/invoices"
                element={
                  <ProtectedRoute requiredPermission="billing.manage">
                    <InvoicesHistoryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/billing/bills"
                element={
                  <ProtectedRoute requiredPermission="billing.manage">
                    <InvoicesHistoryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/billing/closeout"
                element={
                  <ProtectedRoute requiredPermission="billing.manage">
                    <ShiftCloseoutPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/billing/room-charges"
                element={
                  <ProtectedRoute requiredPermission="billing.manage">
                    <RoomChargesPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/reports" element={<Navigate to="/reports/sales" replace />} />
              <Route path="/reports/today" element={<Navigate to="/reports/sales" replace />} />
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
                path="/inventory/receive"
                element={
                  <ProtectedRoute>
                    <ReceiveStockPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory/counts"
                element={
                  <ProtectedRoute>
                    <StockCountsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory/settings"
                element={
                  <ProtectedRoute>
                    <InventorySettingsPage />
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
                path="/help"
                element={
                  <ProtectedRoute>
                    <HelpCenterPage />
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
                path="/admin/leads"
                element={
                  <ProtectedRoute requirePlatformAdmin>
                    <PlatformLeadsPage />
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
                    <BrandingSettingsPage initialTab="qr" />
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
                path="/customers/feedback"
                element={
                  <ProtectedRoute>
                    <FeedbackPage />
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
                path="/menu/translations"
                element={
                  <ProtectedRoute>
                    <MenuTranslationsPage />
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
          </React.Suspense>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default StaffApp;
