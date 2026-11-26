import React from "react";
import { SITE_CONFIG } from "../../content/site";
import type { Lang } from "../routes";

interface LegalPageProps {
  kind: "privacy" | "terms";
  lang: Lang;
}

const EFFECTIVE_DATE = "November 19, 2026";

export const LegalPage: React.FC<LegalPageProps> = ({ kind, lang }) => {
  const isTa = lang === "ta";
  if (kind === "privacy") {
    return (
      <section className="py-12 lg:py-20 mx-auto max-w-[820px] px-5 sm:px-8 text-[#0B1F3B]">
        <article className="space-y-8 text-[16px] leading-[1.7] text-[#0B1F3B]/85">
          {isTa && (
            <div className="rounded-[14px] border border-[#E6E1D8] bg-[#FFF3E0]/70 p-4 text-[14px] text-[#0B1F3B]">
              <strong>தமிழ் சுருக்கம்:</strong> டெமோ கோரிக்கைக்காக நீங்கள் வழங்கும் பெயர், தொலைபேசி
              எண் மற்றும் கடை விவரங்கள் டெமோ தொடர்புக்கு மட்டுமே பயன்படுத்தப்படும்; மூன்றாம் நபருக்கு
              விற்கப்படாது. விரிவான விதிமுறைகள் கீழே கொடுக்கப்பட்டுள்ளன.
            </div>
          )}
          <header className="space-y-3 border-b border-[#E6E1D8] pb-6">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-[#0B1F3B]/70">
              Effective Date: {EFFECTIVE_DATE}
            </p>
            <h1 className="font-display font-semibold text-[32px] lg:text-[42px] leading-[1.15] text-[#0B1F3B]">
              Privacy Policy
            </h1>
            <p className="text-[16px] text-[#0B1F3B]/80">
              This Privacy Policy explains how <strong>{SITE_CONFIG.companyName}</strong>{" "}
              (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) collects, uses, stores,
              and protects personal data when you visit the {SITE_CONFIG.productName} website,
              submit a demo request, or use the {SITE_CONFIG.productName} web application. This
              policy is drafted in alignment with India&apos;s Digital Personal Data Protection
              Act, 2023 (DPDPA) and the Information Technology Act, 2000.
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="font-display font-semibold text-[22px] text-[#0B1F3B]">
              1. Information We Collect
            </h2>
            <p>We collect only the minimum information required to operate our website and service:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Demo Request Information:</strong> When you submit the &ldquo;Book a free
                demo&rdquo; form, we collect your name, 10-digit Indian mobile number, business type
                (such as tea shop, bakery, cafe, restaurant, or hotel), city, and any optional
                message you choose to include.
              </li>
              <li>
                <strong>Staff &amp; Account Information:</strong> When a business onboards onto{" "}
                {SITE_CONFIG.productName}, we store business profile details (business name, branch
                name, address, logo) and staff login details (name, email address, hashed password,
                and assigned role such as Owner, Manager, Waiter, Kitchen, or Cashier).
              </li>
              <li>
                <strong>Operational Data:</strong> Menu items, prices, floor/counter layouts,
                orders, and daily payment summaries entered by authorized staff inside the app.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-semibold text-[22px] text-[#0B1F3B]">
              2. No Third-Party Trackers or Advertising Cookies
            </h2>
            <p>
              Our marketing website uses <strong>zero third-party analytics scripts</strong>,{" "}
              <strong>zero advertising pixels</strong>, and <strong>zero tracking cookies</strong>.
              All fonts and media are self-hosted. Within the {SITE_CONFIG.productName} web
              application, we use strictly necessary session/authentication storage solely to keep
              signed-in staff authenticated and remember language preferences (English or Tamil).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-semibold text-[22px] text-[#0B1F3B]">
              3. How We Use Your Information
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>To contact you via phone or WhatsApp to schedule and deliver your requested product demo.</li>
              <li>To provision, operate, maintain, and support your {SITE_CONFIG.productName} account.</li>
              <li>To provide role-based access, customer support, and essential service notices.</li>
              <li>To protect against abuse, automated spam, and unauthorized account access.</li>
            </ul>
            <p>
              We <strong>never sell, rent, or trade</strong> your personal data or your
              restaurant&apos;s sales data to third parties or advertisers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-semibold text-[22px] text-[#0B1F3B]">
              4. Data Sharing and Disclosure
            </h2>
            <p>
              We share data only where necessary to host and run the service (such as cloud server
              and database infrastructure providers bound by confidentiality obligations) or when
              required to comply with a valid legal order, statutory requirement, or law
              enforcement request under applicable Indian law.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-semibold text-[22px] text-[#0B1F3B]">
              5. Data Security
            </h2>
            <p>
              We implement reasonable administrative, technical, and organizational safeguards,
              including encrypted transport (HTTPS/TLS), salted password hashing, role-based access
              control, and logical separation between different businesses&apos; records. While we
              work hard to protect your data, no internet transmission or storage system is
              completely immune to risk.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-semibold text-[22px] text-[#0B1F3B]">
              6. Data Retention and Deletion
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Demo Leads:</strong> Retained only as long as needed to schedule and follow
                up on your demo request, and deleted within 12 months of last contact or earlier
                upon your request.
              </li>
              <li>
                <strong>Customer Business Data:</strong> Retained while your account is active.
                Upon written termination, you may request an export or permanent deletion of your
                business records, which we process within 30 calendar days (subject to any
                statutory retention obligations).
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-semibold text-[22px] text-[#0B1F3B]">
              7. Your Rights (DPDPA 2023)
            </h2>
            <p>As a Data Principal under Indian law, you have the right to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Request access to a summary of the personal data we hold about you.</li>
              <li>Request correction or updating of inaccurate or incomplete details.</li>
              <li>Withdraw consent for demo follow-up and request erasure of your personal data.</li>
              <li>Raise a grievance with our Grievance Officer using the contact details below.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-semibold text-[22px] text-[#0B1F3B]">
              8. Updates to This Policy
            </h2>
            <p>
              We may update this Privacy Policy as {SITE_CONFIG.productName} evolves. Material
              changes will be reflected by updating the Effective Date at the top of this page.
            </p>
          </section>

          <section className="rounded-[16px] border border-[#E6E1D8] bg-[#FFF3E0]/50 p-6 space-y-2">
            <h2 className="font-display font-semibold text-[20px] text-[#0B1F3B]">
              9. Grievance Officer &amp; Contact Details
            </h2>
            <p>
              For data access, deletion requests, or privacy grievances, please contact:
            </p>
            <p className="font-semibold text-[#0B1F3B]">{SITE_CONFIG.companyName}</p>
            <p>Address: {SITE_CONFIG.address}</p>
            <p>
              Email:{" "}
              <a
                href={`mailto:${SITE_CONFIG.contactEmail}`}
                className="font-semibold text-[#0B1F3B] underline"
              >
                {SITE_CONFIG.contactEmail}
              </a>
            </p>
            <p>
              Phone / WhatsApp:{" "}
              <a
                href={`tel:${SITE_CONFIG.contactPhone.replace(/[^\d+]/g, "")}`}
                className="font-semibold text-[#0B1F3B] underline"
              >
                {SITE_CONFIG.contactPhone}
              </a>
            </p>
            <p className="text-[14px] text-[#0B1F3B]/75">
              We aim to acknowledge and resolve privacy requests within 7 business days.
            </p>
          </section>
        </article>
      </section>
    );
  }

  return (
    <section className="py-12 lg:py-20 mx-auto max-w-[820px] px-5 sm:px-8 text-[#0B1F3B]">
      <article className="space-y-8 text-[16px] leading-[1.7] text-[#0B1F3B]/85">
        {isTa && (
          <div className="rounded-[14px] border border-[#E6E1D8] bg-[#FFF3E0]/70 p-4 text-[14px] text-[#0B1F3B]">
            <strong>தமிழ் சுருக்கம்:</strong> ServeMyFood வணிகப் பயன்பாட்டிற்கான இணைய மென்பொருள்.
            இன்று நேரலையில் உள்ள வசதிகள் மற்றும் பயன்பாட்டு நிபந்தனைகள் கீழே விவரிக்கப்பட்டுள்ளன.
          </div>
        )}
        <header className="space-y-3 border-b border-[#E6E1D8] pb-6">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-[#0B1F3B]/70">
            Effective Date: {EFFECTIVE_DATE}
          </p>
          <h1 className="font-display font-semibold text-[32px] lg:text-[42px] leading-[1.15] text-[#0B1F3B]">
            Terms of Service
          </h1>
          <p className="text-[16px] text-[#0B1F3B]/80">
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access to the{" "}
            {SITE_CONFIG.productName} website and web software operated by{" "}
            <strong>{SITE_CONFIG.companyName}</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or
            &ldquo;our&rdquo;). By visiting this website, submitting a demo request, or using{" "}
            {SITE_CONFIG.productName}, you agree to these Terms.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="font-display font-semibold text-[22px] text-[#0B1F3B]">
            1. Eligibility &amp; Business Use
          </h2>
          <p>
            {SITE_CONFIG.productName} is a business-to-business (B2B) software service built for
            tea shops, bakeries, cafes, restaurants, and hotels. By creating or using an account,
            you confirm that you are at least 18 years old and authorized to bind the business you
            represent under the Indian Contract Act, 1872.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-semibold text-[22px] text-[#0B1F3B]">
            2. Live Features vs. Coming Soon Features
          </h2>
          <p>
            Only features expressly described as &ldquo;Works today&rdquo; on our website are
            currently live in production. Features marked &ldquo;Coming soon&rdquo; — including
            customer QR self-ordering, direct online guest UPI checkout, kitchen stock and recipe
            tracking, staff shifts/attendance, and hotel room service posting — are under
            development, are not guaranteed by any specific release date, and do not form part of
            your current service scope unless explicitly activated in your plan.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-semibold text-[22px] text-[#0B1F3B]">
            3. Billing, Receipts &amp; Statutory Compliance Disclaimer
          </h2>
          <p>
            {SITE_CONFIG.productName} currently provides operational order tickets, bill summaries,
            and payment recording (cash, UPI, or card recorded at the counter).{" "}
            <strong>
              {SITE_CONFIG.productName} does not currently generate statutory compliance invoices
            </strong>{" "}
            and does not act as a payment gateway or accounting advisor. Demo receipts are labelled
            DEMO RECEIPT. You are solely responsible for issuing statutory invoices where required
            by law, maintaining accounting records, filing statutory returns, and complying with
            FSSAI and local municipal regulations.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-semibold text-[22px] text-[#0B1F3B]">
            4. Account Security &amp; Staff Roles
          </h2>
          <p>
            You are responsible for keeping staff login credentials confidential, assigning
            appropriate roles (Owner, Manager, Waiter, Kitchen, Cashier), and promptly revoking
            access when a staff member leaves your business. You must notify us immediately at{" "}
            <a
              href={`mailto:${SITE_CONFIG.contactEmail}`}
              className="font-semibold text-[#0B1F3B] underline"
            >
              {SITE_CONFIG.contactEmail}
            </a>{" "}
            if you suspect unauthorized access to your account.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-semibold text-[22px] text-[#0B1F3B]">
            5. Acceptable Use
          </h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Use the service for any unlawful, fraudulent, or misleading activity.</li>
            <li>Copy, reverse engineer, decompile, or attempt to extract the source code of {SITE_CONFIG.productName}.</li>
            <li>Probe, scan, overload, or bypass security controls or access another business&apos;s data.</li>
            <li>Submit automated spam or false inquiries through the demo request form.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-semibold text-[22px] text-[#0B1F3B]">
            6. Subscriptions, Trials &amp; Termination
          </h2>
          <p>
            Commercial plan fees, trial durations, and billing cycles are confirmed in writing
            during onboarding before any paid subscription begins. Either party may terminate an
            active account by giving written notice. We may suspend or terminate access if an
            account materially breaches these Terms, creates a security risk, or remains unpaid
            past its due date after notice.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-semibold text-[22px] text-[#0B1F3B]">
            7. Intellectual Property &amp; Your Data
          </h2>
          <p>
            All software code, interfaces, brand names, logos, and documentation for{" "}
            {SITE_CONFIG.productName} remain the exclusive intellectual property of{" "}
            {SITE_CONFIG.companyName}. You retain full ownership of all menus, item photos, and
            order/sales records you upload or create in your account, and grant us a limited
            license to host and process that data solely to provide the service to you.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-semibold text-[22px] text-[#0B1F3B]">
            8. Service Availability &amp; Disclaimer of Warranties
          </h2>
          <p>
            {SITE_CONFIG.productName} requires an active internet connection for live order
            synchronization between devices. The website and software are provided on an
            &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. While we strive for reliable
            operation, we do not warrant uninterrupted, error-free, or continuous uptime.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-semibold text-[22px] text-[#0B1F3B]">
            9. Limitation of Liability
          </h2>
          <p>
            To the maximum extent permitted by applicable Indian law, {SITE_CONFIG.companyName}{" "}
            shall not be liable for any indirect, incidental, special, consequential, or punitive
            damages, including loss of profits, revenue, or business interruption. Our total
            aggregate liability arising out of or relating to the service shall not exceed the
            total subscription fees actually paid by you to us in the three (3) months immediately
            preceding the event giving rise to the claim.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-semibold text-[22px] text-[#0B1F3B]">
            10. Governing Law &amp; Dispute Resolution
          </h2>
          <p>
            These Terms are governed by and construed in accordance with the laws of India. Any
            dispute arising out of or in connection with these Terms shall first be attempted to
            be resolved amicably within 30 days of written notice, failing which the competent
            courts at Dharmapuri, Tamil Nadu, India shall have exclusive jurisdiction.
          </p>
        </section>

        <section className="rounded-[16px] border border-[#E6E1D8] bg-[#FFF3E0]/50 p-6 space-y-2">
          <h2 className="font-display font-semibold text-[20px] text-[#0B1F3B]">
            11. Contact Us
          </h2>
          <p className="font-semibold text-[#0B1F3B]">{SITE_CONFIG.companyName}</p>
          <p>Address: {SITE_CONFIG.address}</p>
          <p>
            Email:{" "}
            <a
              href={`mailto:${SITE_CONFIG.contactEmail}`}
              className="font-semibold text-[#0B1F3B] underline"
            >
              {SITE_CONFIG.contactEmail}
            </a>
          </p>
          <p>
            Phone / WhatsApp:{" "}
            <a
              href={`tel:${SITE_CONFIG.contactPhone.replace(/[^\d+]/g, "")}`}
              className="font-semibold text-[#0B1F3B] underline"
            >
              {SITE_CONFIG.contactPhone}
            </a>
          </p>
        </section>
      </article>
    </section>
  );
};
