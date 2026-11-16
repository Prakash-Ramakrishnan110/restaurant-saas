import type { Lang, PageId } from "./routes";

export const HOME_COPY = {
  en: {
    h1: "Take orders. Run the kitchen. Get paid. See today's sales.",
    sub: "One simple system for tea shops, cafes, restaurants and hotels. Works on a phone, tablet or computer. In Tamil and English.",
    ctaPrimary: "Book a free demo",
    ctaSecondary: "Watch the 60-second demo",
    stepsTitle: "How it works",
    stepsSub: "Five clear steps from order to daily sales.",
    steps: [
      "Waiter takes the order on a phone.",
      "Kitchen sees it at once, with a sound alert.",
      "Waiter serves when it is ready.",
      "Cashier takes payment and gives the receipt.",
      "Owner sees today's sales.",
    ],
    counterStory: "Customer pays, gets a token, and collects when it is called.",
    venuesTitle: "Built for your business",
    venuesSub: "Pick your shop or dining format to see how it fits your daily work.",
    problemsTitle: "Problems we solve",
    problemsSub: "Built around everyday pain points in food businesses.",
    problems: [
      {
        title: "Wrong orders and lost paper slips",
        desc: "Every item, portion and spice note goes straight from the waiter's phone to the kitchen screen.",
      },
      {
        title: "Dishes that are finished",
        desc: "Turn off sold-out dishes in one tap so staff never take an order you cannot serve.",
      },
      {
        title: "Not knowing what happened today",
        desc: "See today's total sales, top dishes, cash, UPI and card totals from anywhere.",
      },
      {
        title: "New staff who need training",
        desc: "Clear buttons in Tamil and English help new staff take their first order in minutes.",
      },
      {
        title: "Staff who should see only their own work",
        desc: "Waiters see orders, cooks see the kitchen screen, cashiers see billing, and owners see reports.",
      },
    ],
    featuresLiveTitle: "What works today",
    featuresLiveSub: "Ready to use right now in the app.",
    featuresSoonTitle: "Coming soon",
    featuresSoonSub: "In active development and clearly marked as not live yet.",
    comingSoonBadge: "Coming soon",
    trustTitle: "Built to keep your business data safe",
    trustSub: "Honest protections verified by automated tests in the app.",
    trustPoints: [
      "Each business's data is kept strictly separate from every other business.",
      "Staff see only the screens and actions allowed for their role.",
      "Sign-in is protected and inactive accounts are blocked immediately.",
      "Important changes to menus, orders and roles are recorded.",
    ],
    videoTitle: "See the real app in 60 seconds",
    videoSub: "Recorded directly from the working software. Silent video with English and Tamil captions.",
    videoPlay: "Play demo video",
    videoTranscriptToggle: "Show transcript",
    faqTitle: "Common questions",
    faq: [
      {
        q: "What devices do I need?",
        a: "Any Android phone, tablet, laptop or desktop with a modern web browser works.",
      },
      {
        q: "Does it need internet?",
        a: "Yes. ServeMyFood runs over your shop Wi-Fi or mobile data.",
      },
      {
        q: "What about receipt printers?",
        a: "It supports 80mm thermal receipt layouts with clear item totals. Note: receipts in the demo environment are marked as DEMO RECEIPT.",
      },
      {
        q: "Can my staff use it in Tamil?",
        a: "Yes. Every screen switches between Tamil and English in one tap, and menu items support Tamil names.",
      },
      {
        q: "How long does it take to start?",
        a: "We help you set up your menu, staff logins and dining layout in a short onboarding call.",
      },
      {
        q: "Is my data kept separate from other businesses?",
        a: "Yes. Every account's orders, menus and reports are isolated per business and protected by role permissions.",
      },
      {
        q: "What is not ready yet?",
        a: "Official compliance invoices are not ready yet (demo receipts are labelled DEMO RECEIPT). Customer self-ordering, online UPI checkout, stock tracking, staff attendance and hotel room charges are marked Coming soon.",
      },
    ],
    demoBandTitle: "Ready to see ServeMyFood with your own menu?",
    demoBandSub: "Book a short live demo in Tamil or English.",
  },
  ta: {
    h1: "ஆர்டர் எடுங்கள். சமையலறையை இயக்குங்கள். பணம் பெறுங்கள். இன்றைய விற்பனையைப் பாருங்கள்.",
    sub: "தேநீர்க் கடை, கஃபே, உணவகம், ஹோட்டல் அனைத்திற்கும் ஒரே எளிய அமைப்பு. போன், டேப்லெட் அல்லது கணினியில் இயங்கும். தமிழ் மற்றும் ஆங்கிலத்தில்.",
    ctaPrimary: "இலவச டெமோ பதிவு செய்யுங்கள்",
    ctaSecondary: "60 வினாடி டெமோவைப் பாருங்கள்",
    stepsTitle: "இது எப்படி வேலை செய்கிறது",
    stepsSub: "ஆர்டர் முதல் தினசரி விற்பனை வரை ஐந்து எளிய படிகள்.",
    steps: [
      "பணியாளர் போனில் ஆர்டர் எடுக்கிறார்.",
      "சமையலறைக்கு உடனே தெரியும், ஒலி அறிவிப்புடன்.",
      "தயாரானதும் பணியாளர் பரிமாறுகிறார்.",
      "கேஷியர் பணம் பெற்று ரசீது தருகிறார்.",
      "உரிமையாளர் இன்றைய விற்பனையைப் பார்க்கிறார்.",
    ],
    counterStory: "வாடிக்கையாளர் பணம் செலுத்தி டோக்கன் பெற்று, அழைக்கும்போது பெற்றுக்கொள்கிறார்.",
    venuesTitle: "உங்கள் வணிகத்திற்கு ஏற்ப உருவாக்கப்பட்டது",
    venuesSub: "உங்கள் கடை அல்லது உணவக வகையைத் தேர்ந்தெடுத்து பார்க்கவும்.",
    problemsTitle: "நாங்கள் தீர்க்கும் பிரச்சனைகள்",
    problemsSub: "உணவு வணிகங்களில் தினமும் ஏற்படும் சிரமங்களுக்கான தீர்வு.",
    problems: [
      {
        title: "தவறான ஆர்டர்கள் மற்றும் காகிதச் சீட்டு இழப்பு",
        desc: "ஒவ்வொரு உணவுப் பொருளும் குறிப்பும் பணியாளர் போனிலிருந்து நேரடியாக சமையலறை திரைக்கு செல்லும்.",
      },
      {
        title: "தீர்ந்து போன உணவுகள்",
        desc: "ஒரு உணவு முடிந்தால் ஒரு தட்டில் நிறுத்தலாம்; தவறான ஆர்டர் எடுக்கப்படாது.",
      },
      {
        title: "இன்றைய விற்பனை தெரியாமல் இருப்பது",
        desc: "இன்றைய மொத்த விற்பனை, அதிகம் விற்ற உணவுகள் மற்றும் ரொக்கம்/UPI விவரங்களை எங்கிருந்தும் பார்க்கலாம்.",
      },
      {
        title: "புதிய பணியாளர்களுக்கு பயிற்சி தேவை",
        desc: "தமிழ் மற்றும் ஆங்கிலத்தில் தெளிவான பொத்தான்கள் இருப்பதால் புதிய பணியாளர்களும் உடனே கற்றுக்கொள்வார்கள்.",
      },
      {
        title: "பணியாளர்கள் தங்களுக்குரிய வேலையை மட்டும் பார்க்க",
        desc: "பணியாளர் ஆர்டர், சமையல்காரர் சமையலறை, கேஷியர் பில்லிங், உரிமையாளர் விற்பனை அறிக்கை மட்டுமே பார்ப்பார்கள்.",
      },
    ],
    featuresLiveTitle: "இன்று நேரடியாக இயங்கும் வசதிகள்",
    featuresLiveSub: "செயலியில் இப்போதே பயன்படுத்தத் தயாராக உள்ளவை.",
    featuresSoonTitle: "விரைவில்",
    featuresSoonSub: "தற்போது உருவாக்கத்தில் உள்ள வசதிகள்.",
    comingSoonBadge: "விரைவில்",
    trustTitle: "உங்கள் வணிகத் தரவைப் பாதுகாக்க",
    trustSub: "தானியங்கி சோதனைகளால் உறுதிப்படுத்தப்பட்ட பாதுகாப்புகள்.",
    trustPoints: [
      "ஒவ்வொரு வணிகத்தின் தரவும் மற்ற வணிகங்களிலிருந்து தனித்தனியாகப் பிரிக்கப்பட்டுள்ளது.",
      "பணியாளர்கள் தங்கள் பொறுப்புக்குரிய திரைகளை மட்டுமே பார்ப்பார்கள்.",
      "உள்நுழைவு பாதுகாக்கப்பட்டது; நிறுத்தப்பட்ட கணக்குகள் உடனே தடுக்கப்படும்.",
      "மெனு, ஆர்டர் மற்றும் பொறுப்பு மாற்றங்கள் பதிவு செய்யப்படுகின்றன.",
    ],
    videoTitle: "60 வினாடிகளில் நேரடி செயலியைப் பாருங்கள்",
    videoSub: "உண்மையான செயலியில் பதிவு செய்யப்பட்டது. தமிழ் மற்றும் ஆங்கில வசனங்களுடன்.",
    videoPlay: "டெமோ வீடியோவை இயக்கு",
    videoTranscriptToggle: "எழுத்துப்பதிவைக் காட்டு",
    faqTitle: "பொதுவான கேள்விகள்",
    faq: [
      {
        q: "எந்த சாதனங்கள் தேவை?",
        a: "இணைய உலாவி உள்ள எந்த Android போன், டேப்லெட், லேப்டாப் அல்லது கணினியிலும் இயங்கும்.",
      },
      {
        q: "இணைய இணைப்பு தேவையா?",
        a: "ஆம். உங்கள் கடை Wi-Fi அல்லது மொபைல் டேட்டா மூலம் இயங்கும்.",
      },
      {
        q: "ரசீது பிரிண்டர் பயன்படுத்தலாமா?",
        a: "ஆம், 80mm தெர்மல் ரசீது வடிவத்தை ஆதரிக்கிறது. டெமோ ரசீதுகளில் DEMO RECEIPT எனக் குறிப்பிடப்பட்டிருக்கும்.",
      },
      {
        q: "பணியாளர்கள் தமிழில் பயன்படுத்தலாமா?",
        a: "ஆம். ஒவ்வொரு திரையையும் ஒரு தட்டில் தமிழ் மற்றும் ஆங்கிலத்திற்கு மாற்றலாம்.",
      },
      {
        q: "தொடங்க எவ்வளவு நேரம் ஆகும்?",
        a: "உங்கள் மெனு மற்றும் பணியாளர் கணக்குகளை ஒரு சிறிய அழைப்பில் விரைவாக அமைத்துத் தருவோம்.",
      },
      {
        q: "என் கடைத் தரவு பாதுகாப்பாக இருக்குமா?",
        a: "ஆம். ஒவ்வொரு வணிகத்தின் ஆர்டர்கள் மற்றும் அறிக்கைகளும் தனித்தனியாகப் பிரிக்கப்பட்டுள்ளன.",
      },
      {
        q: "இன்னும் தயாராகாத வசதிகள் எவை?",
        a: "வரி ரசீதுகள் இன்னும் தயாராகவில்லை. வாடிக்கையாளர் QR ஆர்டர், ஆன்லைன் UPI, இருப்பு கணக்கு, பணியாளர் வருகை மற்றும் ஹோட்டல் அறை கணக்கு ஆகியவை விரைவில் வரும்.",
      },
    ],
    demoBandTitle: "உங்கள் மெனுவுடன் ServeMyFood-ஐ பார்க்க தயாரா?",
    demoBandSub: "தமிழ் அல்லது ஆங்கிலத்தில் இலவச டெமோ பதிவு செய்யுங்கள்.",
  },
} as const;

