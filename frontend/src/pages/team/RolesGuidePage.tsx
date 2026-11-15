import React, { useState } from "react";
import {
  BookOpen,
  Crown,
  Briefcase,
  Receipt,
  Utensils,
  ChefHat,
  CheckCircle2,
  Globe,
} from "lucide-react";

interface RoleGuide {
  id: string;
  titleEn: string;
  titleTa: string;
  icon: React.ComponentType<{ className?: string }>;
  overviewEn: string;
  overviewTa: string;
  primaryScreens: { name: string; path: string }[];
  dailyDutiesEn: string[];
  dailyDutiesTa: string[];
}

export const RolesGuidePage: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<string>("WAITER");
  const [showTamil, setShowTamil] = useState<boolean>(true);

  const roles: RoleGuide[] = [
    {
      id: "OWNER",
      titleEn: "Restaurant Owner",
      titleTa: "உரிமையாளர்",
      icon: Crown,
      overviewEn:
        "Full control over business operations, multiple branches, menu pricing, exceptions audit, and financial dashboards.",
      overviewTa:
        "வணிகச் செயல்பாடுகள், கிளைகள், மெனு விலை நிர்ணயம், தள்ளுபடி தணிக்கை மற்றும் நிதி அறிக்கைகள் ஆகியவற்றின் முழுக் கட்டுப்பாடு.",
      primaryScreens: [
        { name: "Sales Dashboard", path: "/dashboard" },
        { name: "Exceptions Audit", path: "/reports/exceptions" },
        { name: "Multi-Outlet Comparison", path: "/reports/outlets" },
        { name: "Staff Management", path: "/staff" },
      ],
      dailyDutiesEn: [
        "Review daily gross sales, average ticket size, and tender reconciliation",
        "Inspect discount exceptions and cancelled orders to eliminate revenue leaks",
        "Monitor outlet performance across dine-in, takeaway, and room service",
      ],
      dailyDutiesTa: [
        "தினசரி மொத்த விற்பனை, சராசரி பில் மதிப்பு மற்றும் பணப் பரிவர்த்தனைகளை ஆய்வு செய்தல்",
        "வருவாய் இழப்பைத் தவிர்க்க தள்ளுபடி மற்றும் ரத்து செய்யப்பட்ட ஆர்டர்களைச் சரிபார்த்தல்",
        "உள்ளிருப்பு, பார்சல் மற்றும் ரூம் சர்வீஸ் கிளைகளின் செயல்பாட்டைக் கண்காணித்தல்",
      ],
    },
    {
      id: "MANAGER",
      titleEn: "Branch Manager",
      titleTa: "கிளை மேலாளர்",
      icon: Briefcase,
      overviewEn:
        "Day-to-day floor supervision, approval of high-value discounts, table transfers, and shift handovers.",
      overviewTa:
        "தினசரி சேவை மேற்பார்வை, தள்ளுபடி ஒப்புதல்கள், மேஜை மாற்றங்கள் மற்றும் ஷிப்ட் கணக்குகளைக் கண்காணித்தல்.",
      primaryScreens: [
        { name: "Floor Plan & Table Status", path: "/venue/floor" },
        { name: "Waiter Assignments", path: "/staff" },
        { name: "Exceptions Audit", path: "/reports/exceptions" },
        { name: "Shift Closeout", path: "/billing/closeout" },
      ],
      dailyDutiesEn: [
        "Assign waiters to dining sections and floors at the start of each service shift",
        "Review and approve discount requests and voided items with documented reasons",
        "Ensure kitchen ticket prep times remain under 20 minutes",
      ],
      dailyDutiesTa: [
        "ஷிப்ட் தொடக்கத்தில் பணிப்பாளர்களைத் தளங்கள் மற்றும் மேஜைகளுக்கு ஒதுக்குதல்",
        "தள்ளுபடி கோரிக்கைகள் மற்றும் ரத்துகளைக் காரணங்களுடன் சரிபார்த்து ஒப்புதல் அளித்தல்",
        "சமையலறை தயாரிப்பு நேரம் 20 நிமிடங்களுக்குள் இருப்பதை உறுதிசெய்தல்",
      ],
    },
    {
      id: "CASHIER",
      titleEn: "Cashier & Billing Counter",
      titleTa: "காசாளர்",
      icon: Receipt,
      overviewEn:
        "Fast bill calculation, multi-tender settlement (Cash, UPI, Card, Room Folio), duplicate receipt printing, and shift drawer balance.",
      overviewTa:
        "விரைவான பில் கணக்கீடு, பணம், UPI, கார்டு மற்றும் ரூம் போலியோ கொடுப்பனவுகள், மற்றும் ஷிப்ட் கணக்கு முடித்தல்.",
      primaryScreens: [
        { name: "Cashier Billing", path: "/billing" },
        { name: "Bills History & Reprints", path: "/billing/bills" },
        { name: "Shift Close Drawer", path: "/billing/closeout" },
        { name: "Front Desk Room Charges", path: "/billing/room-charges" },
      ],
      dailyDutiesEn: [
        "Print bill when table requests checkout, verify payment tender, and record settlement",
        "Count drawer cash at shift end and reconcile against expected integer paise total",
        "Ensure room charge settlements include guest room number and verified folio check",
      ],
      dailyDutiesTa: [
        "மேஜை கேட்கும்போது பில் அச்சிட்டு, பணம்/UPI பெற்று முடித்துக் குறித்தல்",
        "ஷிப்ட் முடிவில் காசோலை மற்றும் பணத்தை எண்ணிச் சரிபார்த்தல்",
        "ரூம் சர்வீஸ் பில்களில் அறை எண் மற்றும் விருந்தினர் கையொப்பத்தை உறுதிசெய்தல்",
      ],
    },
    {
      id: "WAITER",
      titleEn: "Floor Captain & Waiter",
      titleTa: "பணிப்பாளர்",
      icon: Utensils,
      overviewEn:
        "Table seating, fast order-taking with dietary notes, course firing, and instant ready-to-serve food pickup.",
      overviewTa:
        "விருந்தினர் அமர்வு, குறிப்புகளுடன் விரைவான ஆர்டர் எடுத்தல் மற்றும் சமையலறையிலிருந்து உணவு எடுத்து பரிமாறுதல்.",
      primaryScreens: [
        { name: "Floor POS & Tables", path: "/pos" },
        { name: "Ready to Serve Alerts", path: "/serve" },
        { name: "Live Orders & Call Bell", path: "/orders" },
        { name: "Menu & Sold Out", path: "/menu" },
      ],
      dailyDutiesEn: [
        "Open table sessions and place orders with special dietary notes (e.g. Jain, less spicy)",
        "Pick up food promptly when Ready to Serve chime sounds and mark items delivered",
        "Respond immediately to table Call Waiter bells on the mobile screen",
      ],
      dailyDutiesTa: [
        "மேஜையைத் திறந்து சிறப்பு உணவு விருப்பங்களுடன் (எ.கா. காரம் குறைவு) ஆர்டர் எடுத்தல்",
        "உணவு தயாரானதும் ஒலி சிக்னல் கேட்டு உடனே எடுத்து பரிமாறுதல்",
        "மேஜையிலிருந்து வரும் 'அழைப்பு மணி' (Call Waiter) அறிவிப்புகளுக்கு உடனே பதிலளித்தல்",
      ],
    },
    {
      id: "KITCHEN",
      titleEn: "Kitchen Station & Chef",
      titleTa: "சமையலறை ஊழியர் / தலைமை சமையல்காரர்",
      icon: ChefHat,
      overviewEn:
        "Paperless digital KDS board, elapsed prep timers, course coordination, and one-tap 'Ready' notifications.",
      overviewTa:
        "காகிதமில்லா டிஜிட்டல் KDS திரை, காத்திருப்பு நேரக் கணிப்பான் மற்றும் உணவு தயார் அறிவிப்புகள்.",
      primaryScreens: [
        { name: "Kitchen KDS Station", path: "/kds" },
        { name: "Today's Availability", path: "/menu/availability" },
        { name: "Menu Management", path: "/menu" },
      ],
      dailyDutiesEn: [
        "Watch digital KDS tickets sorted chronologically; start oldest tickets first",
        "Mark 86 / Sold-out dishes immediately on Today's Availability to prevent ordering errors",
        "Tap 'Ready' as soon as dish is plated to alert floor waiters instantly",
      ],
      dailyDutiesTa: [
        "KDS திரையில் வரிசைப்படி வரும் டிக்கெட்டுகளைப் பார்த்து சமைக்கத் தொடங்குதல்",
        "தீர்ந்துபோன உணவுகளை உடனே 'Today's Availability' திரையில் முடக்குதல்",
        "உணவு தயாரானதும் 'Ready' பட்டனை அழுத்தி பணிப்பாளர்களுக்கு அறிவித்தல்",
      ],
    },
  ];

  const currentRole = roles.find((r) => r.id === selectedRole) || roles[0];
  const IconComponent = currentRole.icon;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#FF6A00]" />
            Staff Roles &amp; Rapid Training Guide
          </h1>
          <p className="text-sm text-muted-foreground">
            Bilingual role cards and daily responsibilities in English &amp; தமிழ் (H-09).
          </p>
        </div>
        <button
          onClick={() => setShowTamil(!showTamil)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors self-start md:self-auto"
        >
          <Globe className="w-4 h-4 text-[#FF6A00]" />
          <span>{showTamil ? "Hide Tamil (தமிழ் மறை)" : "Show Tamil (தமிழ் காட்டு)"}</span>
        </button>
      </div>

      {/* Role Picker Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {roles.map((r) => {
          const isSel = r.id === selectedRole;
          const RoleIcon = r.icon;
          return (
            <button
              key={r.id}
              onClick={() => setSelectedRole(r.id)}
              className={`p-3 rounded-xl border text-left transition-all ${
                isSel
                  ? "bg-[#0B1F3B] text-white border-[#0B1F3B] dark:bg-white dark:text-[#0B1F3B] shadow"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              <RoleIcon className="w-5 h-5 mb-2 text-[#FF6A00]" />
              <div className="font-bold text-sm leading-tight">{r.titleEn}</div>
              {showTamil && <div className="text-xs opacity-80 mt-0.5">{r.titleTa}</div>}
            </button>
          );
        })}
      </div>

      {/* Active Role Detail Card */}
      <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#FF6A00]/10 flex items-center justify-center shrink-0">
            <IconComponent className="w-6 h-6 text-[#FF6A00]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {currentRole.titleEn}{" "}
              {showTamil && (
                <span className="text-base text-muted-foreground font-normal">
                  / {currentRole.titleTa}
                </span>
              )}
            </h2>
            <p className="text-sm text-foreground mt-1">{currentRole.overviewEn}</p>
            {showTamil && (
              <p className="text-xs text-muted-foreground mt-1">{currentRole.overviewTa}</p>
            )}
          </div>
        </div>

        {/* Primary Screens */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Primary Screens Used by this Role
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {currentRole.primaryScreens.map((s) => (
              <a
                key={s.path}
                href={s.path}
                className="p-3 rounded-lg border border-border bg-muted/40 hover:bg-muted text-xs font-semibold text-foreground flex items-center justify-between transition-colors"
              >
                <span>{s.name}</span>
                <span className="text-muted-foreground font-mono text-[10px]">&rarr;</span>
              </a>
            ))}
          </div>
        </div>

        {/* Daily Routine / Duties */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Daily Routine &amp; Best Practices
          </h3>
          <div className="space-y-3">
            {currentRole.dailyDutiesEn.map((dutyEn, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border border-border/60 bg-muted/20 flex items-start gap-3"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <div className="font-medium text-foreground">{dutyEn}</div>
                  {showTamil && (
                    <div className="text-muted-foreground">{currentRole.dailyDutiesTa[idx]}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
