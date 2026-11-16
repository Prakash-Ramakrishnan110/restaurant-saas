import React from "react";
import { SITE_CONFIG } from "../../content/site";
import type { Lang } from "../routes";

interface LegalPageProps {
  kind: "privacy" | "terms";
  lang: Lang;
}

export const LegalPage: React.FC<LegalPageProps> = ({ kind, lang }) => {
  return (
    <section className="py-12 mx-auto max-w-3xl px-4 sm:px-6 space-y-6">
      <div
        role="note"
        className="rounded-xl border border-amber-400 bg-amber-100 px-4 py-2.5 text-xs font-extrabold uppercase tracking-wide text-amber-950"
      >
        DRAFT FOR LAWYER REVIEW
      </div>

      {kind === "privacy" ? (
        <article className="space-y-4 text-sm text-slate-800 leading-relaxed">
          <h1 className="text-3xl font-bold font-display text-[#0B1F3B]">
            {lang === "ta" ? "தனியுரிமைக் கொள்கை" : "Privacy Notice"}
          </h1>
          <p>
            {lang === "ta"
              ? `${SITE_CONFIG.companyName} உங்கள் டெமோ கோரிக்கைக்காக மட்டுமே பெயர், மொபைல் எண், வணிக வகை மற்றும் நகரம் ஆகியவற்றைச் சேகரிக்கிறது.`
              : `${SITE_CONFIG.companyName} collects only the name, mobile number, business type, city and optional message you submit in the Book a Demo form.`}
          </p>
          <p>
            {lang === "ta"
              ? "இந்த இணையதளத்தில் மூன்றாம் தரப்பு கண்காணிப்பு குக்கீகள் அல்லது விளம்பரக் குறியீடுகள் இல்லை."
              : "This website uses zero third-party scripts, zero tracking cookies and zero advertising pixels."}
          </p>
          <p>
            {lang === "ta"
              ? `உங்கள் தகவலை நீக்க விரும்பினால் ${SITE_CONFIG.contactEmail} முகவரிக்கு மின்னஞ்சல் அனுப்பவும்.`
              : `Your details are kept only to schedule your demo and follow up. To request deletion of your details, email ${SITE_CONFIG.contactEmail}.`}
          </p>
        </article>
      ) : (
        <article className="space-y-4 text-sm text-slate-800 leading-relaxed">
          <h1 className="text-3xl font-bold font-display text-[#0B1F3B]">
            {lang === "ta" ? "பயன்பாட்டு விதிமுறைகள்" : "Terms of Use"}
          </h1>
          <p>
            {lang === "ta"
              ? `இந்த இணையதளம் ${SITE_CONFIG.companyName} வழங்கும் ServeMyFood மென்பொருள் பற்றிய தகவல்களை அளிக்கிறது.`
              : `This website is operated by ${SITE_CONFIG.companyName} to share information about ServeMyFood and accept demo requests.`}
          </p>
          <p>
            {lang === "ta"
              ? "இங்கு காட்டப்பட்டுள்ள வசதிகள் தற்போதைய செயலியின் நிலையைப் பொறுத்தது. விரைவில் எனக் குறிக்கப்பட்டவை இன்னும் உருவாக்கத்தில் உள்ளன."
              : "Features marked as live reflect what works in the software today. Items marked Coming soon are not yet available for production use."}
          </p>
        </article>
      )}
    </section>
  );
};