export interface VenueCardInfo {
  id: string;
  targetPage: PageId;
  nameEn: string;
  nameTa: string;
  oneLinerEn: string;
  oneLinerTa: string;
}

export const VENUE_CARDS: VenueCardInfo[] = [
  {
    id: "tea-shop",
    targetPage: "tea-shops",
    nameEn: "Tea shop",
    nameTa: "தேநீர்க் கடை",
    oneLinerEn: "Fast counter billing with token numbers and instant cash or UPI totals.",
    oneLinerTa: "டோக்கன் எண்கள் மற்றும் உடனடி கவுண்டர் பில்லிங்.",
  },
  {
    id: "bakery",
    targetPage: "tea-shops",
    nameEn: "Bakery",
    nameTa: "பேக்கரி",
    oneLinerEn: "Quick parcel and counter orders with one-tap sold-out control.",
    oneLinerTa: "விரைவான பார்சல் ஆர்டர்கள் மற்றும் ஒரு தட்டில் இருப்பு நிலை.",
  },
  {
    id: "cafe",
    targetPage: "restaurants",
    nameEn: "Cafe",
    nameTa: "கஃபே",
    oneLinerEn: "Seat orders, kitchen chime alerts and clear drink or snack modifiers.",
    oneLinerTa: "ஆர்டர் குறிப்புகள் மற்றும் சமையலறை ஒலி அறிவிப்புகள்.",
  },
  {
    id: "restaurant",
    targetPage: "restaurants",
    nameEn: "Restaurant",
    nameTa: "உணவகம்",
    oneLinerEn: "Phone ordering for waiters, live kitchen display and fast bill settlement.",
    oneLinerTa: "பணியாளர் போன் ஆர்டர், சமையலறை திரை மற்றும் விரைவான பில்லிங்.",
  },
  {
    id: "fine-dining",
    targetPage: "restaurants",
    nameEn: "Fine dining",
    nameTa: "சிறப்பு உணவகம்",
    oneLinerEn: "Course-by-course kitchen tickets, floor sections and role access.",
    oneLinerTa: "பிரிவு வாரியான சேவை மற்றும் தனித்தனி பணியாளர் அணுகல்.",
  },
  {
    id: "hotel",
    targetPage: "hotels",
    nameEn: "Hotel restaurant",
    nameTa: "ஹோட்டல் உணவகம்",
    oneLinerEn: "Multi-outlet dining and kitchen control; room charges coming soon.",
    oneLinerTa: "பல பிரிவு உணவக மேலாண்மை; அறை கணக்கு விரைவில்.",
  },
  {
    id: "food-court",
    targetPage: "tea-shops",
    nameEn: "Food court",
    nameTa: "உணவு வளாகம்",
    oneLinerEn: "Counter token queues across stalls with clear pickup ready alerts.",
    oneLinerTa: "ஸ்டால்களுக்கான டோக்கன் வரிசை மற்றும் தயார் நிலை அறிவிப்பு.",
  },
];

