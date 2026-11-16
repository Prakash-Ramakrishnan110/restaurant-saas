export type ClaimStatus = "LIVE" | "SOON";

export interface FeatureClaim {
  id: string;
  status: ClaimStatus;
  titleEn: string;
  titleTa: string;
  descEn: string;
  descTa: string;
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
    titleEn: "QR codes for dining spots",
    titleTa: "உணவருந்தும் இடங்களுக்கான QR குறியீடுகள்",
    descEn: "Print clean English and Tamil QR tent cards directly from the app.",
    descTa: "தமிழ் மற்றும் ஆங்கிலத்தில் அழகான QR அட்டைகளை செயலியிலிருந்தே அச்சிடலாம்.",
  },
  {
    id: "staff-roles",
    status: "LIVE",
    titleEn: "Staff roles with separate logins",
    titleTa: "பணியாளர்களுக்கு தனித்தனி உள்நுழைவு",
    descEn: "Waiters, cooks, cashiers and owners each sign in to only what they need.",
    descTa: "பணியாளர், சமையல்காரர், கேஷியர் மற்றும் உரிமையாளர் தங்களுக்குரிய திரையை மட்டும் பார்ப்பார்கள்.",
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

  // COMING SOON FEATURES (always shown in muted group with Coming soon tag)
  {
    id: "guest-qr-ordering",
    status: "SOON",
    titleEn: "Customer QR ordering and tracking",
    titleTa: "வாடிக்கையாளர் QR ஆர்டர் மற்றும் நிலை கண்காணிப்பு",
    descEn: "Guests scan at their seat, place orders and watch live kitchen status.",
    descTa: "வாடிக்கையாளர்கள் QR ஸ்கேன் செய்து ஆர்டர் செய்து நிலையை நேரலையில் பார்க்கலாம்.",
  },
  {
    id: "online-payments",
    status: "SOON",
    titleEn: "Online UPI payments",
    titleTa: "ஆன்லைன் UPI பணம் செலுத்தல்",
    descEn: "Direct guest UPI checkout settled straight to your business account.",
    descTa: "வாடிக்கையாளர்கள் நேரடியாக UPI மூலம் பணம் செலுத்தும் வசதி.",
  },
  {
    id: "inventory-tracking",
    status: "SOON",
    titleEn: "Kitchen stock and recipe tracking",
    titleTa: "சமையலறை இருப்பு மற்றும் செய்முறை கணக்கு",
    descEn: "Track raw ingredient usage and daily wastage automatically.",
    descTa: "மூலப்பொருள் பயன்பாடு மற்றும் தினசரி வீணாவதை கணக்கிடும் வசதி.",
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
