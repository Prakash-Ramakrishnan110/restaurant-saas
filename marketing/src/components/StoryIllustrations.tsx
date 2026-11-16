import React from "react";
import type { Lang } from "../routes";

interface StoryIllustrationProps {
  step: number;
  variant: "restaurant" | "counter" | "hotel";
  lang: Lang;
}

export const StoryIllustration: React.FC<StoryIllustrationProps> = ({ step, variant, lang }) => {
  const isCounter = variant === "counter";

  if (step === 0) {
    return (
      <svg viewBox="0 0 480 230" className="w-full h-[210px]" role="img" aria-label="Step 1 illustration">
        <rect width="480" height="230" rx="14" fill="#FFF8EE" />
        {/* Warm dining / counter backdrop */}
        <circle cx="95" cy="120" r="68" fill="#FFE7C2" />
        <circle cx="385" cy="110" r="56" fill="#FFE7C2" opacity="0.7" />

        {isCounter ? (
          <>
            {/* Tea counter & steaming chai glass */}
            <rect x="48" y="148" width="150" height="52" rx="10" fill="#0B1F3B" />
            <rect x="58" y="138" width="130" height="14" rx="5" fill="#FF6A00" />
            <path d="M105 92 L135 92 L130 138 L110 138 Z" fill="#D97706" />
            <path d="M112 78 Q118 68 112 58" stroke="#FF6A00" strokeWidth="3" fill="none" strokeLinecap="round" className="animate-pulse" />
            <path d="M126 80 Q132 70 126 60" stroke="#FF6A00" strokeWidth="3" fill="none" strokeLinecap="round" className="animate-pulse" />
            <circle cx="120" cy="45" r="14" fill="#0B1F3B" />
          </>
        ) : (
          <>
            {/* Illustrated Table 4 & Waiter with phone */}
            <rect x="54" y="148" width="120" height="12" rx="6" fill="#0B1F3B" />
            <rect x="108" y="160" width="12" height="40" fill="#0B1F3B" />
            <ellipse cx="90" cy="142" rx="18" ry="6" fill="#FFFFFF" stroke="#0B1F3B" strokeWidth="2" />
            <ellipse cx="140" cy="142" rx="16" ry="5" fill="#FFFFFF" stroke="#0B1F3B" strokeWidth="2" />
            {/* Table badge */}
            <rect x="74" y="96" width="80" height="26" rx="13" fill="#0B1F3B" />
            <text x="114" y="113" textAnchor="middle" fill="#FFFFFF" fontSize="12" fontWeight="700">
              {lang === "ta" ? "மேஜை 4" : "Table 4"}
            </text>
          </>
        )}

        {/* Phone Order Card */}
        <g className="animate-step-in">
          <rect x="235" y="24" width="205" height="182" rx="18" fill="#0B1F3B" />
          <rect x="245" y="34" width="185" height="162" rx="12" fill="#FFFFFF" />
          <rect x="255" y="46" width="165" height="28" rx="7" fill="#FFF3E0" />
          <text x="265" y="64" fill="#0B1F3B" fontSize="12" fontWeight="700">
            {isCounter
              ? lang === "ta"
                ? "2× தேநீர்  •  ₹40"
                : "2× Masala Chai  •  ₹40"
              : lang === "ta"
                ? "2× மசாலா தோசை • ₹180"
                : "2× Masala Dosa • ₹180"}
          </text>
          <rect x="255" y="82" width="165" height="28" rx="7" fill="#FFF3E0" />
          <text x="265" y="100" fill="#0B1F3B" fontSize="12" fontWeight="700">
            {isCounter
              ? lang === "ta"
                ? "1× சமோசா  •  ₹30"
                : "1× Samosa  •  ₹30"
              : lang === "ta"
                ? "2× பில்டர் காபி • ₹100"
                : "2× Filter Coffee • ₹100"}
          </text>
          <rect x="255" y="120" width="165" height="22" rx="6" fill="#F1F5F9" />
          <text x="265" y="135" fill="#334155" fontSize="10" fontWeight="600">
            {isCounter
              ? lang === "ta"
                ? "குறிப்பு: சர்க்கரை குறைவு"
                : "Note: Less sugar"
              : lang === "ta"
                ? "குறிப்பு: காரம் குறைவு"
                : "Note: Less spicy"}
          </text>
          <rect x="255" y="152" width="165" height="32" rx="8" fill="#FF6A00" />
          <text x="337" y="172" textAnchor="middle" fill="#0B1F3B" fontSize="12" fontWeight="800">
            {isCounter
              ? lang === "ta"
                ? "டோக்கன் உருவாக்கு →"
                : "Create Token →"
              : lang === "ta"
                ? "சமையலறைக்கு அனுப்பு →"
                : "Send to Kitchen →"}
          </text>
        </g>
      </svg>
    );
  }

  if (step === 1) {
    return (
      <svg viewBox="0 0 480 230" className="w-full h-[210px]" role="img" aria-label="Step 2 illustration">
        <rect width="480" height="230" rx="14" fill="#0B1F3B" />
        {/* Illustrated Chef */}
        <circle cx="96" cy="118" r="54" fill="#132B4F" />
        {/* Chef Hat */}
        <path d="M68 82 C62 62 84 56 96 64 C108 56 130 62 124 82 Z" fill="#FFFFFF" />
        <rect x="74" y="82" width="44" height="14" rx="4" fill="#E2E8F0" />
        {/* Chef face */}
        <circle cx="96" cy="112" r="20" fill="#FDBA74" />
        <path d="M64 176 C64 146 128 146 128 176 Z" fill="#FFFFFF" />

        {/* Kitchen Display Screen */}
        <g className="animate-step-in">
          <rect x="176" y="26" width="268" height="178" rx="16" fill="#1E293B" stroke="#FF6A00" strokeWidth="3" />
          <rect x="190" y="40" width="240" height="36" rx="8" fill="#FF6A00" />
          <text x="204" y="63" fill="#0B1F3B" fontSize="13" fontWeight="800">
            {isCounter
              ? lang === "ta"
                ? "டோக்கன் #12 — புதிய ஆர்டர்"
                : "Token #12 — NEW ORDER"
              : lang === "ta"
                ? "மேஜை 4 — புதிய ஆர்டர்"
                : "Table 4 — NEW TICKET"}
          </text>
          {/* Sound Wave Bell */}
          <circle cx="408" cy="58" r="14" fill="#0B1F3B" />
          <circle cx="408" cy="58" r="21" stroke="#0B1F3B" strokeWidth="2" fill="none" opacity="0.5" className="animate-ping" />
          <text x="408" y="62" textAnchor="middle" fill="#FF6A00" fontSize="13" fontWeight="800">♪</text>

          <rect x="190" y="88" width="240" height="58" rx="8" fill="#FFFFFF" />
          <text x="204" y="112" fill="#0B1F3B" fontSize="13" fontWeight="700">
            {isCounter ? "2× Chai  •  1× Samosa" : "2× Masala Dosa  •  2× Coffee"}
          </text>
          <text x="204" y="132" fill="#B45309" fontSize="11" fontWeight="700">
            {lang === "ta" ? "ஒலி அறிவிப்பு இயக்கப்பட்டது" : "Chime alert triggered"}
          </text>

          <rect x="190" y="158" width="240" height="32" rx="8" fill="#10B981" />
          <text x="310" y="178" textAnchor="middle" fill="#FFFFFF" fontSize="12" fontWeight="800">
            {lang === "ta" ? "சமையல் தொடங்கியது ✓" : "Preparing now ✓"}
          </text>
        </g>
      </svg>
    );
  }

  if (step === 2) {
    return (
      <svg viewBox="0 0 480 230" className="w-full h-[210px]" role="img" aria-label="Step 3 illustration">
        <rect width="480" height="230" rx="14" fill="#ECFDF5" />
        <circle cx="240" cy="115" r="88" fill="#D1FAE5" />

        {/* Serving Cloche / Token Board */}
        <g className="animate-step-in">
          <rect x="95" y="42" width="290" height="146" rx="18" fill="#FFFFFF" stroke="#10B981" strokeWidth="3" />
          {/* Cloche Dome */}
          <path d="M180 120 C180 78 300 78 300 120 Z" fill="#FF6A00" />
          <circle cx="240" cy="76" r="8" fill="#0B1F3B" />
          <rect x="165" y="120" width="150" height="12" rx="6" fill="#0B1F3B" />

          <rect x="135" y="144" width="210" height="30" rx="15" fill="#10B981" />
          <text x="240" y="164" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="800">
            {isCounter
              ? lang === "ta"
                ? "டோக்கன் #12 தயார்! பெற்றுக்கொள்ளவும்"
                : "Token #12 READY for Pickup ✓"
              : lang === "ta"
                ? "மேஜை 4 — உணவு பரிமாறப்பட்டது ✓"
                : "Table 4 — Ready & Served ✓"}
          </text>
        </g>
      </svg>
    );
  }

  if (step === 3) {
    return (
      <svg viewBox="0 0 480 230" className="w-full h-[210px]" role="img" aria-label="Step 4 illustration">
        <rect width="480" height="230" rx="14" fill="#FFF8EE" />
        {/* Cashier Screen */}
        <rect x="46" y="34" width="220" height="162" rx="16" fill="#0B1F3B" />
        <text x="68" y="64" fill="#FFB37A" fontSize="12" fontWeight="700">
          {lang === "ta" ? "கேஷியர் பில்லிங்" : "CASHIER SETTLEMENT"}
        </text>
        <text x="68" y="110" fill="#FFFFFF" fontSize="34" fontWeight="800">
          {isCounter ? "₹70" : "₹280"}
        </text>
        <rect x="68" y="138" width="176" height="36" rx="8" fill="#10B981" />
        <text x="156" y="160" textAnchor="middle" fill="#FFFFFF" fontSize="12" fontWeight="800">
          {lang === "ta" ? "பணம் பெறப்பட்டது ✓" : "Paid (Cash / UPI) ✓"}
        </text>

        {/* Illustrated 80mm Receipt */}
        <g className="animate-step-in">
          <path d="M298 28 L434 28 L434 198 L420 190 L406 198 L392 190 L378 198 L364 190 L350 198 L336 190 L322 198 L298 190 Z" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
          <text x="366" y="54" textAnchor="middle" fill="#0B1F3B" fontSize="12" fontWeight="800">
            SERVEMYFOOD
          </text>
          <line x1="314" y1="68" x2="418" y2="68" stroke="#CBD5E1" strokeDasharray="4 3" />
          <text x="314" y="90" fill="#334155" fontSize="11" fontWeight="600">
            {isCounter ? "2× Chai" : "2× Masala Dosa"}
          </text>
          <text x="418" y="90" textAnchor="end" fill="#0B1F3B" fontSize="11" fontWeight="700">
            {isCounter ? "₹40" : "₹180"}
          </text>
          <text x="314" y="112" fill="#334155" fontSize="11" fontWeight="600">
            {isCounter ? "1× Samosa" : "2× Filter Coffee"}
          </text>
          <text x="418" y="112" textAnchor="end" fill="#0B1F3B" fontSize="11" fontWeight="700">
            {isCounter ? "₹30" : "₹100"}
          </text>
          <line x1="314" y1="128" x2="418" y2="128" stroke="#CBD5E1" strokeDasharray="4 3" />
          <text x="314" y="152" fill="#0B1F3B" fontSize="13" fontWeight="800">
            TOTAL
          </text>
          <text x="418" y="152" textAnchor="end" fill="#FF6A00" fontSize="14" fontWeight="800">
            {isCounter ? "₹70" : "₹280"}
          </text>
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 480 230" className="w-full h-[210px]" role="img" aria-label="Step 5 illustration">
      <rect width="480" height="230" rx="14" fill="#0B1F3B" />
      <g className="animate-step-in">
        <rect x="44" y="28" width="392" height="174" rx="16" fill="#132B4F" stroke="#FF6A00" strokeWidth="2" />
        <text x="72" y="64" fill="#FFB37A" fontSize="12" fontWeight="700">
          {lang === "ta" ? "உரிமையாளர் நேரலை விற்பனை" : "OWNER LIVE DASHBOARD"}
        </text>
        <text x="72" y="112" fill="#FFFFFF" fontSize="34" fontWeight="800">
          {isCounter ? "₹8,470" : "₹14,280"}
        </text>
        <text x="72" y="140" fill="#34D399" fontSize="12" fontWeight="700">
          {isCounter
            ? lang === "ta"
              ? "142 டோக்கன்கள் முடிந்தன"
              : "142 tokens served today"
            : lang === "ta"
              ? "64 ஆர்டர்கள் • ரொக்கம் & UPI"
              : "64 orders • Cash, UPI & Card"}
        </text>

        {/* Rising Sales Bars */}
        <rect x="275" y="128" width="26" height="44" rx="5" fill="#FF6A00" opacity="0.65" />
        <rect x="311" y="108" width="26" height="64" rx="5" fill="#FF6A00" opacity="0.82" />
        <rect x="347" y="84" width="26" height="88" rx="5" fill="#FF6A00" />
        <rect x="383" y="58" width="26" height="114" rx="5" fill="#10B981" />
      </g>
    </svg>
  );
};
