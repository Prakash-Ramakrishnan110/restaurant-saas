export type CustomerLang = "en" | "ta";

export const PUBLIC_QR_COPY: Record<
  CustomerLang,
  {
    langToggleLabel: string;
    searchPlaceholder: string;
    allCategories: string;
    veg: string;
    nonVeg: string;
    egg: string;
    bestseller: string;
    soldOut: string;
    add: string;
    customize: string;
    required: string;
    optional: string;
    chooseUpTo: (max: number) => string;
    chooseExactly: (count: number) => string;
    chooseBetween: (min: number, max: number) => string;
    sizeOrPortion: string;
    specialNote: string;
    notePlaceholder: string;
    estimate: string;
    navMenu: string;
    navSearch: string;
    navCart: string;
    addToCart: string;
    viewCart: string;
    itemsInCart: (count: number) => string;
    yourOrder: string;
    orderNote: string;
    orderNotePlaceholder: string;
    diningPreferenceLabel: string;
    eatHere: string;
    parcel: string;
    placeOrder: string;
    placingOrder: string;
    clearCart: string;
    close: string;
    browseOnlyNotice: string;
    disabledTitle: string;
    disabledBody: string;
    invalidTitle: string;
    invalidBody: string;
    staffRequiredTitle: string;
    staffRequiredBody: string;
    tooManyTitle: string;
    tooManyBody: string;
    offlineBanner: string;
    noResults: string;
    emptyMenu: string;
    poweredBy: string;
    retry: string;
    tableLabel: (label: string) => string;
    counterLabel: (label: string) => string;
    roomLabel: (label: string) => string;
    // Tracker page
    orderNumber: string;
    tokenNumber: string;
    backToMenu: string;
    refreshStatus: string;
    stepReceived: string;
    stepPreparing: string;
    stepReady: string;
    stepServed: string;
    waitingApprovalTitle: string;
    waitingApprovalBody: string;
    payFirstTitle: string;
    payFirstBody: string;
    rejectedTitle: string;
    cancelledTitle: string;
    completedTitle: string;
    completedBody: string;
    orderExpiredTitle: string;
    orderExpiredBody: string;
    totalLabel: string;
    itemsOrdered: string;
    billPendingNotice: string;
    officialReceiptTitle: string;
    demoReceiptNotice: string;
    demoReceiptNoticeTa: string;
    invoiceNumberLabel: string;
    paymentMethodLabel: string;
    readyAlertTitle: string;
    readyAlertCounterBody: string;
    readyAlertTableBody: string;
    pickupCodeLabel: string;
    fullscreenLabel: string;
    exitFullscreenLabel: string;
    soundOnLabel: string;
    soundMutedLabel: string;
    minSelectionError: (groupName: string, min: number) => string;
    genericOrderError: string;
    soldOutError: string;
  }
