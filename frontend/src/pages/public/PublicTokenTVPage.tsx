import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Bell,
  Clock,
  Globe,
  Maximize2,
  Minimize2,
  Moon,
  Sun,
  Volume2,
  VolumeX,
} from "lucide-react";
import { PublicTokenTVResponse, publicQrApi } from "../../api/publicQr";
import { playTokenCallAlert } from "../../utils/soundAlerts";

const COPY = {
  EN: {
    nowCalling: "NOW CALLING",
    readyTitle: "Ready for Pickup",
    preparingTitle: "Preparing",
    noneReady: "Ready tokens will appear here",
    nonePrep: "Kitchen queue is clear",
    enableAudio: "Sound & Voice On",
    mutedAudio: "Sound Muted",
    fullscreen: "Fullscreen",
    exitFullscreen: "Exit Fullscreen",
    unavailableTitle: "Display unavailable",
    unavailableBody: "Please ask counter staff for assistance.",
    watchScreen: "Please collect your order at the counter when your number is called.",
    calledCount: "Called",
  },
  TA: {
    nowCalling: "தற்போது அழைக்கப்படுகிறது",
    readyTitle: "எடுக்கத் தயார்",
    preparingTitle: "தயாராகிறது",
    noneReady: "தயாரான எண்கள் இங்கே தோன்றும்",
    nonePrep: "சமையலறை காத்திருப்பு காலியாக உள்ளது",
    enableAudio: "ஒலி & குரல் இயக்கம்",
    mutedAudio: "ஒலி நிறுத்தப்பட்டது",
    fullscreen: "முழு திரை",
    exitFullscreen: "திரையை சிறிதாக்கு",
    unavailableTitle: "திரை கிடைக்கவில்லை",
    unavailableBody: "தயவுசெய்து கவுண்டர் ஊழியரை அணுகவும்.",
    watchScreen: "உங்கள் எண் அழைக்கப்படும்போது கவுண்டரில் உணவை பெற்றுக்கொள்ளவும்.",
    calledCount: "அழைப்பு",
  },
} as const;

