export type ClaimStatus = "LIVE" | "SOON";

export interface ComparisonRowText {
  capabilityEn: string;
  capabilityTa: string;
  paperAndWhatsappEn: string;
  paperAndWhatsappTa: string;
  serveMyFoodEn: string;
  serveMyFoodTa: string;
}

export interface FeatureClaim {
  id: string;
  status: ClaimStatus;
  titleEn: string;
  titleTa: string;
  descEn: string;
  descTa: string;
  comparison?: ComparisonRowText;
}

export const FEATURE_CLAIMS: FeatureClaim[] = [
  // LIVE FEATURES
  {
    id: "kitchen-sound",
    status: "LIVE",
    titleEn: "Orders to the kitchen with a sound alert",
    titleTa: "ஒலி அறிவிப்புடன் சமையலறைக்கு உடனடி ஆர்டர்",
    descEn: "New orders appear on the kitchen screen immediately with a clear sound chime.",
    descTa: "புதிய ஆர்டர்கள் ஒலி அறிவிப்புடன் உடனடியாக சமையலறை திரையில் தோன்றும்.",
    comparison: {
      capabilityEn: "Orders reach the kitchen at once",
      capabilityTa: "ஆர்டர்கள் உடனே சமையலறையைச் சென்றடைதல்",
      paperAndWhatsappEn: "Paper slips get lost on busy counters; chat messages scroll out of sight.",
      paperAndWhatsappTa: "கூட்ட நேரத்தில் காகிதச் சீட்டுகள் தொலையும்; வாட்ஸ்அப் செய்திகள் தவறிப் போகும்.",
      serveMyFoodEn: "Every ticket lands on the kitchen screen right away with a clear chime and voice alert.",
      serveMyFoodTa: "ஒவ்வொரு ஆர்டரும் தெளிவான ஒலி மற்றும் குரல் அறிவிப்புடன் உடனே சமையலறை திரையில் தோன்றும்.",
    },
  },
  {
    id: "bilingual-menu",
    status: "LIVE",
    titleEn: "Menu with photos and Tamil names",
    titleTa: "புகைப்படம் மற்றும் தமிழ் பெயர்களுடன் மெனு",
    descEn: "Show dish photos, vegetarian or non-veg tags, and Tamil item names side by side.",
    descTa: "உணவு புகைப்படங்கள், சைவ/அசைவ குறியீடு மற்றும் தமிழ் பெயர்களை காண்பிக்கலாம்.",
  },
  {
    id: "sold-out-switch",
    status: "LIVE",
    titleEn: "One-tap sold-out switch",
    titleTa: "ஒரு தட்டில் விற்றுத் தீர்ந்ததைக் குறிக்கும் வசதி",
    descEn: "Mark a dish finished in one tap so waiters stop taking orders for it.",
    descTa: "ஒரு உணவு தீர்ந்துவிட்டால் ஒரு தட்டில் நிறுத்தலாம்; பணியாளர்கள் தவறாக ஆர்டர் எடுக்க மாட்டார்கள்.",
    comparison: {
      capabilityEn: "Sold-out in one tap",
      capabilityTa: "தீர்ந்த உணவை ஒரு தட்டில் நிறுத்துதல்",
      paperAndWhatsappEn: "Waiters learn a dish is finished only after walking back from the kitchen.",
      paperAndWhatsappTa: "சமையலறைக்குச் சென்று கேட்ட பிறகே உணவு தீர்ந்தது பணியாளருக்குத் தெரியும்.",
      serveMyFoodEn: "Switch off a finished dish once and every staff screen updates immediately.",
      serveMyFoodTa: "தீர்ந்த உணவை ஒரு தட்டில் நிறுத்தினால் அனைத்து பணியாளர் திரைகளிலும் உடனே மாறும்.",
    },
  },
  {
    id: "token-tv",
    status: "LIVE",
    titleEn: "Token display on a TV with voice callout",
    titleTa: "டிவி திரையில் டோக்கன் எண் மற்றும் குரல் அழைப்பு",
    descEn: "Show ready token numbers on any TV browser with a chime and English or Tamil callout.",
    descTa: "தயாரான டோக்கன் எண்களை டிவி திரையில் ஒலி மற்றும் தமிழ்/ஆங்கில குரலுடன் அழைக்கலாம்.",
    comparison: {
      capabilityEn: "Token on a TV",
      capabilityTa: "டிவி திரையில் டோக்கன் எண்",
      paperAndWhatsappEn: "Calling out numbers by voice across a noisy counter causes crowd confusion.",
      paperAndWhatsappTa: "கூட்டமான கவுண்டரில் சத்தமாக எண் கூப்பிடுவதால் வாடிக்கையாளர்களுக்கு குழப்பம் ஏற்படும்.",
      serveMyFoodEn: "Ready tokens appear in large numbers on a TV screen with a chime and voice call.",
      serveMyFoodTa: "தயாரான டோக்கன் எண்கள் டிவி திரையில் பெரிய எழுத்துக்களில் ஒலி மற்றும் குரலுடன் தோன்றும்.",
    },
  },
  {
    id: "table-and-counter",
    status: "LIVE",
    titleEn: "Table and counter service",
    titleTa: "இருக்கை மற்றும் கவுண்டர் சேவை",
    descEn: "Run dining rooms with floor layouts or fast counter queues with token numbers.",
    descTa: "இருக்கை வரிசை அல்லது டோக்கன் எண்களுடன் கூடிய கவுண்டர் சேவையை எளிதாக நடத்தலாம்.",
  },
  {
    id: "qr-codes",
    status: "LIVE",
    titleEn: "QR codes for dining spots and counters",
    titleTa: "உணவருந்தும் இடம் மற்றும் கவுண்டருக்கான QR குறியீடுகள்",
    descEn: "Print clean English and Tamil QR cards directly from the app.",
    descTa: "தமிழ் மற்றும் ஆங்கிலத்தில் அழகான QR அட்டைகளை செயலியிலிருந்தே அச்சிடலாம்.",
  },
  {
    id: "staff-roles",
    status: "LIVE",
    titleEn: "Staff roles with separate logins",
    titleTa: "பணியாளர்களுக்கு தனித்தனி உள்நுழைவு",
    descEn: "Waiters, cooks, cashiers and owners each sign in to only what they need.",
    descTa: "பணியாளர், சமையல்காரர், கேஷியர் மற்றும் உரிமையாளர் தங்களுக்குரிய திரையை மட்டும் பார்ப்பார்கள்.",
    comparison: {
      capabilityEn: "Separate logins",
      capabilityTa: "பணியாளர்களுக்கு தனித்தனி உள்நுழைவு",
      paperAndWhatsappEn: "Shared chat groups expose every order change and total to everyone.",
      paperAndWhatsappTa: "பொது வாட்ஸ்அப் குழுவில் அனைத்து விவரங்களும் எல்லோருக்கும் தெரியும்.",
      serveMyFoodEn: "Separate role logins for waiters, kitchen staff, cashiers, managers and owners.",
      serveMyFoodTa: "பணியாளர், சமையலறை, கேஷியர், மேலாளர் மற்றும் உரிமையாளருக்கு தனித்தனி உள்நுழைவு.",
    },
  },
  {
    id: "sales-at-a-glance",
    status: "LIVE",
    titleEn: "Daily sales at a glance",
    titleTa: "இன்றைய விற்பனை ஒரே பார்வையில்",
    descEn: "Check live daily totals, cash vs UPI split, and top dishes from any phone.",
    descTa: "இன்றைய மொத்த விற்பனை, ரொக்கம்/UPI பிரிவு மற்றும் அதிகம் விற்ற உணவுகளை போனில் பார்க்கலாம்.",
    comparison: {
      capabilityEn: "Sales at a glance",
      capabilityTa: "விற்பனை விவரம் ஒரே பார்வையில்",
      paperAndWhatsappEn: "Adding up paper bills and chat screenshots by hand at closing time.",
      paperAndWhatsappTa: "கடை மூடும்போது காகித பில்களையும் செய்திகளையும் கையால் கூட்டிப் பார்க்க வேண்டும்.",
      serveMyFoodEn: "Live daily sales, payment method split, and shift cash count on your phone.",
      serveMyFoodTa: "இன்றைய விற்பனை, ரொக்கம் மற்றும் UPI கணக்கை எப்போது வேண்டுமானாலும் போனில் பார்க்கலாம்.",
    },
  },
  {
    id: "branches",
    status: "LIVE",
    titleEn: "Multiple branches",
    titleTa: "பல கிளைகள் மேலாண்மை",
    descEn: "Switch between your branches and compare daily sales from one login.",
    descTa: "ஒரே உள்நுழைவில் உங்கள் அனைத்து கிளைகளின் தினசரி விற்பனையையும் பார்க்கலாம்.",
  },
  {
    id: "en-ta",
    status: "LIVE",
    titleEn: "English and Tamil on every screen",
    titleTa: "அனைத்து திரைகளிலும் தமிழ் மற்றும் ஆங்கிலம்",
    descEn: "Every staff member can switch between Tamil and English with one tap.",
    descTa: "ஒவ்வொரு பணியாளரும் ஒரு தட்டில் தமிழ் அல்லது ஆங்கிலத்திற்கு மாற்றிக்கொள்ளலாம்.",
  },

  // COMING SOON FEATURES (always shown in separate muted group with Coming soon tag)
  {
    id: "online-payments",
    status: "SOON",
    titleEn: "Online UPI payments",
    titleTa: "ஆன்லைன் UPI பணம் செலுத்தல்",
    descEn: "Direct guest UPI checkout settled straight to your business account.",
    descTa: "வாடிக்கையாளர்கள் நேரடியாக UPI மூலம் பணம் செலுத்தும் வசதி.",
  },
  {
    id: "shifts-attendance",
    status: "SOON",
    titleEn: "Staff shifts and attendance",
    titleTa: "பணியாளர் ஷிப்ட் மற்றும் வருகைப்பதிவு",
    descEn: "Track shift handovers and daily staff attendance in one place.",
    descTa: "ஷிப்ட் மாற்றம் மற்றும் பணியாளர் வருகையை ஒரே இடத்தில் பதிவு செய்யலாம்.",
  },
  {
    id: "room-service",
    status: "SOON",
    titleEn: "Hotel room service and room charges",
    titleTa: "ஹோட்டல் அறை சேவை மற்றும் அறை கணக்கு",
    descEn: "Post restaurant bills directly to guest room folios.",
    descTa: "உணவக பில்களை நேரடியாக விருந்தினர் அறை கணக்கில் சேர்க்கும் வசதி.",
  },
];
