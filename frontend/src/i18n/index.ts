import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

export const defaultResources = {
  en: {
    translation: {
      brand: {
        name: "ServeMyFood",
        tagline: "One Platform. Every Food Business.",
        company: "Fusion Engine Technology",
        taglineShort: "Hospitality Management Platform",
      },
      auth: {
        signIn: "Sign In",
        signInDescription: "Access your restaurant management console",
        email: "Email address",
        password: "Password",
        forgotPassword: "Forgot password?",
        signingIn: "Signing in...",
        mustChangePassword: "Password Change Required",
        mustChangePasswordDesc:
          "You must change your temporary password to continue securing your account.",
        currentPassword: "Current / Temporary Password",
        newPassword: "New Password",
        confirmPassword: "Confirm New Password",
        changePasswordButton: "Update Password & Continue",
        passwordMismatch: "New passwords do not match.",
        passwordTooShort: "Password must be at least 8 characters.",
        signOut: "Sign Out",
      },
      nav: {
        dashboard: "Dashboard",
        floorPlan: "Floor Plan",
        tables: "Tables",
        sessions: "Active Sessions",
        menu: "Menu & Categories",
        orders: "Kitchen & Orders",
        staff: "Staff Management",
        settings: "Settings",
        devBrand: "Brand Tokens",
        devComponents: "Design System",
      },
      status: {
        AVAILABLE: "Available",
        OCCUPIED: "Occupied",
        RESERVED: "Reserved",
        CLEANING: "Cleaning",
        BLOCKED: "Blocked",
      },
      common: {
        branch: "Branch",
        allBranches: "All Branches",
        save: "Save",
        cancel: "Cancel",
        loading: "Loading...",
        touchMode: "Touch Mode",
        darkMode: "Dark Mode",
        lightMode: "Light Mode",
        language: "Language",
      },
    },
  },
  ta: {
    translation: {
      brand: {
        name: "ServeMyFood",
        tagline: "ஒரே தளம். அனைத்து உணவு வணிகங்களுக்கும்.",
        company: "ஃப்யூஷன் என்ஜின் டெக்னாலஜி",
        taglineShort: "உணவக மேலாண்மை தளம்",
      },
      auth: {
        signIn: "உள்நுழைக",
        signInDescription: "உங்கள் உணவக மேலாண்மை கணக்கில் நுழையுங்கள்",
        email: "மின்னஞ்சல் முகவரி",
        password: "கடவுச்சொல்",
        forgotPassword: "கடவுச்சொல் மறந்துவிட்டதா?",
        signingIn: "உள்நுழைகிறது...",
        mustChangePassword: "கடவுச்சொல் மாற்றம் அவசியம்",
        mustChangePasswordDesc:
          "உங்கள் தற்காலிக கடவுச்சொல்லை மாற்றி புதிய கடவுச்சொல்லை அமைக்கவும்.",
        currentPassword: "தற்போதைய / தற்காலிக கடவுச்சொல்",
        newPassword: "புதிய கடவுச்சொல்",
        confirmPassword: "புதிய கடவுச்சொல்லை உறுதிசெய்க",
        changePasswordButton: "கடவுச்சொல்லை மாற்றி தொடர்க",
        passwordMismatch: "புதிய கடவுச்சொற்கள் பொருந்தவில்லை.",
        passwordTooShort: "கடவுச்சொல் குறைந்தது 8 எழுத்துக்கள் இருக்க வேண்டும்.",
        signOut: "வெளியேறு",
      },
      nav: {
        dashboard: "டாஷ்போர்டு",
        floorPlan: "தள வரைபடம்",
        tables: "மேஜைகள்",
        sessions: "செயலில் உள்ள அமர்வுகள்",
        menu: "மெனு மற்றும் பிரிவுகள்",
        orders: "சமையலறை மற்றும் ஆர்டர்கள்",
        staff: "பணியாளர் மேலாண்மை",
        settings: "அமைப்புகள்",
        devBrand: "பிராண்ட் வண்ணங்கள்",
        devComponents: "வடிவமைப்பு கூறுகள்",
      },
      status: {
        AVAILABLE: "கிடைக்கக்கூடியது",
        OCCUPIED: "நிரம்பியது",
        RESERVED: "முன்பதிவு",
        CLEANING: "சுத்தம் செய்யப்படுகிறது",
        BLOCKED: "தடுக்கப்பட்டது",
      },
      common: {
        branch: "கிளை",
        allBranches: "அனைத்து கிளைகள்",
        save: "சேமிக்க",
        cancel: "ரத்து செய்",
        loading: "ஏற்றுகிறது...",
        touchMode: "தொடு திரை முறை",
        darkMode: "இரவு பயன்முறை",
        lightMode: "பகல் பயன்முறை",
        language: "மொழி",
      },
    },
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: defaultResources,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

export default i18n;