export const VENUE_PAGE_COPY: Record<
  "tea-shops" | "restaurants" | "hotels",
  Record<
    Lang,
    {
      h1: string;
      sub: string;
      storyType: "counter" | "restaurant" | "hotel";
      highlights: string[];
      noteSoon?: string;
    }
  >
> = {
  "tea-shops": {
    en: {
      h1: "Fast counter billing and token queues for tea shops and bakeries.",
      sub: "Customer pays, gets a token, and collects when it is called. Simple buttons in Tamil and English.",
      storyType: "counter",
      highlights: [
        "Issue token numbers automatically on every counter order.",
        "Tap popular items like tea, coffee, vadai and puffs in seconds.",
        "Mark finished snacks sold out in one tap so staff never promise them.",
        "See today's total cash and UPI collection at closing time.",
      ],
    },
    ta: {
      h1: "தேநீர்க் கடை மற்றும் பேக்கரிகளுக்கான விரைவான கவுண்டர் பில்லிங் மற்றும் டோக்கன்.",
      sub: "வாடிக்கையாளர் பணம் செலுத்தி டோக்கன் பெற்று, அழைக்கும்போது பெற்றுக்கொள்கிறார்.",
      storyType: "counter",
      highlights: [
        "ஒவ்வொரு கவுண்டர் ஆர்டருக்கும் தானாக டோக்கன் எண் வழங்கப்படும்.",
        "தேநீர், காபி, வடை, பப்ஸ் போன்றவற்றை நொடிகளில் பதிவு செய்யலாம்.",
        "தீர்ந்து போன உணவுகளை ஒரு தட்டில் நிறுத்தலாம்.",
        "கடை மூடும் நேரத்தில் இன்றைய ரொக்கம் மற்றும் UPI விற்பனையை உடனே பார்க்கலாம்.",
      ],
    },
  },
  restaurants: {
    en: {
      h1: "Waiter ordering, live kitchen screen and fast billing for restaurants and cafes.",
      sub: "Replace paper order slips with clear phone-to-kitchen tickets and real-time order status.",
      storyType: "restaurant",
      highlights: [
        "Waiters pick a table on their phone and send orders with spice or extra notes.",
        "Kitchen sees new tickets immediately with a sound alert and cooking timers.",
        "Waiters get notified when food is ready to serve.",
        "Cashiers settle bills by cash, UPI or card and print 80mm receipts.",
      ],
    },
    ta: {
      h1: "உணவகம் மற்றும் கஃபேக்களுக்கான பணியாளர் ஆர்டர், சமையலறை திரை மற்றும் பில்லிங்.",
      sub: "காகிதச் சீட்டுகளுக்கு பதிலாக போனிலிருந்து சமையலறை திரைக்கு உடனடி ஆர்டர்கள்.",
      storyType: "restaurant",
      highlights: [
        "பணியாளர்கள் போனில் மேஜையைத் தேர்ந்தெடுத்து குறிப்புகளுடன் ஆர்டர் அனுப்பலாம்.",
        "சமையலறை திரையில் ஒலி அறிவிப்புடன் உடனே ஆர்டர் தோன்றும்.",
        "உணவு தயாரானதும் பணியாளருக்கு உடனே தெரியும்.",
        "கேஷியர் ரொக்கம், UPI அல்லது கார்டு மூலம் பில் முடித்து ரசீது தருவார்.",
      ],
    },
  },
  hotels: {
    en: {
      h1: "Multi-outlet dining and kitchen control for hotel restaurants.",
      sub: "Manage your main dining hall, cafe and kitchen screens from one place in Tamil and English.",
      storyType: "hotel",
      highlights: [
        "Run separate sections and kitchen screens for dining hall, cafe or patio.",
        "Compare daily sales across outlets from the owner dashboard.",
        "Give each waiter, cook and cashier separate role-based logins.",
      ],
      noteSoon: "Coming soon: Guest room service ordering and direct room folio charges.",
    },
    ta: {
      h1: "ஹோட்டல் உணவகங்களுக்கான பல பிரிவு மற்றும் சமையலறை மேலாண்மை.",
      sub: "முதன்மை உணவகம், கஃபே மற்றும் சமையலறை திரைகளை ஒரே இடத்தில் இயக்குங்கள்.",
      storyType: "hotel",
      highlights: [
        "உணவகம், கஃபே மற்றும் திறந்தவெளி பிரிவுகளைத் தனித்தனியாக இயக்கலாம்.",
        "உரிமையாளர் திரையில் அனைத்து பிரிவுகளின் தினசரி விற்பனையையும் ஒப்பிடலாம்.",
        "பணியாளர், சமையல்காரர் மற்றும் கேஷியருக்கு தனித்தனி உள்நுழைவுகள்.",
      ],
      noteSoon: "விரைவில்: விருந்தினர் அறை சேவை ஆர்டர் மற்றும் அறை கணக்கில் பில் சேர்ப்பு.",
    },
  },
};
