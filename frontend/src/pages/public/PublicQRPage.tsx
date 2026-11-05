import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Utensils, AlertCircle, Clock } from "lucide-react";
import { BrandLogo } from "../../components/brand/BrandLogo";
import { apiClient } from "../../api/client";
import { useTranslation } from "react-i18next";

interface PublicQRResponse {
  valid: boolean;
  tenant_name: string;
  display_name?: string;
  logo_url?: string | null;
  brand_primary_color?: string;
  table_identifier?: string;
  area_name?: string;
  branch_name?: string;
}

export const PublicQRPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const [data, setData] = useState<PublicQRResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let isMounted = true;
    apiClient
      .get<PublicQRResponse>(`/public/qr/${token}/`)
      .then((res) => {
        if (isMounted) {
          setData(res.data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setNotFound(true);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#FF6A00] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Serving menu details...</p>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-between p-6">
        <header className="pt-6">
          <BrandLogo size={32} />
        </header>

        <main className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 mx-auto flex items-center justify-center mb-5">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            {t("publicQr.notFoundTitle")}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            {t("publicQr.notFoundMessage")}
          </p>
          <div className="text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-4">
            Token reference: <span className="font-mono text-slate-500">{token || "none"}</span>
          </div>
        </main>

        <footer className="pb-6 text-center text-xs text-slate-400">
          {t("publicQr.poweredBy")}
        </footer>
      </div>
    );
  }

  const brandColor = data.brand_primary_color || "#FF6A00";
  const venueTitle = data.display_name || data.tenant_name;
  const locationLabel = [data.branch_name, data.area_name, data.table_identifier]
    .filter(Boolean)
    .join(" • ");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-between p-4 sm:p-6">
      {/* Top Header */}
      <header className="w-full max-w-lg pt-4 pb-2 flex items-center justify-between">
        <BrandLogo size={28} />
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          Digital Dining
        </span>
      </header>

      {/* Main Dining Card */}
      <main className="w-full max-w-lg my-auto">
        <div
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
          style={{ borderTop: `6px solid ${brandColor}` }}
        >
          {/* Restaurant Banner / Identity */}
          <div className="p-6 text-center border-b border-slate-100 dark:border-slate-800">
            {data.logo_url ? (
              <div className="mx-auto mb-4 w-20 h-20 rounded-2xl bg-white shadow-sm border border-slate-100 p-2 flex items-center justify-center overflow-hidden">
                <img
                  src={data.logo_url}
                  alt={`${venueTitle} logo`}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ) : (
              <div
                className="mx-auto mb-4 w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-md"
                style={{ backgroundColor: brandColor }}
              >
                {venueTitle.slice(0, 2).toUpperCase()}
              </div>
            )}

            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {venueTitle}
            </h1>

            {locationLabel && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <Utensils className="w-3.5 h-3.5" />
                <span>{locationLabel}</span>
              </div>
            )}
          </div>

          {/* Coming Soon Notice Body */}
          <div className="p-6 sm:p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 mx-auto flex items-center justify-center">
              <Clock className="w-7 h-7" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {t("publicQr.comingSoonTitle")}
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-sm mx-auto">
                {t("publicQr.comingSoonMessage")}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-left">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Guest Notice
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Our contactless digital ordering experience is launching shortly for this venue. Table service and takeaway ordering remain available with on-duty staff.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-lg py-4 text-center">
        <p className="text-xs text-slate-400">
          {t("publicQr.poweredBy")}
        </p>
      </footer>
    </div>
  );
};
