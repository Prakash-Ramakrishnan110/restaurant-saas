import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Settings,
  Bell,
  Sun,
  Moon,
  Smartphone,
  Laptop,
  UtensilsCrossed,
  Info,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { IconButton } from "../../components/ui/icon-button";
import { Input } from "../../components/ui/input";
import { PasswordInput } from "../../components/ui/password-input";
import { FormField } from "../../components/ui/form-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Combobox } from "../../components/ui/combobox";
import { Switch } from "../../components/ui/switch";
import { Checkbox } from "../../components/ui/checkbox";
import { RadioCard } from "../../components/ui/radio-card";
import { Card } from "../../components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../../components/ui/sheet";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { ToastProvider, useToast } from "../../components/ui/toast";
import { Skeleton } from "../../components/ui/skeleton";
import { Stepper } from "../../components/ui/stepper";
import { DataTable } from "../../components/ui/data-table";
import { Badge } from "../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { StatusBadge } from "../../components/app/StatusBadge";
import { EmptyState } from "../../components/app/EmptyState";
import { PageHeader } from "../../components/app/PageHeader";
import { SaveStatusIndicator, SaveStatus } from "../../components/app/SaveStatusIndicator";
import { useTheme } from "../../context/ThemeContext";

const InnerDesignSystemPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { addToast } = useToast();

  const [isTouchMode, setIsTouchMode] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectVal, setSelectVal] = useState("casual");
  const [comboboxVal, setComboboxVal] = useState("area-1");
  const [switchVal, setSwitchVal] = useState(true);
  const [checkboxVal, setCheckboxVal] = useState(true);
  const [radioPreset, setRadioPreset] = useState("cafe");
  const [stepperIndex, setStepperIndex] = useState(1);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");

  const sampleTableData = [
    { id: "1", label: "Table 1", area: "Ground Floor", capacity: 4, status: "AVAILABLE" },
    { id: "2", label: "Table 2", area: "Ground Floor", capacity: 2, status: "OCCUPIED" },
    { id: "3", label: "Table 3", area: "Rooftop Garden", capacity: 6, status: "RESERVED" },
    { id: "4", label: "Table 4", area: "Bar Counter", capacity: 2, status: "CLEANING" },
    { id: "5", label: "Table 5", area: "Family Section", capacity: 8, status: "BLOCKED" },
  ];

  const columns = [
    { key: "label", header: "Table", sortable: true },
    { key: "area", header: "Service Area", sortable: true },
    { key: "capacity", header: "Seats", sortable: true },
    {
      key: "status",
      header: "Status",
      render: (item: (typeof sampleTableData)[0]) => <StatusBadge status={item.status} />,
    },
  ];

  return (
    <div
      className={`min-h-screen bg-background text-foreground p-6 sm:p-12 font-sans transition-all ${
        isTouchMode ? "touch-mode text-base" : "comfortable-mode text-sm"
      }`}
    >
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Navigation & Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Dashboard
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                aria-label="Toggle Touch Mode"
                onClick={() => setIsTouchMode(!isTouchMode)}
                className={isTouchMode ? "border-[#FF6A00] text-[#FF6A00]" : ""}
              >
                {isTouchMode ? (
                  <Smartphone className="w-4 h-4 mr-1.5" />
                ) : (
                  <Laptop className="w-4 h-4 mr-1.5" />
                )}
                {isTouchMode ? "Touch Mode (>=56px)" : "Comfortable Mode"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-label="Toggle Dark Mode"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? (
                  <Sun className="w-4 h-4 mr-1.5" />
                ) : (
                  <Moon className="w-4 h-4 mr-1.5" />
                )}
                {theme === "dark" ? "Light" : "Dark"}
              </Button>
            </div>
          </div>

          <PageHeader
            title="ServeMyFood Component Showcase"
            description="Complete, accessible component gallery verified in light/dark and comfortable/touch modes."
            breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Design System" }]}
          />
        </div>

        {/* 1. Buttons & IconButtons */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold font-heading">1. Buttons & IconButtons</h2>
          <Card className="p-6 space-y-6">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase block mb-3">
                Variants (Primary button: #FF6A00 background with #0B1F3B text = 5.7:1 AAA contrast)
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="default">Primary Action</Button>
                <Button variant="secondary">Secondary Action</Button>
                <Button variant="destructive">Destructive Action</Button>
                <Button variant="outline">Outline Action</Button>
                <Button variant="ghost">Ghost Action</Button>
                <Button variant="link">Link Style</Button>
                <Button disabled>Disabled</Button>
              </div>
            </div>

            <div className="pt-4 border-t border-border flex flex-wrap items-center gap-4">
              <span className="text-xs font-semibold text-muted-foreground uppercase block">
                IconButtons with Tooltips:
              </span>
              <IconButton aria-label="Settings" tooltip="Configure Settings" variant="outline">
                <Settings className="h-4 w-4" />
              </IconButton>
              <IconButton aria-label="Notifications" tooltip="View Notifications" variant="ghost">
                <Bell className="h-4 w-4" />
              </IconButton>
              <IconButton aria-label="Add table" tooltip="Add Table" variant="default">
                <Plus className="h-4 w-4" />
              </IconButton>
              <IconButton aria-label="Delete" tooltip="Delete Item" variant="destructive">
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
          </Card>
        </section>

        {/* 2. Inputs, FormField & PasswordInput */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold font-heading">2. Form Fields & Password Input</h2>
          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                id="demo-table-label"
                label="Table Label"
                description="Unique within service area"
              >
                {({ id, "aria-describedby": ariaDescribedBy }) => (
                  <Input
                    id={id}
                    aria-describedby={ariaDescribedBy}
                    defaultValue="T-12"
                    placeholder="e.g. T-12"
                  />
                )}
              </FormField>

              <FormField
                id="demo-capacity"
                label="Guest Capacity"
                error="Capacity must be between 1 and 20"
                required
              >
                {({ id, "aria-describedby": ariaDescribedBy, error }) => (
                  <Input
                    id={id}
                    aria-describedby={ariaDescribedBy}
                    error={error}
                    defaultValue="0"
                    type="number"
                  />
                )}
              </FormField>

              <FormField
                id="demo-password"
                label="Temporary Password"
                description="Toggle visibility eye icon"
              >
                {({ id, "aria-describedby": ariaDescribedBy }) => (
                  <PasswordInput
                    id={id}
                    aria-describedby={ariaDescribedBy}
                    defaultValue="Secret123!"
                  />
                )}
              </FormField>
            </div>
          </Card>
        </section>

        {/* 3. Selection Controls: Select, Combobox, Switch, Checkbox, RadioCard */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold font-heading">3. Selection & Choice Controls</h2>
          <Card className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase block mb-2">
                  Radix Select Dropdown
                </label>
                <Select value={selectVal} onValueChange={setSelectVal}>
                  <SelectTrigger aria-label="Select venue profile">
                    <SelectValue placeholder="Select venue profile" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quick">Quick Service</SelectItem>
                    <SelectItem value="cafe">Café</SelectItem>
                    <SelectItem value="casual">Casual Dining</SelectItem>
                    <SelectItem value="fine">Fine Dining</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase block mb-2">
                  Searchable Combobox
                </label>
                <Combobox
                  options={[
                    { value: "area-1", label: "Ground Floor Dining" },
                    { value: "area-2", label: "Rooftop Garden" },
                    { value: "area-3", label: "AC Family Hall" },
                    { value: "area-4", label: "Bar Counter Lounge" },
                  ]}
                  value={comboboxVal}
                  onChange={setComboboxVal}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="flex items-center gap-3">
                <Switch id="switch-kds" checked={switchVal} onCheckedChange={setSwitchVal} />
                <label htmlFor="switch-kds" className="text-sm font-medium cursor-pointer">
                  Enable Kitchen Display System (KDS)
                </label>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="check-takeaway"
                  checked={checkboxVal}
                  onCheckedChange={(c) => setCheckboxVal(Boolean(c))}
                />
                <label htmlFor="check-takeaway" className="text-sm font-medium cursor-pointer">
                  Allow Takeaway / Counter Pickup
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-border space-y-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase block">
                RadioCards (Touch-friendly venue presets)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <RadioCard
                  id="preset-qs"
                  name="preset"
                  value="quick"
                  checked={radioPreset === "quick"}
                  onChange={setRadioPreset}
                  title="Quick Service"
                  description="Counter order and daily sequential token pickup."
                  badge="Fast"
                />
                <RadioCard
                  id="preset-cafe"
                  name="preset"
                  value="cafe"
                  checked={radioPreset === "cafe"}
                  onChange={setRadioPreset}
                  title="Café / Bistro"
                  description="Table seating with direct customer QR ordering."
                  badge="Popular"
                />
                <RadioCard
                  id="preset-fine"
                  name="preset"
                  value="fine"
                  checked={radioPreset === "fine"}
                  onChange={setRadioPreset}
                  title="Fine Dining"
                  description="Multi-course service with staff-only session policy."
                  badge="Premium"
                />
              </div>
            </div>
          </Card>
        </section>

        {/* 4. Badges (Standard & Semantic Table Status) */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold font-heading">4. Badges & Table Status</h2>
          <Card className="p-6 space-y-4">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase block mb-3">
                Standard UI Badges:
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="default">Primary Badge</Badge>
                <Badge variant="secondary">Secondary Badge</Badge>
                <Badge variant="destructive">Destructive Badge</Badge>
                <Badge variant="outline">Outline Badge</Badge>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <span className="text-xs font-semibold text-muted-foreground uppercase block mb-3">
                Semantic Table Status Badges (Strict Rule: Zero Brand Orange in Status UI):
              </span>
              <div className="flex flex-wrap items-center gap-4">
                <StatusBadge status="AVAILABLE" />
                <StatusBadge status="OCCUPIED" />
                <StatusBadge status="RESERVED" />
                <StatusBadge status="CLEANING" />
                <StatusBadge status="BLOCKED" />
              </div>
            </div>
          </Card>
        </section>

        {/* 5. Tabs Navigation Component */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold font-heading">5. Tabs Navigation Component</h2>
          <Card className="p-6">
            <Tabs defaultValue="floor" className="w-full">
              <TabsList className="grid w-full grid-cols-3 max-w-md">
                <TabsTrigger value="floor">Dining Floor</TabsTrigger>
                <TabsTrigger value="kitchen">Kitchen Screen</TabsTrigger>
                <TabsTrigger value="takeaway">Takeaway Bays</TabsTrigger>
              </TabsList>
              <TabsContent value="floor" className="pt-4 text-sm text-muted-foreground">
                Live interactive table layout view with active seating sessions.
              </TabsContent>
              <TabsContent value="kitchen" className="pt-4 text-sm text-muted-foreground">
                Kitchen Display System (KDS) order bump bar and course pacing.
              </TabsContent>
              <TabsContent value="takeaway" className="pt-4 text-sm text-muted-foreground">
                Counter pickup queue and daily sequential token monitor.
              </TabsContent>
            </Tabs>
          </Card>
        </section>

        {/* 6. Stepper & SaveStatusIndicator */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold font-heading">6. Stepper & Live Save Indicator</h2>
          <Card className="p-6 space-y-6">
            <Stepper
              steps={[
                { id: "1", title: "Tenant Info" },
                { id: "2", title: "Venue Profile" },
                { id: "3", title: "Floor Setup" },
                { id: "4", title: "Review" },
              ]}
              currentStepIndex={stepperIndex}
              onStepClick={setStepperIndex}
            />

            <div className="pt-4 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Save State:</span>
                <SaveStatusIndicator status={saveStatus} />
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setSaveStatus("unsaved")}>
                  Unsaved
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSaveStatus("saving")}>
                  Saving
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSaveStatus("saved")}>
                  Saved
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSaveStatus("error")}>
                  Error
                </Button>
              </div>
            </div>
          </Card>
        </section>

        {/* 7. Dialogs, Modals, Sheets, Toasts & Tooltips */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold font-heading">7. Dialogs, Drawers & Notifications</h2>
          <Card className="p-6">
            <div className="flex flex-wrap items-center gap-4">
              {/* Standard Dialog */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Open Standard Dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Configure Service Area</DialogTitle>
                    <DialogDescription>
                      Update seating limits and section groupings for this floor area.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-3">
                    <FormField id="area-name" label="Service Area Name">
                      {({ id }) => <Input id={id} defaultValue="Main Dining Hall" />}
                    </FormField>
                  </div>
                  <DialogFooter>
                    <Button variant="outline">Cancel</Button>
                    <Button variant="default">Save Changes</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
                Trigger ConfirmDialog
              </Button>

              <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title="Deactivate Staff Member?"
                description="This staff member will lose access immediately. You can re-activate their account later."
                confirmLabel="Deactivate"
                onConfirm={() => {
                  addToast({ type: "success", title: "Staff member deactivated." });
                }}
              />

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline">Open Sheet Drawer</Button>
                </SheetTrigger>
                <SheetContent side="right">
                  <SheetHeader>
                    <SheetTitle>Table Details</SheetTitle>
                    <SheetDescription>
                      Configure table assignment and live QR status.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="py-6 space-y-4">
                    <p className="text-sm text-foreground">Drawer panel content slide-over.</p>
                  </div>
                </SheetContent>
              </Sheet>

              <Button
                variant="secondary"
                onClick={() =>
                  addToast({ type: "success", title: "Operation completed successfully." })
                }
              >
                Success Toast
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  addToast({ type: "error", title: "Action failed", description: "Please retry." })
                }
              >
                Error Toast
              </Button>
              <Button
                variant="secondary"
                onClick={() => addToast({ type: "info", title: "Table status updated." })}
              >
                Info Toast
              </Button>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Info className="h-4 w-4 mr-1 text-blue-600 dark:text-blue-400" />
                      Hover Tooltip
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Explaining interactive UI controls</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </Card>
        </section>

        {/* 7. DataTable */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold font-heading">7. Sortable Paginated DataTable</h2>
          <DataTable
            columns={columns}
            data={sampleTableData}
            keyExtractor={(item) => item.id}
            pageSize={3}
          />
        </section>

        {/* 8. EmptyState & Skeletons */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold font-heading">8. EmptyState & Loading Skeletons</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <EmptyState
              icon={UtensilsCrossed}
              title="No Dining Tables Configured"
              description="Get started by generating tables in bulk or adding individual tables to your service areas."
              actionLabel="Create First Table"
              onAction={() => addToast({ type: "info", title: "Create table clicked" })}
            />
            <Card className="p-6 space-y-4">
              <span className="text-xs font-semibold text-muted-foreground uppercase block">
                Loading Skeleton Placeholders
              </span>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-10 w-28 rounded-md" />
                <Skeleton className="h-10 w-24 rounded-md" />
              </div>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
};

export const DevDesignSystemPage: React.FC = () => {
  return (
    <ToastProvider>
      <InnerDesignSystemPage />
    </ToastProvider>
  );
};
