import React, { useEffect, useState } from "react";
import { Bell, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import {
  getInstalledAppVersion,
  getOrCreateDeviceId,
  isNativeApp,
  setNativeKeepAwake,
} from "../../native/bridge";

export const NativePhoneSection: React.FC = () => {
  const { i18n } = useTranslation();
  const isTa = i18n.language === "ta";
  const native = isNativeApp();

  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [keepAwake, setKeepAwake] = useState(true);
  const [appInfo, setAppInfo] = useState<{ code: number; name: string }>({
    code: 1,
    name: "1.10.0",
  });
  const [shortDeviceId, setShortDeviceId] = useState("...");

  useEffect(() => {
    if (!native) return;
    void (async () => {
      const [ver, devId] = await Promise.all([getInstalledAppVersion(), getOrCreateDeviceId()]);
      setAppInfo(ver);
      setShortDeviceId(devId.slice(0, 8));
    })();
  }, [native]);

  if (!native) return null;

  return (
    <section
      className="rounded-xl border border-border bg-card p-5 space-y-4"
      data-testid="native-this-phone-section"
    >
      <div className="flex items-center gap-2">
        <Smartphone className="h-5 w-5 text-[#FF6A00]" />
        <div>
          <h2 className="text-base font-bold text-foreground">
            {isTa ? "இந்த தொலைபேசி" : "This phone"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isTa
              ? "Android பணியாளர் செயலி அறிவிப்புகள் மற்றும் திரை அமைப்புகள்."
              : "Android staff app notification status and screen settings."}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 py-2 border-t border-border">
        <div>
          <div className="text-sm font-semibold text-foreground">
            {isTa ? "தொலைபேசி எச்சரிக்கைகள்" : "Phone Alerts"}
          </div>
          <div className="text-xs text-muted-foreground">
            {isTa
              ? "நிலை: நிலை 2-ல் Firebase புஷ் இயக்கப்படும்"
              : "Notification status: Push alerts enabled in Stage 2"}
          </div>
        </div>
        <Switch checked={alertsEnabled} onCheckedChange={setAlertsEnabled} />
      </div>

      <div className="flex items-center justify-between gap-4 py-2 border-t border-border">
        <div>
          <div className="text-sm font-semibold text-foreground">
            {isTa ? "திரையை விழித்திருக்க வை" : "Keep screen awake"}
          </div>
          <div className="text-xs text-muted-foreground">
            {isTa
              ? "ஆர்டர் எடுக்கும்போது திரை அணைவதைத் தடுக்கவும்."
              : "Prevent the phone screen from dimming during active service."}
          </div>
        </div>
        <Switch
          checked={keepAwake}
          onCheckedChange={(checked) => {
            setKeepAwake(checked);
            void setNativeKeepAwake(checked);
          }}
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border">
        <div className="text-xs text-muted-foreground">
          {isTa ? "பதிப்பு" : "About"}: v{appInfo.name} ({appInfo.code}) · ID{" "}
          <span className="font-mono">{shortDeviceId}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled
          className="min-h-[56px] gap-2"
          data-testid="native-test-push-btn"
        >
          <Bell className="h-4 w-4 text-[#FF6A00]" />
          <span>{isTa ? "சோதனை எச்சரிக்கை (நிலை 2)" : "Send test alert (Stage 2)"}</span>
        </Button>
      </div>
    </section>
  );
};
