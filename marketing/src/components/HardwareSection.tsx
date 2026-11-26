import React from "react";
import { Check, Laptop, Monitor, Smartphone } from "lucide-react";
import { getReadyHardwareKits } from "../../content/hardware";
import { getPagePath, type Lang } from "../routes";
import { getTestedDevices } from "../utils/testedPrinters";

interface HardwareSectionProps {
  lang: Lang;
  isFullPage?: boolean;
  onNavigate?: (path: string) => void;
}

const BYOD_CARDS = {
  en: [
    {
      icon: Smartphone,
      title: "Waiter or counter phone",
      desc: "Runs in Chrome or Edge on an Android phone or tablet over shop Wi-Fi or regular 4G.",
    },
    {
      icon: Laptop,
      title: "Kitchen & cashier screen",
      desc: "Use a tablet with sound turned on for kitchen tickets, and a laptop or tablet at the billing desk.",
    },
    {
      icon: Monitor,
      title: "Token TV screen",
      desc: "Open the public Token TV link in any TV web browser to show and call out ready numbers.",
    },
  ],
  ta: [
    {
      icon: Smartphone,
      title: "பணியாளர் அல்லது கவுண்டர் போன்",
      desc: "கடை Wi-Fi அல்லது சாதாரண 4G இணைப்பில் Android போன் அல்லது டேப்லெட் உலாவியில் இயங்கும்.",
    },
    {
      icon: Laptop,
      title: "சமையலறை மற்றும் பில்லிங் திரை",
      desc: "சமையலறைக்கு ஒலி வசதியுள்ள டேப்லெட், பில்லிங் கவுண்டருக்கு லேப்டாப் அல்லது டேப்லெட் போதும்.",
    },
    {
      icon: Monitor,
      title: "டோக்கன் டிவி திரை",
      desc: "இணைய உலாவி உள்ள எந்த டிவியிலும் டோக்கன் இணைப்பைத் திறந்து தயாரான எண்களைக் காட்டலாம்.",
    },
  ],
} as const;

