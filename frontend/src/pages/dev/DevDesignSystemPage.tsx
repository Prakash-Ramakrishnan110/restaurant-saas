import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Card } from "../../components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../../components/ui/table";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";

export const DevDesignSystemPage: React.FC = () => {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground p-6 sm:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Navigation */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="mb-4 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Dashboard
          </Button>
          <div className="border-b pb-6">
            <h1 className="text-3xl font-extrabold tracking-tight font-display text-[#0B1F3B] dark:text-white">
              ServeMyFood Component Showcase
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Accessible, production-ready shadcn/ui components adhering strictly to ServeMyFood brand invariants.
            </p>
          </div>
        </div>

        {/* 1. Buttons */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold font-display">1. Button Variants & Sizes</h2>
          <Card className="p-6">
            <div className="space-y-6">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase block mb-3">
                  Variants (Note: Primary button uses #FF6A00 background with #0B1F3B text for 5.7:1 AAA contrast)
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="primary">Primary Button</Button>
                  <Button variant="secondary">Secondary Button</Button>
                  <Button variant="destructive">Destructive Button</Button>
                  <Button variant="outline">Outline Button</Button>
                  <Button variant="ghost">Ghost Button</Button>
                  <Button variant="link">Link Button</Button>
                  <Button variant="primary" disabled>Disabled State</Button>
                </div>
              </div>

              <div className="pt-4 border-t">
                <span className="text-xs font-semibold text-muted-foreground uppercase block mb-3">
                  Sizes & Touch Ergonomics
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="primary" size="sm">Small (32px)</Button>
                  <Button variant="primary" size="default">Default (40px)</Button>
                  <Button variant="primary" size="lg">Large (44px)</Button>
                  <Button variant="primary" size="touch">Touch Preset (48px Target)</Button>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* 2. Badges */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold font-display">2. Status & System Badges</h2>
          <Card className="p-6">
            <div className="space-y-6">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase block mb-3">
                  Table Operational Status Badges (Strict WCAG AA Compliance)
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="available">AVAILABLE (Green)</Badge>
                  <Badge variant="occupied">OCCUPIED (Blue)</Badge>
                  <Badge variant="reserved">RESERVED (Purple)</Badge>
                  <Badge variant="cleaning">CLEANING (Amber)</Badge>
                  <Badge variant="blocked">BLOCKED (Grey)</Badge>
                </div>
              </div>

              <div className="pt-4 border-t">
                <span className="text-xs font-semibold text-muted-foreground uppercase block mb-3">
                  General System Badges
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="default">Default Badge</Badge>
                  <Badge variant="secondary">Secondary Badge</Badge>
                  <Badge variant="destructive">Destructive Badge</Badge>
                  <Badge variant="outline">Outline Badge</Badge>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* 3. Inputs & Forms */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold font-display">3. Form Inputs & States</h2>
          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Standard Input</label>
                <Input placeholder="Enter table label..." defaultValue="Table T10" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">With Error State</label>
                <Input placeholder="Enter capacity..." defaultValue="0" error />
                <span className="text-[11px] text-destructive font-medium">Capacity must be at least 1.</span>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Disabled Input</label>
                <Input placeholder="System ID..." defaultValue="tbl-992384" disabled />
              </div>
            </div>
          </Card>
        </section>

        {/* 4. Dialog Modal */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold font-display">4. Dialog Modal Primitives</h2>
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="primary">
                    <Plus className="w-4 h-4 mr-2" />
                    Open Demo Dialog
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Dining Table</DialogTitle>
                    <DialogDescription>
                      Configure dining table label, guest capacity, and section assignment.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Table Label</label>
                      <Input placeholder="e.g. T15" defaultValue="T15" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Guest Capacity</label>
                      <Input type="number" defaultValue={4} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button variant="primary" onClick={() => setModalOpen(false)}>
                      Save Table
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <span className="text-xs text-muted-foreground">
                Accessible Radix UI dialog with backdrop blur, focus trapping, and Esc key dismissal.
              </span>
            </div>
          </Card>
        </section>

        {/* 5. Data Tables */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold font-display">5. Data Table Component</h2>
          <Card className="p-0 overflow-hidden border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-bold">T1</TableCell>
                  <TableCell>Main Dining</TableCell>
                  <TableCell>4 guests</TableCell>
                  <TableCell><Badge variant="occupied">OCCUPIED</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm">Manage</Button>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-bold">T2</TableCell>
                  <TableCell>Main Dining</TableCell>
                  <TableCell>2 guests</TableCell>
                  <TableCell><Badge variant="available">AVAILABLE</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm">Manage</Button>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-bold">B1</TableCell>
                  <TableCell>AC Family Booths</TableCell>
                  <TableCell>6 guests</TableCell>
                  <TableCell><Badge variant="cleaning">CLEANING</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm">Manage</Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        </section>
      </div>
    </div>
  );
};
