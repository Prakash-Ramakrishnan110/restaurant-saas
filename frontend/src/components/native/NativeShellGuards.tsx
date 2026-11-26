import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { App as CapApp } from "@capacitor/app";
import { Bell, Download, RefreshCw, ShieldAlert, Smartphone, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiClient, refreshAccessToken } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  getInstalledAppVersion,
  getOrCreateDeviceId,
  hasSeenNativeExplainer,
  initNativeShell,
  isNativeApp,
  markNativeExplainerSeen,
} from "../../native/bridge";

interface AndroidConfig {
  minimum_version_code: number;
  latest_version_code: number;
  download_url: string;
  maintenance_message: string;
}

export const NativeShellGuards: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const native = isNativeApp();
  const { i18n } = useTranslation();
  const isTa = i18n.language === "ta";
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [config, setConfig] = useState<AndroidConfig | null>(null);
  const [installedCode, setInstalledCode] = useState<number>(1);
  const [showExplainer, setShowExplainer] = useState<boolean>(false);
  const [backNotice, setBackNotice] = useState<boolean>(false);
  const lastBackPressRef = useRef<number>(0);

  const checkConfig = async () => {
    if (!native) return;
    try {
      const [ver, res] = await Promise.all([
        getInstalledAppVersion(),
        apiClient.get<AndroidConfig>("/app/android-config/"),
      ]);
      setInstalledCode(ver.code);
      setConfig(res.data);
    } catch {
      // Offline or unreachable — do not block app launch
    }
  };

  useEffect(() => {
    if (!native) return;
    void checkConfig();

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    let cleanupNative: (() => void) | undefined;
    void initNativeShell({
      onResume: () => {
        void refreshAccessToken();
        void checkConfig();
        window.dispatchEvent(new CustomEvent("smf:native-resume"));
      },
      onBackButton: (canGoBack) => {
        const rootPaths = ["/pos", "/kds", "/billing", "/dashboard", "/login"];
        if (canGoBack && !rootPaths.includes(location.pathname)) {
          navigate(-1);
          return;
        }
        const now = Date.now();
        if (now - lastBackPressRef.current < 2000) {
          void CapApp.exitApp();
        } else {
          lastBackPressRef.current = now;
          setBackNotice(true);
          setTimeout(() => setBackNotice(false), 2000);
        }
      },
    }).then((fn) => {
      cleanupNative = fn;
    });

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      if (cleanupNative) cleanupNative();
    };
  }, [native, location.pathname, navigate]);

  useEffect(() => {
    if (!native || !user) return;
    if (!hasSeenNativeExplainer()) {
      setShowExplainer(true);
    }
    void (async () => {
      try {
        const [deviceId, appInfo] = await Promise.all([
          getOrCreateDeviceId(),
          getInstalledAppVersion(),
        ]);
        await apiClient.put("/devices/me/", {
          device_id: deviceId,
          app_version: appInfo.name,
          device_name: "Android Staff",
        });
      } catch {
        // Non-blocking
      }
    })();
  }, [native, user]);

  if (!native) {
    return <>{children}</>;
  }

  // Blocking Update Required / Maintenance Screen
  if (config && (installedCode < config.minimum_version_code || config.maintenance_message)) {
    return (
      <div
        className="min-h-screen bg-[#0B1F3B] text-white flex items-center justify-center p-6"
        data-testid="native-update-screen"
      >
        <Card className="max-w-md w-full bg-card text-foreground">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldAlert className="h-5 w-5 text-[#FF6A00]" />
              {config.maintenance_message
                ? isTa
                  ? "பராமரிப்பு அறிவிப்பு"
                  : "App Maintenance"
                : isTa
                  ? "புதிய பதிப்பு தேவை"
                  : "Update Required"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              {config.maintenance_message ||
                (isTa
                  ? "தொடர ServeMyFood Staff செயலியின் புதிய பதிப்பை நிறுவவும்."
                  : "A newer version of ServeMyFood Staff is required to continue.")}
            </p>
            {config.download_url && (
              <a
                href={config.download_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full min-h-[56px] items-center justify-center gap-2 rounded-lg bg-[#FF6A00] px-4 font-bold text-[#0B1F3B]"
              >
                <Download className="h-5 w-5" />
                {isTa ? "புதிய APK பதிவிறக்கவும்" : "Download Latest APK"}
              </a>
            )}
            <Button
              variant="outline"
              className="w-full min-h-[56px]"
              onClick={() => void checkConfig()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {isTa ? "மீண்டும் சரிபார்க்கவும்" : "Check Again"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      {!isOnline && (
        <div
          data-testid="native-offline-banner"
          className="bg-amber-500 text-[#0B1F3B] px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 sticky top-0 z-50"
        >
          <WifiOff className="h-4 w-4" />
          <span>
            {isTa
              ? "இணைய இணைப்பு இல்லை — மீண்டும் இணைக்க காத்திருக்கிறது"
              : "You are offline — waiting for connection"}
          </span>
        </div>
      )}

      {showExplainer && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          data-testid="native-explainer-modal"
        >
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="h-5 w-5 text-[#FF6A00]" />
                {isTa ? "உடனடி ஆர்டர் ஒலி அறிவிப்புகள்" : "Stay Ready for Order Alerts"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                {isTa
                  ? "திரை பூட்டப்பட்டாலும் புதிய ஆர்டர்கள் மற்றும் உணவு தயார் ஒலிகள் கேட்க அறிவிப்புகளை அனுமதிக்கவும்."
                  : "Allow notifications so new orders, guest calls, and ready alerts ring clearly even when your phone screen is locked."}
              </p>
              <p className="flex items-start gap-2 text-xs">
                <Smartphone className="h-4 w-4 mt-0.5 shrink-0 text-[#FF6A00]" />
                <span>
                  {isTa
                    ? "பேட்டரி சேமிப்பான் இந்த செயலியை நிறுத்தாமல் இருக்க பின்னணி செயல்பாட்டை அனுமதிக்கவும்."
                    : "In phone Battery Settings, allow background activity so alerts are not delayed."}
                </span>
              </p>
              <Button
                className="w-full min-h-[56px] bg-[#FF6A00] text-[#0B1F3B] font-bold hover:bg-[#FF6A00]/90"
                onClick={() => {
                  markNativeExplainerSeen();
                  setShowExplainer(false);
                }}
              >
                {isTa ? "புரிந்தது, தொடரவும்" : "Got it, Continue"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {children}

      {backNotice && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-[#0B1F3B] text-white px-4 py-2 text-xs font-semibold shadow-lg">
          {isTa ? "வெளியேற மீண்டும் அழுத்தவும்" : "Press back again to exit"}
        </div>
      )}
    </>
  );
};
