export interface SiteConfig {
  companyName: string;
  productName: string;
  siteUrl: string;
  appUrl: string;
  apiBaseUrl: string;
  whatsappNumber: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
}

export const SITE_CONFIG: SiteConfig = {
  companyName: "Fusion Engine Technology",
  productName: "ServeMyFood",
  siteUrl: "TODO: https://servemyfood.in",
  appUrl: "http://localhost:5173/login",
  apiBaseUrl: "http://localhost:8000",
  whatsappNumber: "TODO: 919000000000",
  contactPhone: "TODO: +91 90000 00000",
  contactEmail: "TODO: hello@fusionengine.in",
  address: "TODO: Chennai, Tamil Nadu, India",
};

export function hasTodoValue(val: string): boolean {
  return !val || val.trim().toUpperCase().startsWith("TODO");
}

export function getWhatsAppHref(message: string): string {
  const digits = SITE_CONFIG.whatsappNumber.replace(/\D/g, "") || "919000000000";
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