> = {
  en: {
    langToggleLabel: "தமிழ்",
    searchPlaceholder: "Search dishes...",
    allCategories: "All",
    veg: "Veg",
    nonVeg: "Non-Veg",
    egg: "Egg",
    bestseller: "Popular",
    soldOut: "Sold out",
    add: "Add",
    customize: "Customize",
    required: "Required",
    optional: "Optional",
    chooseUpTo: (max) => `Choose up to ${max}`,
    chooseExactly: (count) => `Choose ${count}`,
    chooseBetween: (min, max) => `Choose ${min} to ${max}`,
    sizeOrPortion: "Choose size",
    specialNote: "Cooking note (optional)",
    notePlaceholder: "e.g. Less spicy, no onion",
    estimate: "Estimate",
    navMenu: "Menu",
    navSearch: "Search",
    navCart: "My cart",
    addToCart: "Add to order",
    viewCart: "View order",
    itemsInCart: (count) => `${count} ${count === 1 ? "item" : "items"}`,
    yourOrder: "Your order",
    orderNote: "Note for kitchen (optional)",
    orderNotePlaceholder: "Any allergy or serving request",
    diningPreferenceLabel: "How would you like it?",
    eatHere: "Eat Here",
    parcel: "Parcel (Takeaway)",
    placeOrder: "Place order",
    placingOrder: "Sending order...",
    clearCart: "Clear",
    close: "Close",
    browseOnlyNotice: "Please ask our staff to order",
    disabledTitle: "Ordering is closed",
    disabledBody: "Phone ordering is turned off right now. Please ask our staff for help.",
    invalidTitle: "Menu unavailable",
    invalidBody: "This QR code is not active. Please ask our staff for a fresh code.",
    staffRequiredTitle: "Please ask staff to start",
    staffRequiredBody: "A staff member needs to open your table before you can place an order.",
    tooManyTitle: "Order limit reached",
    tooManyBody: "You have too many open orders right now. Please wait for your current order.",
    offlineBanner: "You are offline. Your order items are saved.",
    noResults: "No matching dishes found.",
    emptyMenu: "No dishes are available right now.",
    poweredBy: "Powered by ServeMyFood",
    retry: "Try again",
    tableLabel: (label) => `Table ${label}`,
    counterLabel: (label) => label || "Counter",
    roomLabel: (label) => `Room ${label}`,
    orderNumber: "Order",
    tokenNumber: "Token",
    backToMenu: "Back to menu",
    refreshStatus: "Refresh",
    stepReceived: "Received",
    stepPreparing: "Preparing",
    stepReady: "Ready",
    stepServed: "Served",
    waitingApprovalTitle: "Waiting for staff to confirm",
    waitingApprovalBody: "Our team has received your request and will confirm it shortly.",
    payFirstTitle: "Please pay at the counter to start your order",
    payFirstBody: "Show your token number at the cash counter.",
    rejectedTitle: "Order could not be accepted",
    cancelledTitle: "Order cancelled",
    completedTitle: "Order completed",
    completedBody: "Thank you for dining with us!",
    orderExpiredTitle: "Order details no longer available",
    orderExpiredBody: "This order has finished. Scan the table QR code to view the menu.",
    totalLabel: "Total",
    itemsOrdered: "Items in your order",
    billPendingNotice:
      "Your receipt and print/download options will appear once payment is completed.",
    officialReceiptTitle: "Paid Receipt",
    demoReceiptNotice: "DEMO RECEIPT - NOT A TAX INVOICE",
    demoReceiptNoticeTa: "மாதிரி ரசீது - வரி பில் அல்ல",
    invoiceNumberLabel: "Receipt #",
    paymentMethodLabel: "Paid via",
    readyAlertTitle: "Your order is ready!",
    readyAlertCounterBody: "Please collect your order at the counter.",
    readyAlertTableBody: "Our staff will bring your food to your table shortly.",
    pickupCodeLabel: "Pickup code",
    fullscreenLabel: "Full screen",
    exitFullscreenLabel: "Exit full screen",
    soundOnLabel: "Alert sound on",
    soundMutedLabel: "Alert sound muted",
    minSelectionError: (groupName, min) => `Please choose at least ${min} for ${groupName}.`,
    genericOrderError: "Could not send your order. Please try again.",
    soldOutError: "Some dishes just sold out. Please check your order and try again.",
  },
  ta: {
    langToggleLabel: "English",
    searchPlaceholder: "உணவுகளைத் தேடுங்கள்...",
    allCategories: "அனைத்தும்",
    veg: "சைவம்",
    nonVeg: "அசைவம்",
    egg: "முட்டை",
    bestseller: "பிரபலம்",
    soldOut: "தீர்ந்துவிட்டது",
    add: "சேர்க்க",
    customize: "தேர்வு செய்க",
    required: "கட்டாயம்",
    optional: "விருப்பம்",
    chooseUpTo: (max) => `அதிகபட்சம் ${max} தேர்வு செய்க`,
    chooseExactly: (count) => `${count} தேர்வு செய்க`,
    chooseBetween: (min, max) => `${min} முதல் ${max} வரை தேர்வு செய்க`,
    sizeOrPortion: "அளவைத் தேர்வு செய்க",
    specialNote: "சமையல் குறிப்பு (விருப்பம்)",
    notePlaceholder: "எ.கா. காரம் குறைவாக, வெங்காயம் வேண்டாம்",
    estimate: "மதிப்பீடு",
    navMenu: "மெனு",
    navSearch: "தேடல்",
    navCart: "என் கூடை",
    addToCart: "ஆர்டரில் சேர்க்க",
    viewCart: "ஆர்டரைப் பார்",
    itemsInCart: (count) => `${count} உணவுகள்`,
    yourOrder: "உங்கள் ஆர்டர்",
    orderNote: "சமையலறைக்கு குறிப்பு (விருப்பம்)",
    orderNotePlaceholder: "ஏதேனும் சிறப்பு விருப்பம்",
    diningPreferenceLabel: "எப்படிப் பரிமாற வேண்டும்?",
    eatHere: "இங்கே சாப்பிட",
    parcel: "பார்சல்",
    placeOrder: "ஆர்டர் செய்",
    placingOrder: "ஆர்டர் அனுப்பப்படுகிறது...",
    clearCart: "அழி",
    close: "மூடு",
    browseOnlyNotice: "ஆர்டர் செய்ய எங்கள் பணியாளர்களிடம் கேளுங்கள்",
    disabledTitle: "ஆர்டர் தற்போது நிறுத்தப்பட்டுள்ளது",
    disabledBody: "தொலைபேசி ஆர்டர் இப்போது இயக்கத்தில் இல்லை. பணியாளர்களிடம் கேளுங்கள்.",
    invalidTitle: "மெனு கிடைக்கவில்லை",
    invalidBody: "இந்த QR குறியீடு செயலில் இல்லை. பணியாளர்களிடம் புதிய குறியீட்டைக் கேளுங்கள்.",
    staffRequiredTitle: "பணியாளரைத் தொடர்பு கொள்ளவும்",
    staffRequiredBody: "ஆர்டர் செய்ய பணியாளர் உங்கள் மேசையைத் திறக்க வேண்டும்.",
    tooManyTitle: "ஆர்டர் வரம்பு முடிந்தது",
    tooManyBody:
      "தற்போது அதிக ஆர்டர்கள் திறந்த நிலையில் உள்ளன. சிறிது நேரம் கழித்து முயற்சிக்கவும்.",
    offlineBanner: "இணைய இணைப்பு இல்லை. உங்கள் தேர்வுகள் சேமிக்கப்பட்டுள்ளன.",
    noResults: "பொருத்தமான உணவுகள் இல்லை.",
    emptyMenu: "தற்போது உணவுகள் எதுவும் இல்லை.",
    poweredBy: "Powered by ServeMyFood",
    retry: "மீண்டும் முயற்சி",
    tableLabel: (label) => `மேசை ${label}`,
    counterLabel: (label) => label || "கவுண்டர்",
    roomLabel: (label) => `அறை ${label}`,
    orderNumber: "ஆர்டர்",
    tokenNumber: "டோக்கன்",
    backToMenu: "மெனுவுக்குத் திரும்பு",
    refreshStatus: "புதுப்பி",
    stepReceived: "பெறப்பட்டது",
    stepPreparing: "தயாராகிறது",
    stepReady: "தயார்",
    stepServed: "பரிமாறப்பட்டது",
    waitingApprovalTitle: "பணியாளர் உறுதிப்படுத்தக் காத்திருக்கிறது",
    waitingApprovalBody: "உங்கள் ஆர்டர் பெறப்பட்டது. விரைவில் உறுதிப்படுத்தப்படும்.",
    payFirstTitle: "உங்கள் ஆர்டரைத் தொடங்க கவுண்டரில் பணம் செலுத்தவும்",
    payFirstBody: "பணம் செலுத்தும் கவுண்டரில் உங்கள் டோக்கன் எண்ணைக் காட்டுங்கள்.",
    rejectedTitle: "ஆர்டரை ஏற்க முடியவில்லை",
    cancelledTitle: "ஆர்டர் ரத்து செய்யப்பட்டது",
    completedTitle: "ஆர்டர் முடிந்தது",
    completedBody: "எங்களுடன் உணவருந்தியதற்கு நன்றி!",
    orderExpiredTitle: "ஆர்டர் விவரங்கள் கிடைக்கவில்லை",
    orderExpiredBody:
      "இந்த ஆர்டர் முடிந்துவிட்டது. மெனுவைப் பார்க்க QR குறியீட்டை ஸ்கேன் செய்யவும்.",
    totalLabel: "மொத்தம்",
    itemsOrdered: "உங்கள் ஆர்டர் உணவுகள்",
    billPendingNotice:
      "பணம் செலுத்திய பிறகு உங்கள் ரசீது மற்றும் அச்சு / பதிவிறக்க வசதி இங்கே தோன்றும்.",
    officialReceiptTitle: "பணம் செலுத்திய ரசீது",
    demoReceiptNotice: "DEMO RECEIPT - NOT A TAX INVOICE",
    demoReceiptNoticeTa: "மாதிரி ரசீது - வரி பில் அல்ல",
    invoiceNumberLabel: "ரசீது எண்",
    paymentMethodLabel: "செலுத்திய முறை",
    readyAlertTitle: "உங்கள் ஆர்டர் தயார்!",
    readyAlertCounterBody: "தயவுசெய்து கவுண்டரில் உங்கள் ஆர்டரைப் பெற்றுக்கொள்ளவும்.",
    readyAlertTableBody: "எங்கள் பணியாளர் விரைவில் உங்கள் மேசைக்கு உணவைக் கொண்டு வருவார்.",
    pickupCodeLabel: "பிக்அப் குறியீடு",
    fullscreenLabel: "முழு திரை",
    exitFullscreenLabel: "முழு திரையிலிருந்து வெளியேறு",
    soundOnLabel: "அலார ஒலி இயக்கத்தில்",
    soundMutedLabel: "அலார ஒலி நிறுத்தப்பட்டது",
    minSelectionError: (groupName, min) => `${groupName}: குறைந்தது ${min} தேர்வு செய்யவும்.`,
    genericOrderError: "ஆர்டரை அனுப்ப முடியவில்லை. மீண்டும் முயற்சிக்கவும்.",
    soldOutError:
      "சில உணவுகள் தீர்ந்துவிட்டன. உங்கள் ஆர்டரைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.",
  },
};

export function pickLocalized(enText: string, taText: string, lang: CustomerLang): string {
  if (lang === "ta" && taText && taText.trim()) return taText;
  return enText;
}

export function getCustomerInitialLang(): CustomerLang {
  if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("ta")) {
    return "ta";
  }
  return "en";
}