export const HardwareSection: React.FC<HardwareSectionProps> = ({
  lang,
  isFullPage = false,
  onNavigate,
}) => {
  const readyKits = getReadyHardwareKits();
  const testedDevices = getTestedDevices();
  const isTa = lang === "ta";
  const hardwarePath = getPagePath("hardware", lang);
  const demoPath = getPagePath("book-demo", lang);
  const CardHeading = isFullPage ? "h2" : "h3";

  const handleNav = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (onNavigate && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      onNavigate(path);
    }
  };

  return (
    <div id="hardware" data-testid="hardware-section">
      {isFullPage && (
        <section className="bg-[#FFF3E0] border-b border-[#0B1F3B]/10 py-10 sm:py-16">
          <div className="mx-auto max-w-[1280px] px-5 sm:px-8 space-y-4">
            <h1
              className={`font-display font-semibold text-[28px] lg:text-[42px] text-[#0B1F3B] ${
                isTa ? "leading-[1.28] max-w-[26ch]" : "leading-[1.15] max-w-[28ch]"
              }`}
            >
              {isTa
                ? "உங்களிடம் உள்ள சாதனங்களிலேயே தொடங்குங்கள்"
                : "Works on devices you already own"}
            </h1>
            <p className="text-[17px] lg:text-[18px] leading-[1.6] text-[#0B1F3B]/85 max-w-[65ch]">
              {isTa
                ? "ServeMyFood நவீன இணைய உலாவியில் இயங்குகிறது. தொடங்குவதற்குத் தனிப்பட்ட பில்லிங் இயந்திரம் வாங்கத் தேவையில்லை."
                : "ServeMyFood runs in a modern web browser. You can start with your existing Android phones, tablets, laptops, and TV screens."}
            </p>
          </div>
        </section>
      )}

      <section className={isFullPage ? "bg-white py-12 lg:py-20" : "bg-white py-12 lg:py-16"}>
        <div className={`${isFullPage ? "max-w-[1280px]" : "max-w-[1080px]"} mx-auto px-5 sm:px-8 space-y-6`}>
          {!isFullPage && (
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-1.5 max-w-[56ch]">
                <h2 className="font-display font-semibold text-[24px] leading-[1.25] lg:text-[32px] text-[#0B1F3B]">
                  {isTa
                    ? "உங்கள் போன், டேப்லெட், லேப்டாப் அல்லது டிவியில் இயங்கும்"
                    : "Use your own phone, tablet, laptop or TV"}
                </h2>
                <p className="text-[15px] sm:text-[16px] leading-[1.55] text-[#0B1F3B]/80">
                  {isTa
                    ? "தனிப்பட்ட பில்லிங் இயந்திரம் தேவையில்லை — நவீன உலாவியில் உடனே தொடங்கலாம்."
                    : "No special billing hardware needed — start in any modern web browser."}
                </p>
              </div>

              <a
                href={hardwarePath}
                onClick={(e) => handleNav(e, hardwarePath)}
                className="inline-flex w-full sm:w-auto items-center justify-center min-h-[48px] px-4 rounded-[12px] border border-[#0B1F3B]/25 bg-[#FFF3E0]/60 text-[14px] font-semibold text-[#0B1F3B] hover:bg-[#FFF3E0] transition-colors shrink-0"
              >
                {isTa ? "சாதன வழிகாட்டி" : "See hardware guide"}
              </a>
            </div>
          )}

          {/* READY Hardware Kits (rendered ONLY when status === "READY" and ownerApproved === true) */}
          {readyKits.length > 0 ? (
            <div
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
              data-testid="ready-hardware-kits"
            >
              {readyKits.map((kit) => {
                const title = isTa ? kit.titleTa : kit.titleEn;
                const summary = isTa ? kit.summaryTa : kit.summaryEn;
                const contents = isTa ? kit.contentsTa : kit.contentsEn;
                const notes = isTa ? kit.ownerNotesTa : kit.ownerNotesEn;
                return (
                  <article
                    key={kit.id}
                    data-testid={`hardware-kit-${kit.id}`}
                    className="rounded-[16px] border border-[#E6E1D8] bg-white overflow-hidden flex flex-col"
                  >
                    <img
                      src={`/hardware-photos/${kit.photo}`}
                      alt={title}
                      loading="lazy"
                      width={640}
                      height={400}
                      className="w-full aspect-[16/10] object-cover bg-[#FFF3E0]/40"
                    />
                    <div className="p-6 space-y-4 flex-1 flex flex-col">
                      <div className="space-y-1.5">
                        <CardHeading className="font-display font-semibold text-[20px] text-[#0B1F3B]">
                          {title}
                        </CardHeading>
                        <p className="text-[15px] leading-[1.55] text-[#0B1F3B]/85">{summary}</p>
                      </div>
                      <ul className="space-y-2 pt-1 flex-1">
                        {contents.map((line) => (
                          <li
                            key={line}
                            className="flex items-start gap-2.5 text-[14px] text-[#0B1F3B]"
                          >
                            <Check
                              className="h-4 w-4 text-[#1D9E75] shrink-0 mt-1"
                              aria-hidden="true"
                            />
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                      {notes && (
                        <p className="text-[13px] text-[#0B1F3B]/80 border-t border-[#E6E1D8] pt-3">
                          {notes}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {BYOD_CARDS[lang].map((card) => {
                  const Icon = card.icon;
                  return (
                    <article
                      key={card.title}
                      className="rounded-[16px] border border-[#E6E1D8] bg-[#FFF3E0]/35 p-6 space-y-3"
                    >
                      <div className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#0B1F3B] text-white">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <CardHeading className="font-display font-semibold text-[20px] text-[#0B1F3B]">
                        {card.title}
                      </CardHeading>
                      <p className="text-[15px] leading-[1.6] text-[#0B1F3B]/85">{card.desc}</p>
                    </article>
                  );
                })}
              </div>

              <div
                data-testid="hardware-kits-pending"
                className="rounded-[16px] border border-[#E6E1D8] bg-white p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1 max-w-[68ch]">
                  <p className="font-semibold text-[16px] text-[#0B1F3B]">
                    {isTa
                      ? "முன்-சரிபார்க்கப்பட்ட சாதனத் தொகுப்புகள் (விரைவில்)"
                      : "Optional starter hardware kits (in preparation)"}
                  </p>
                  <p className="text-[14px] leading-[1.55] text-[#0B1F3B]/80">
                    {isTa
                      ? "கவுண்டர் டோக்கன் டிவி தொகுப்பு மற்றும் உணவக சேவை தொகுப்புகள் நேரடிப் புகைப்படங்களுடன் சரிபார்க்கப்பட்ட பின் இங்கே சேர்க்கப்படும். அதுவரை உங்கள் சொந்த சாதனங்களைப் பயன்படுத்தலாம்."
                      : "Counter Token TV and Table Service kits are listed only after real kit photos and contents are verified. Need advice on screens or browser printing for your shop?"}
                  </p>
                </div>
                <a
                  href={demoPath}
                  onClick={(e) => handleNav(e, demoPath)}
                  className="inline-flex w-full sm:w-auto items-center justify-center min-h-[48px] px-5 rounded-[12px] bg-[#FF6A00] text-[15px] font-semibold text-[#0B1F3B] hover:bg-[#e55f00] transition-colors shrink-0"
                >
                  {isTa ? "டெமோவில் கேளுங்கள்" : "Ask during your demo"}
                </a>
              </div>
            </div>
          )}

          {/* Tested Devices Table — rendered ONLY when docs/help/printers-tested.md has data rows */}
          {testedDevices.length > 0 && (
            <div className="space-y-3 pt-4" data-testid="tested-devices-section">
              <h2 className="font-display font-semibold text-[22px] text-[#0B1F3B]">
                {isTa ? "சோதிக்கப்பட்ட பிரிண்டர்கள்" : "Tested printers"}
              </h2>
              <div className="overflow-x-auto rounded-[16px] border border-[#E6E1D8]">
                <table
                  data-testid="tested-devices-table"
                  className="w-full text-left border-collapse text-[14px]"
                >
                  <caption className="sr-only">
                    {isTa ? "சோதிக்கப்பட்ட பிரிண்டர்கள்" : "Printers verified with ServeMyFood browser printing"}
                  </caption>
                  <thead className="bg-[#FFF3E0]/60 text-[#0B1F3B]">
                    <tr>
                      <th className="py-3 px-4 font-semibold">{isTa ? "மாடல்" : "Model"}</th>
                      <th className="py-3 px-4 font-semibold">{isTa ? "தேதி" : "Date"}</th>
                      <th className="py-3 px-4 font-semibold">{isTa ? "முடிவு" : "Result"}</th>
                      <th className="py-3 px-4 font-semibold">
                        {isTa ? "சோதித்தவர்" : "Tested By"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E1D8] bg-white">
                    {testedDevices.map((row) => (
                      <tr key={`${row.model}-${row.date}`}>
                        <td className="py-3 px-4 font-medium text-[#0B1F3B]">{row.model}</td>
                        <td className="py-3 px-4 text-[#0B1F3B]/85">{row.date}</td>
                        <td className="py-3 px-4 text-[#0B1F3B]/85">{row.result}</td>
                        <td className="py-3 px-4 text-[#0B1F3B]/85">{row.testedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
