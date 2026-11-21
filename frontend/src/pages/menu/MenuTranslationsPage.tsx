import React, { useState, useEffect, useCallback } from "react";
import { Globe, CheckCircle2, AlertCircle, Sparkles, Send } from "lucide-react";
import { apiClient } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";

interface LanguageSpec {
  code: string;
  english_name: string;
  native_name: string;
  direction: "ltr" | "rtl";
  chrome_ready: boolean;
}

interface TranslationEntry {
  id: string | null;
  entity_type: string;
  entity_id: string;
  entity_label: string;
  language: string;
  field: string;
  original_text: string;
  text: string;
  status: "MISSING" | "DRAFT" | "OUTDATED" | "REVIEWED" | "PUBLISHED";
  source: string;
}

export const MenuTranslationsPage: React.FC = () => {
  const [language, setLanguage] = useState<string>("ta");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [languages, setLanguages] = useState<LanguageSpec[]>([]);
  const [entries, setEntries] = useState<TranslationEntry[]>([]);
  const [draftTexts, setDraftTexts] = useState<Record<string, string>>({});
  const [providerAvailable, setProviderAvailable] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Second confirmation modal for ingredients_note / allergen_note publishing
  const [allergenConfirmEntry, setAllergenConfirmEntry] = useState<TranslationEntry | null>(null);

  const entryKey = (e: TranslationEntry) => `${e.entity_type}:${e.entity_id}:${e.field}`;

  const fetchTranslations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{
        language: string;
        provider_available: boolean;
        languages: LanguageSpec[];
        entries: TranslationEntry[];
      }>("/menu/translations/", {
        params: {
          language,
          ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
        },
      });
      setLanguages(res.data.languages || []);
      setProviderAvailable(Boolean(res.data.provider_available));
      const list = res.data.entries || [];
      setEntries(list);
      const nextDrafts: Record<string, string> = {};
      list.forEach((e) => {
        nextDrafts[entryKey(e)] = e.text || "";
      });
      setDraftTexts(nextDrafts);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Failed to load menu translations.");
    } finally {
      setLoading(false);
    }
  }, [language, statusFilter]);

  useEffect(() => {
    void fetchTranslations();
  }, [fetchTranslations]);

  const handleAction = async (
    entry: TranslationEntry,
    actionName: "upsert" | "review" | "publish",
    allergenConfirmed = false
  ) => {
    const key = entryKey(entry);
    if (
      actionName === "publish" &&
      (entry.field === "ingredients_note" || entry.field === "allergen_note") &&
      !allergenConfirmed
    ) {
      setAllergenConfirmEntry(entry);
      return;
    }

    setBusyKey(key);
    setError(null);
    setNotice(null);
    try {
      await apiClient.post(`/menu/translations/${actionName}/`, {
        entity_type: entry.entity_type,
        entity_id: entry.entity_id,
        language,
        field: entry.field,
        text: draftTexts[key] ?? entry.text,
        original_text: entry.original_text,
        allergen_confirmed: allergenConfirmed,
      });
      setNotice(
        actionName === "publish"
          ? `Published ${entry.field} for ${entry.entity_label}.`
          : actionName === "review"
            ? `Marked ${entry.field} as reviewed.`
            : `Saved draft for ${entry.entity_label}.`
      );
      await fetchTranslations();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Could not update translation.");
    } finally {
      setBusyKey(null);
    }
  };

  const handleSuggest = async () => {
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.post<{ suggested_count: number }>("/menu/translations/suggest/", {
        language,
      });
      setNotice(`Generated ${res.data.suggested_count} draft suggestions.`);
      await fetchTranslations();
    } catch (err: any) {
      setError(
        err?.response?.data?.error?.message ||
          "Automatic suggestions are not set up. You can type translations yourself."
      );
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Globe className="w-6 h-6 text-[#FF6A00]" />
            Menu Translations
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Prepare, review, and publish menu translations. Only Published translations appear to
            guests.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            aria-label="Select translation language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-input bg-background min-h-[38px]"
          >
            {(languages.length > 0
              ? languages.filter((l) => l.code !== "en")
              : [{ code: "ta", english_name: "Tamil", native_name: "தமிழ்", chrome_ready: true }]
            ).map((l) => (
              <option key={l.code} value={l.code}>
                {l.english_name} ({l.native_name}){l.chrome_ready ? "" : " — Menu Prep Only"}
              </option>
            ))}
          </select>

          {providerAvailable ? (
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSuggest()}
              className="bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold text-xs gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Suggest Drafts
            </Button>
          ) : (
            <span className="text-[11px] text-muted-foreground px-2.5 py-1.5 rounded-md border border-border bg-muted/40">
              Automatic suggestions are not set up. You can type translations yourself.
            </span>
          )}
        </div>
      </div>

      {notice && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Status filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["ALL", "MISSING", "OUTDATED", "DRAFT", "REVIEWED", "PUBLISHED"] as const).map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${
              statusFilter === st
                ? "bg-[#0B1F3B] text-white border-[#0B1F3B] dark:bg-white dark:text-[#0B1F3B]"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      <div className="border border-border rounded-xl bg-card overflow-x-auto shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 border-b border-border uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Menu Item / Entity</th>
              <th className="p-3">Field</th>
              <th className="p-3">Original Text</th>
              <th className="p-3 min-w-[240px]">Translation</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  Loading translations...
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  No translation entries match the current filter.
                </td>
              </tr>
            ) : (
              entries.map((entry) => {
                const key = entryKey(entry);
                const isBusy = busyKey === key;
                return (
                  <tr key={key} className="hover:bg-muted/20">
                    <td className="p-3 font-semibold text-foreground">{entry.entity_label}</td>
                    <td className="p-3 font-mono text-[11px] text-muted-foreground">
                      {entry.field}
                    </td>
                    <td className="p-3 text-foreground max-w-xs">{entry.original_text}</td>
                    <td className="p-3">
                      <Input
                        aria-label={`Translation for ${entry.entity_label} ${entry.field}`}
                        value={draftTexts[key] ?? ""}
                        onChange={(e) =>
                          setDraftTexts((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        placeholder="Type translation..."
                        className="h-8 text-xs"
                      />
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          entry.status === "PUBLISHED"
                            ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                            : entry.status === "OUTDATED"
                              ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                              : entry.status === "MISSING"
                                ? "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-300"
                                : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => void handleAction(entry, "upsert")}
                        className="h-7 text-[11px]"
                      >
                        Save Draft
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => void handleAction(entry, "review")}
                        className="h-7 text-[11px]"
                      >
                        Mark Reviewed
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        data-testid={`publish-translation-${entry.entity_id}-${entry.field}`}
                        disabled={isBusy || !(draftTexts[key] ?? "").trim()}
                        onClick={() => void handleAction(entry, "publish")}
                        className="h-7 text-[11px] bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold"
                      >
                        <Send className="w-3 h-3 mr-1" />
                        Publish
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(allergenConfirmEntry)}
        onOpenChange={(open) => !open && setAllergenConfirmEntry(null)}
        title="Confirm Allergen & Ingredients Translation"
        description="I checked this information. Guests rely on accurate allergen and ingredients notes."
        confirmLabel="I checked this information — Publish"
        onConfirm={async () => {
          if (allergenConfirmEntry) {
            const target = allergenConfirmEntry;
            setAllergenConfirmEntry(null);
            await handleAction(target, "publish", true);
          }
        }}
      />
    </div>
  );
};
