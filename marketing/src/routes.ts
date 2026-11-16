export type Lang = "en" | "ta";

export type PageId =
  | "home"
  | "tea-shops"
  | "restaurants"
  | "hotels"
  | "book-demo"
  | "privacy"
  | "terms"
  | "404";

export interface RouteMeta {
  page: PageId;
  enPath: string;
  taPath: string;
  titleEn: string;
  titleTa: string;
  descEn: string;
  descTa: string;
}

export const ROUTES: RouteMeta[] = [
  {
    page: "home",
    enPath: "/",
    taPath: "/ta/",
    titleEn: "ServeMyFood — Take orders. Run the kitchen. Get paid. See today's sales.",
    titleTa: "ServeMyFood — ஆர்டர் எடுங்கள். சமையலறையை இயக்குங்கள். பணம் பெறுங்கள்.",
    descEn:
      "One simple system for tea shops, cafes, restaurants and hotels. Works on a phone, tablet or computer. In Tamil and English.",
    descTa:
      "தேநீர்க் கடை, கஃபே, உணவகம், ஹோட்டல் அனைத்திற்கும் ஒரே எளிய அமைப்பு. தமிழ் மற்றும் ஆங்கிலத்தில்.",
  },
  {
    page: "tea-shops",
    enPath: "/tea-shops/",
    taPath: "/ta/tea-shops/",
    titleEn: "ServeMyFood for Tea Shops & Bakeries — Fast Counter & Token Billing",
    titleTa: "தேநீர்க் கடை மற்றும் பேக்கரிகளுக்கான ServeMyFood — டோக்கன் மற்றும் கவுண்டர் பில்லிங்",
    descEn:
      "Take counter orders quickly, issue token numbers, send items to the kitchen, and check daily cash and UPI totals.",
    descTa:
      "கவுண்டரில் விரைவாக ஆர்டர் எடுத்து, டோக்கன் எண் வழங்கி, தினசரி விற்பனையை உடனே பாருங்கள்.",
  },
  {
    page: "restaurants",
    enPath: "/restaurants/",
    taPath: "/ta/restaurants/",
    titleEn: "ServeMyFood for Restaurants & Cafes — Table Orders, Kitchen Screen & Billing",
    titleTa: "உணவகம் மற்றும் கஃபேக்களுக்கான ServeMyFood — ஆர்டர், சமையலறை மற்றும் பில்லிங்",
    descEn:
      "Waiters take orders on a phone, the kitchen sees tickets with a sound alert, and cashiers settle bills cleanly.",
    descTa:
      "பணியாளர் போனில் ஆர்டர் எடுப்பார், சமையலறைக்கு ஒலி அறிவிப்புடன் செல்லும், கேஷியர் எளிதாக பில் போடுவார்.",
  },
  {
    page: "hotels",
    enPath: "/hotels/",
    taPath: "/ta/hotels/",
    titleEn: "ServeMyFood for Hotel Restaurants — Multi-Outlet Dining & Kitchen Control",
    titleTa: "ஹோட்டல் உணவகங்களுக்கான ServeMyFood — கிளை மற்றும் சமையலறை மேலாண்மை",
    descEn:
      "Run your hotel dining room, cafe and kitchen screen in one place. Room service and room charges are coming soon.",
    descTa:
      "உங்கள் ஹோட்டல் உணவகம் மற்றும் சமையலறையை ஒரே இடத்தில் இயக்குங்கள். அறை சேவை விரைவில்.",
  },
  {
    page: "book-demo",
    enPath: "/book-demo/",
    taPath: "/ta/book-demo/",
    titleEn: "Book a Free Demo — ServeMyFood",
    titleTa: "இலவச டெமோ பதிவு செய்யுங்கள் — ServeMyFood",
    descEn:
      "Request a free live walkthrough for your tea shop, bakery, cafe, restaurant or hotel.",
    descTa:
      "உங்கள் தேநீர்க் கடை, பேக்கரி, கஃபே, உணவகம் அல்லது ஹோட்டலுக்கான இலவச டெமோவை பதிவு செய்யுங்கள்.",
  },
  {
    page: "privacy",
    enPath: "/privacy/",
    taPath: "/ta/privacy/",
    titleEn: "Privacy Policy — ServeMyFood",
    titleTa: "தனியுரிமைக் கொள்கை — ServeMyFood",
    descEn: "How Fusion Engine Technology collects and handles demo request details.",
    descTa: "டெமோ கோரிக்கை விவரங்களை Fusion Engine Technology எவ்வாறு கையாள்கிறது.",
  },
  {
    page: "terms",
    enPath: "/terms/",
    taPath: "/ta/terms/",
    titleEn: "Terms of Use — ServeMyFood",
    titleTa: "பயன்பாட்டு விதிமுறைகள் — ServeMyFood",
    descEn: "Plain-language terms for using the ServeMyFood website and booking a demo.",
    descTa: "ServeMyFood இணையதளத்தை பயன்படுத்துவதற்கான எளிய விதிமுறைகள்.",
  },
];

export function parseRoute(pathname: string): { lang: Lang; page: PageId } {
  const clean = pathname.endsWith("/") ? pathname : `${pathname}/`;
  const isTa = clean === "/ta/" || clean.startsWith("/ta/");
  const lang: Lang = isTa ? "ta" : "en";
  const matched = ROUTES.find((r) => (isTa ? r.taPath === clean : r.enPath === clean));
  return { lang, page: matched ? matched.page : "404" };
}

export function getPagePath(page: PageId, lang: Lang): string {
  const route = ROUTES.find((r) => r.page === page);
  if (!route) return lang === "ta" ? "/ta/" : "/";
  return lang === "ta" ? route.taPath : route.enPath;
}

export function getRouteMeta(page: PageId): RouteMeta {
  return ROUTES.find((r) => r.page === page) || ROUTES[0];
}