export const PublicTokenTVPage: React.FC = () => {
  const { token = "" } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicTokenTVResponse | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [lang, setLang] = useState<"EN" | "TA">("EN");
  const [darkMode, setDarkMode] = useState(true);
  const [soundActive, setSoundActive] = useState(true);
  const [voiceActive, setVoiceActive] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [flashCall, setFlashCall] = useState(false);

  const lastCallSigRef = useRef<string | null>(null);
  const soundActiveRef = useRef(soundActive);
  const voiceActiveRef = useRef(voiceActive);
  const langRef = useRef(lang);

  useEffect(() => {
    soundActiveRef.current = soundActive;
  }, [soundActive]);
  useEffect(() => {
    voiceActiveRef.current = voiceActive;
  }, [voiceActive]);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  const fetchTV = useCallback(async () => {
    if (!token) {
      setNotFound(true);
      return;
    }
    try {
      const res = await publicQrApi.getTokenTV(token);
      const next = res.data;
      setData(next);
      setNotFound(false);

      if (next.now_calling) {
        const sig = `${next.now_calling.token_number}:${next.now_calling.call_count}:${next.now_calling.last_called_at || ""}`;
        if (lastCallSigRef.current !== null && lastCallSigRef.current !== sig) {
          setFlashCall(true);
          setTimeout(() => setFlashCall(false), 3500);
          if (soundActiveRef.current) {
            playTokenCallAlert(next.now_calling.token_number, langRef.current, {
              bypassMuteSetting: true,
              withVoice: voiceActiveRef.current,
            });
          }
        }
        lastCallSigRef.current = sig;
      } else if (lastCallSigRef.current === null) {
        lastCallSigRef.current = "";
      }
    } catch {
      setNotFound(true);
    }
  }, [token]);

  useEffect(() => {
    fetchTV();
    let timerId: number | undefined;
    const schedule = () => {
      const delay = document.visibilityState === "visible" ? 3000 : 15000;
      timerId = window.setTimeout(async () => {
        await fetchTV();
        schedule();
      }, delay);
    };
    schedule();
    return () => {
      if (timerId !== undefined) window.clearTimeout(timerId);
    };
  }, [fetchTV]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      setIsFullscreen((prev) => !prev);
    }
  };

  const t = COPY[lang];

  if (notFound) {
    return (
      <main
        className={`min-h-screen flex items-center justify-center p-6 ${
          darkMode ? "bg-[#0B1F3B] text-white" : "bg-slate-50 text-[#0B1F3B]"
        }`}
      >
        <div
          className="max-w-md w-full rounded-2xl border border-border/40 p-8 text-center space-y-3 bg-card text-card-foreground shadow-lg"
          data-testid="tv-unavailable"
        >
          <Bell className="h-12 w-12 mx-auto text-[#FF6A00]" />
          <h1 className="text-2xl font-black">{t.unavailableTitle}</h1>
          <p className="text-sm text-muted-foreground">{t.unavailableBody}</p>
        </div>
      </main>
    );
  }

  return (
    <div
      className={`min-h-screen w-full overflow-x-hidden ${
        darkMode ? "bg-[#071426] text-white" : "bg-[#F8FAFC] text-[#0B1F3B]"
      }`}
      data-testid="token-tv-page"
    >
      {/* Top Broadcast Header */}
      <header
        className={`px-4 sm:px-8 py-4 border-b flex flex-wrap items-center justify-between gap-3 ${
          darkMode ? "bg-[#0B1F3B] border-white/10" : "bg-white border-slate-200"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {data?.logo_url ? (
            <img
              src={data.logo_url}
              alt={data.display_name}
              className="h-11 w-11 rounded-xl object-contain bg-white p-1 shrink-0"
            />
          ) : (
            <div className="h-11 w-11 rounded-xl bg-[#FF6A00] text-[#0B1F3B] font-black text-xl flex items-center justify-center shrink-0">
              {(data?.display_name || "S").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h1
              className={`text-xl sm:text-2xl font-black tracking-tight truncate ${
                darkMode ? "text-white" : "text-[#0B1F3B]"
              }`}
            >
              {data?.display_name || "ServeMyFood"}
            </h1>
            <p
              className={`text-xs sm:text-sm font-medium truncate ${
                darkMode ? "text-slate-300" : "text-slate-600"
              }`}
            >
              {data?.branch_name || ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const nextSound = !soundActive;
              setSoundActive(nextSound);
              if (nextSound && data?.now_calling) {
                playTokenCallAlert(data.now_calling.token_number, lang, {
                  bypassMuteSetting: true,
                  withVoice: voiceActive,
                });
              }
            }}
            data-testid="tv-sound-toggle"
            className={`min-h-[56px] px-4 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition ${
              soundActive
                ? "bg-[#FF6A00] text-[#0B1F3B] hover:bg-[#E55F00]"
                : darkMode
                  ? "bg-white/10 text-white hover:bg-white/20"
                  : "bg-slate-200 text-[#0B1F3B] hover:bg-slate-300"
            }`}
          >
            {soundActive ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            <span>{soundActive ? t.enableAudio : t.mutedAudio}</span>
          </button>

          <button
            type="button"
            onClick={() => setVoiceActive((v) => !v)}
            aria-label="Toggle voice callout"
            className={`min-h-[56px] px-3 rounded-xl text-xs sm:text-sm font-bold border ${
              darkMode
                ? "border-white/20 bg-white/5 text-white hover:bg-white/10"
                : "border-slate-300 bg-white text-[#0B1F3B] hover:bg-slate-100"
            }`}
          >
            {voiceActive ? "Voice: ON" : "Voice: OFF"}
          </button>

          <button
            type="button"
            onClick={() => setLang((prev) => (prev === "EN" ? "TA" : "EN"))}
            data-testid="tv-lang-toggle"
            className={`min-h-[56px] px-3.5 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 border ${
              darkMode
                ? "border-white/20 bg-white/5 text-white hover:bg-white/10"
                : "border-slate-300 bg-white text-[#0B1F3B] hover:bg-slate-100"
            }`}
          >
            <Globe className="h-4 w-4" />
            <span>{lang === "EN" ? "தமிழ்" : "English"}</span>
          </button>

          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            aria-label="Toggle display theme"
            data-testid="tv-theme-toggle"
            className={`min-h-[56px] min-w-[56px] rounded-xl inline-flex items-center justify-center border ${
              darkMode
                ? "border-white/20 bg-white/5 text-white hover:bg-white/10"
                : "border-slate-300 bg-white text-[#0B1F3B] hover:bg-slate-100"
            }`}
          >
            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? t.exitFullscreen : t.fullscreen}
            data-testid="tv-fullscreen-toggle"
            className={`min-h-[56px] px-3.5 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 border ${
              darkMode
                ? "border-white/20 bg-white/5 text-white hover:bg-white/10"
                : "border-slate-300 bg-white text-[#0B1F3B] hover:bg-slate-100"
            }`}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="hidden sm:inline">
              {isFullscreen ? t.exitFullscreen : t.fullscreen}
            </span>
          </button>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* NOW CALLING HERO */}
        {data?.now_calling && (
          <section
            aria-live="polite"
            data-testid="tv-now-calling"
            className={`rounded-3xl p-6 sm:p-10 text-center border-4 transition-all ${
              flashCall
                ? "border-emerald-400 bg-emerald-600 text-white shadow-2xl scale-[1.01]"
                : "border-[#FF6A00] bg-[#FF6A00] text-[#0B1F3B] shadow-xl"
            }`}
          >
            <div className="inline-flex items-center gap-2 text-sm sm:text-base font-black uppercase tracking-widest">
              <Bell className="h-5 w-5" />
              <span>{t.nowCalling}</span>
            </div>
            <div className="text-6xl sm:text-8xl lg:text-9xl font-black font-mono tracking-tight my-2">
              #{data.now_calling.token_number}
            </div>
            <p className="text-xs sm:text-base font-bold opacity-90">{t.watchScreen}</p>
          </section>
        )}

        {/* SPLIT BOARD: READY vs PREPARING */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* READY COLUMN */}
          <section
            className={`rounded-3xl p-5 sm:p-7 border ${
              darkMode
                ? "bg-[#0B1F3B] border-emerald-500/40"
                : "bg-white border-emerald-300 shadow-sm"
            }`}
            data-testid="tv-ready-section"
          >
            <div className="flex items-center justify-between gap-2 pb-4 mb-4 border-b border-emerald-500/30">
              <h2 className="text-xl sm:text-3xl font-black text-emerald-500">{t.readyTitle}</h2>
              <span className="px-3 py-1 rounded-full text-sm font-black bg-emerald-500/20 text-emerald-400">
                {data?.ready_tokens.length || 0}
              </span>
            </div>

            {!data || data.ready_tokens.length === 0 ? (
              <div
                className={`py-14 text-center text-base font-semibold ${
                  darkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                {t.noneReady}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {data.ready_tokens.map((tok) => (
                  <div
                    key={tok.order_number}
                    data-testid={`tv-ready-token-${tok.token_number}`}
                    className="rounded-2xl bg-emerald-600 text-white p-5 text-center shadow-lg"
                  >
                    <div className="text-4xl sm:text-5xl font-black font-mono">
                      #{tok.token_number}
                    </div>
                    {tok.call_count > 1 && (
                      <div className="text-xs font-bold mt-1 text-emerald-100">
                        {t.calledCount} ×{tok.call_count}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* PREPARING COLUMN */}
          <section
            className={`rounded-3xl p-5 sm:p-7 border ${
              darkMode ? "bg-[#0B1F3B] border-white/15" : "bg-white border-slate-200 shadow-sm"
            }`}
            data-testid="tv-preparing-section"
          >
            <div
              className={`flex items-center justify-between gap-2 pb-4 mb-4 border-b ${
                darkMode ? "border-white/15" : "border-slate-200"
              }`}
            >
              <h2
                className={`text-xl sm:text-3xl font-black flex items-center gap-2 ${
                  darkMode ? "text-white" : "text-[#0B1F3B]"
                }`}
              >
                <Clock className="h-6 w-6 text-[#D97706]" />
                <span>{t.preparingTitle}</span>
              </h2>
              <span
                className={`px-3 py-1 rounded-full text-sm font-black ${
                  darkMode ? "bg-white/10 text-slate-200" : "bg-slate-100 text-slate-700"
                }`}
              >
                {data?.preparing_tokens.length || 0}
              </span>
            </div>

            {!data || data.preparing_tokens.length === 0 ? (
              <div
                className={`py-14 text-center text-base font-semibold ${
                  darkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                {t.nonePrep}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {data.preparing_tokens.map((tok) => (
                  <div
                    key={tok.order_number}
                    data-testid={`tv-preparing-token-${tok.token_number}`}
                    className={`rounded-2xl p-5 text-center border ${
                      darkMode
                        ? "bg-white/5 border-white/15 text-white"
                        : "bg-slate-100 border-slate-300 text-[#0B1F3B]"
                    }`}
                  >
                    <div className="text-3xl sm:text-4xl font-black font-mono">
                      #{tok.token_number}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};
