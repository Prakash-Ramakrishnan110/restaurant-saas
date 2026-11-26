import React from "react";
import { Check, Clock } from "lucide-react";
import { FEATURE_CLAIMS } from "../../content/claims";
import type { Lang } from "../routes";

interface ComparisonSectionProps {
  lang: Lang;
}

export const ComparisonSection: React.FC<ComparisonSectionProps> = ({ lang }) => {
  const isTa = lang === "ta";
  // Strictly include ONLY capabilities marked LIVE in claims.ts that define comparison rows
  const liveComparisonClaims = FEATURE_CLAIMS.filter(
    (c) => c.status === "LIVE" && Boolean(c.comparison)
  );
  const soonClaims = FEATURE_CLAIMS.filter((c) => c.status === "SOON");

  return (
    <section
      id="comparison"
      data-testid="comparison-section"
      className="bg-[#FFF3E0]/70 border-y border-[#E6E1D8] py-12 lg:py-16"
    >
      <div className="mx-auto max-w-[1080px] px-5 sm:px-8 space-y-6">
        <div className="space-y-1.5 max-w-[60ch]">
          <h2 className="font-display font-semibold text-[24px] leading-[1.25] lg:text-[32px] text-[#0B1F3B]">
            {isTa
              ? "காகிதச் சீட்டு மற்றும் வாட்ஸ்அப் எதிர் ServeMyFood"
              : "Paper slips and WhatsApp versus ServeMyFood"}
          </h2>
          <p className="text-[15px] sm:text-[16px] leading-[1.55] text-[#0B1F3B]/80">
            {isTa
              ? "இன்று செயலியில் நேரடியாக இயங்கும் வசதிகளின் எளிய ஒப்பீடு."
              : "Simple everyday shop tasks using features live in ServeMyFood today."}
          </p>
        </div>

        {/* Desktop Minimal Table */}
        <div className="hidden md:block overflow-hidden rounded-[14px] border border-[#E6E1D8] bg-white">
          <table className="w-full text-left border-collapse">
            <caption className="sr-only">
              {isTa
                ? "காகிதச் சீட்டு மற்றும் வாட்ஸ்அப் எதிர் ServeMyFood ஒப்பீடு"
                : "Comparison of everyday tasks using paper slips and WhatsApp versus ServeMyFood"}
            </caption>
            <thead>
              <tr className="border-b border-[#E6E1D8] bg-[#0B1F3B] text-white">
                <th className="py-3.5 px-5 font-display font-semibold text-[14px] w-[26%]">
                  {isTa ? "தினசரி பணி" : "Task"}
                </th>
                <th className="py-3.5 px-5 font-display font-semibold text-[14px] w-[37%]">
                  {isTa ? "காகிதச் சீட்டு & வாட்ஸ்அப்" : "Paper slips and WhatsApp"}
                </th>
                <th className="py-3.5 px-5 font-display font-semibold text-[14px] w-[37%]">
                  ServeMyFood
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E1D8]">
              {liveComparisonClaims.map((item) => {
                const cmp = item.comparison!;
                return (
                  <tr key={item.id} className="align-top">
                    <td className="py-3.5 px-5 font-semibold text-[14px] text-[#0B1F3B]">
                      {isTa ? cmp.capabilityTa : cmp.capabilityEn}
                    </td>
                    <td className="py-3.5 px-5 text-[14px] leading-[1.5] text-[#0B1F3B]/75">
                      {isTa ? cmp.paperAndWhatsappTa : cmp.paperAndWhatsappEn}
                    </td>
                    <td className="py-3.5 px-5 text-[14px] leading-[1.5] text-[#0B1F3B] bg-[#1D9E75]/[0.05]">
                      <span className="inline-flex items-start gap-2">
                        <Check
                          className="h-4 w-4 text-[#1D9E75] shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <span>{isTa ? cmp.serveMyFoodTa : cmp.serveMyFoodEn}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Minimal List */}
        <div className="md:hidden space-y-3">
          {liveComparisonClaims.map((item) => {
            const cmp = item.comparison!;
            return (
              <article
                key={item.id}
                className="rounded-[12px] border border-[#E6E1D8] bg-white p-4 space-y-2"
              >
                <h3 className="font-display font-semibold text-[15px] text-[#0B1F3B]">
                  {isTa ? cmp.capabilityTa : cmp.capabilityEn}
                </h3>
                <p className="text-[13px] leading-[1.45] text-[#0B1F3B]/75">
                  <span className="font-semibold text-[#0B1F3B]">
                    {isTa ? "முன்பு: " : "Before: "}
                  </span>
                  {isTa ? cmp.paperAndWhatsappTa : cmp.paperAndWhatsappEn}
                </p>
                <p className="flex items-start gap-1.5 text-[13px] leading-[1.45] text-[#0B1F3B]">
                  <Check className="h-4 w-4 text-[#1D9E75] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{isTa ? cmp.serveMyFoodTa : cmp.serveMyFoodEn}</span>
                </p>
              </article>
            );
          })}
        </div>

        {/* Compact, Muted Coming Soon Strip */}
        {soonClaims.length > 0 && (
          <div
            data-testid="comparison-coming-soon"
            className="rounded-[12px] border border-[#E6E1D8] bg-white px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-slate-700"
          >
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#0B1F3B]">
              <Clock className="h-4 w-4 text-[#0B1F3B]" aria-hidden="true" />
              <span>{isTa ? "விரைவில்:" : "Coming soon:"}</span>
            </span>
            {soonClaims.map((claim) => (
              <span
                key={claim.id}
                className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-0.5 text-[12px] font-medium text-[#0B1F3B]"
              >
                {isTa ? claim.titleTa : claim.titleEn}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
