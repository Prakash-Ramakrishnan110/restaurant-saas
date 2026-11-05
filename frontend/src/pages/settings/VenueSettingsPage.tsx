import React from "react";
import { Link } from "react-router-dom";
import { Sliders, Palette, ArrowRight } from "lucide-react";
import { PageHeader } from "../../components/app/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";

export const VenueSettingsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Venue Profile & Settings"
        description="Configure operational settings, branch parameters, tax modes, and customer branding."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Settings" }]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Branding & Visual Identity Card */}
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" />
              <CardTitle className="text-base font-bold">Branding & Business Identity</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Upload your restaurant logo, configure brand colors, document language, receipt footers, and GSTIN details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/settings/branding">
              <Button className="w-full bg-[#FF6A00] hover:bg-[#E55F00] text-navy font-bold min-h-[44px]">
                <span>Manage Branding & Identity</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Operational Capabilities Card */}
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-primary" />
              <CardTitle className="text-base font-bold">Branch Operational Rules</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Review and customize dining session policies, ordering mode, course ordering, and table merging capabilities.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/branches">
              <Button variant="outline" className="w-full min-h-[44px]">
                <span>Configure Branches</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
