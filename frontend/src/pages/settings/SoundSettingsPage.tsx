import React, { useState } from "react";
import { Volume2, Bell, ChefHat, ShoppingBag, CheckCircle2, Save } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";

// Web Audio API tone generator
function playSynthesizedTone(type: "order" | "ready" | "bell", volumeLevel: number) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime((volumeLevel / 100) * 0.3, ctx.currentTime);
    gainNode.connect(ctx.destination);

    if (type === "order") {
      // Upbeat dual tone for new order (880Hz then 1174Hz)
      const osc1 = ctx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      osc1.connect(gainNode);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.15);

      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1174, ctx.currentTime + 0.16);
      osc2.connect(gainNode);
      osc2.start(ctx.currentTime + 0.16);
      osc2.stop(ctx.currentTime + 0.35);
    } else if (type === "ready") {
      // 3-note ascending chime for food ready (C5 -> E5 -> G5)
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
        osc.connect(gainNode);
        osc.start(ctx.currentTime + idx * 0.12);
        osc.stop(ctx.currentTime + idx * 0.12 + 0.2);
      });
    } else if (type === "bell") {
      // High ding
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1760, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
      osc.connect(gainNode);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.8);
    }
  } catch (err) {
    console.warn("Web Audio chime could not play:", err);
  }
}

export const SoundSettingsPage: React.FC = () => {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem("smf_sound_enabled") !== "false";
  });
  const [orderChime, setOrderChime] = useState<boolean>(() => {
    return localStorage.getItem("smf_sound_order") !== "false";
  });
  const [readyChime, setReadyChime] = useState<boolean>(() => {
    return localStorage.getItem("smf_sound_ready") !== "false";
  });
  const [bellChime, setBellChime] = useState<boolean>(() => {
    return localStorage.getItem("smf_sound_bell") !== "false";
  });
  const [volume, setVolume] = useState<number>(() => {
    const val = localStorage.getItem("smf_sound_volume");
    return val ? parseInt(val, 10) : 80;
  });
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = () => {
    localStorage.setItem("smf_sound_enabled", String(soundEnabled));
    localStorage.setItem("smf_sound_order", String(orderChime));
    localStorage.setItem("smf_sound_ready", String(readyChime));
    localStorage.setItem("smf_sound_bell", String(bellChime));
    localStorage.setItem("smf_sound_volume", String(volume));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleTestSound = (type: "order" | "ready" | "bell") => {
    if (!soundEnabled) return;
    playSynthesizedTone(type, volume);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
          <Volume2 className="w-6 h-6 text-primary" />
          Sound & Alerts{" "}
          <span className="text-xs text-muted-foreground font-normal">ஒலி & எச்சரிக்கைகள்</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure auditory notifications for incoming table orders, kitchen ticket completions,
          and service bells.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 rounded-lg text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Sound preferences saved successfully!
        </div>
      )}

      {/* Master Toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                Enable Audio Notifications
              </CardTitle>
              <CardDescription className="text-xs">
                Plays gentle synthesiser chimes through device speakers when key restaurant events
                trigger.
              </CardDescription>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </CardHeader>
        {soundEnabled && (
          <CardContent className="space-y-4 pt-0">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span>Alert Volume ({volume}%)</span>
                <span>{volume > 50 ? "High" : "Low"}</span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                value={volume}
                onChange={(e) => setVolume(parseInt(e.target.value, 10))}
                className="w-full accent-primary h-2 bg-muted rounded-lg cursor-pointer"
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Individual Alerts */}
      <Card className={!soundEnabled ? "opacity-50 pointer-events-none" : ""}>
        <CardHeader>
          <CardTitle className="text-base font-bold">Event Notification Sounds</CardTitle>
          <CardDescription className="text-xs">
            Toggle specific notification triggers for your staff stations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 divide-y">
          {/* New Order */}
          <div className="flex items-center justify-between pt-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  New Order Placed (புதிய ஆர்டர்)
                </h4>
                <p className="text-xs text-muted-foreground">
                  Fires when waiter or customer submits a ticket.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleTestSound("order")}
              >
                Test Chime
              </Button>
              <input
                type="checkbox"
                checked={orderChime}
                onChange={(e) => setOrderChime(e.target.checked)}
                className="w-4 h-4 accent-primary rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Kitchen Ready */}
          <div className="flex items-center justify-between pt-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                <ChefHat className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">Food Ready (உணவு தயார்)</h4>
                <p className="text-xs text-muted-foreground">
                  Fires when kitchen chef bumps a ticket on KDS.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleTestSound("ready")}
              >
                Test Chime
              </Button>
              <input
                type="checkbox"
                checked={readyChime}
                onChange={(e) => setReadyChime(e.target.checked)}
                className="w-4 h-4 accent-primary rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Table Service Bell */}
          <div className="flex items-center justify-between pt-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  Customer Call Bell (அழைப்பு மணி)
                </h4>
                <p className="text-xs text-muted-foreground">
                  Fires when guest rings the digital QR call button.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleTestSound("bell")}
              >
                Test Chime
              </Button>
              <input
                type="checkbox"
                checked={bellChime}
                onChange={(e) => setBellChime(e.target.checked)}
                className="w-4 h-4 accent-primary rounded cursor-pointer"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="sm" className="gap-2" onClick={handleSave}>
          <Save className="w-4 h-4" />
          Save Preferences
        </Button>
      </div>
    </div>
  );
};
