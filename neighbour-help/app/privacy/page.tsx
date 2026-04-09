import Link from "next/link";
import { ShieldCheck } from "lucide-react";

const SECTIONS = [
  {
    id: "overview",
    title: "1. Overview",
    content: [
      "NeighbourHelp Sdn. Bhd. (Company No. 202101234567) ('we', 'us', 'our') is committed to protecting the personal data of every individual who uses our platform. This Privacy Policy explains what personal data we collect, why we collect it, how we use it, who we share it with, and what rights you have.",
      "This Policy applies to all users of the NeighbourHelp website (neighbourhelp.my) and mobile applications. It is to be read together with our Terms of Service.",
      "NeighbourHelp is a registered data controller under Malaysia's Personal Data Protection Act 2010 (PDPA). Our Data Protection Officer can be contacted at dpo@neighbourhelp.my.",
    ],
  },
  {
    id: "data-collected",
    title: "2. Data We Collect",
    subsections: [
      {
        label: "2.1 Data You Provide",
        items: [
          "Account registration: full name, email address, phone number, password (hashed), and profile photo.",
          "Homeowner job postings: service address, job description, photos, and budget.",
          "Handyman profiles: trade qualifications, work history, identity document (MyKad/passport number and scan), selfie photo, and bank account number for payouts.",
          "Payment information: credit/debit card details and e-wallet identifiers (processed and stored by our PCI-DSS-compliant payment processor — we never store raw card numbers).",
          "Communications: messages sent through the in-app chat, support tickets, and email correspondence with our team.",
        ],
      },
      {
        label: "2.2 Data Collected Automatically",
        items: [
          "Device information: device type, operating system, browser version, and unique device identifiers.",
          "Usage data: pages visited, features used, timestamps, and click-stream data.",
          "Location data: approximate city-level location derived from IP address. If you grant permission, precise GPS location is used to match you with nearby handymen. You may revoke this permission at any time via your device settings.",
          "Log data: server logs including your IP address, request timestamps, and error reports.",
          "Cookies and tracking technologies: see Section 8 (Cookies) for full details.",
        ],
      },
      {
        label: "2.3 Data from Third Parties",
        items: [
          "Identity verification: we use a third-party identity verification provider to check MyKad numbers against national database records.",
          "Background checks: criminal record checks conducted by a licensed screening partner via written consent obtained during Handyman registration.",
          "Payment processors: transaction confirmation data (amount, status, timestamp) from our payment gateway.",
        ],
      },
    ],
  },
  {
    id: "how-we-use",
    title: "3. How We Use Your Data",
    content: [
      "To provide the Platform: creating and managing your account, matching Homeowners with Handymen, processing payments, and handling disputes.",
      "To verify identity and safety: running background checks on Handymen and confirming the legitimacy of user accounts.",
      "To communicate with you: sending transactional emails (booking confirmations, receipts, alerts), push notifications (new bids, job updates), and service announcements. You may opt out of marketing communications at any time.",
      "To improve the Platform: analysing usage patterns, conducting A/B tests, and training internal models to improve search and matching quality. Any data used for model training is aggregated and stripped of direct identifiers.",
      "To comply with legal obligations: responding to court orders, regulatory requests, or as otherwise required by Malaysian law.",
      "To prevent fraud and abuse: detecting and investigating suspicious activity, enforcing our Terms of Service, and protecting the safety of our community.",
    ],
  },
  {
    id: "legal-basis",
    title: "4. Legal Basis for Processing",
    content: [
      "Under the PDPA 2010, we process your personal data on the following bases:",
      "Contractual necessity: processing required to perform our services under the Terms of Service (e.g., account creation, payment processing, job matching).",
      "Consent: processing for optional features such as precise GPS location, push notifications, and marketing emails. You may withdraw consent at any time via your account settings.",
      "Legitimate interests: processing for fraud prevention, platform security, and service improvement, where our interests are not overridden by your rights.",
      "Legal obligation: processing required to comply with applicable Malaysian law, court orders, or regulatory requirements.",
    ],
  },
  {
    id: "sharing",
    title: "5. Who We Share Your Data With",
    content: [
      "We do not sell your personal data. We share data only with the following categories of recipients, and only to the extent necessary:",
      "Other users: Homeowners' service addresses and contact numbers are shared with a Handyman only after the Homeowner accepts that Handyman's bid. Handymen's profile information (name, photo, ratings, trade category) is visible to all registered users.",
      "Service providers: identity verification providers, payment processors, cloud hosting providers (Amazon Web Services, Singapore region), email delivery services, and analytics platforms. All providers are bound by data processing agreements requiring them to protect your data.",
      "Legal authorities: where required by a court order, subpoena, or applicable Malaysian law, and where we believe disclosure is necessary to prevent imminent harm.",
      "Business transfers: in the event of a merger, acquisition, or sale of assets, your data may be transferred to the successor entity, subject to the same protections described in this Policy.",
    ],
  },
  {
    id: "retention",
    title: "6. Data Retention",
    content: [
      "We retain your personal data for as long as your account is active, or as necessary to provide services, resolve disputes, and comply with legal obligations.",
      "Account data: retained for the duration of your account plus 7 years after closure to satisfy record-keeping obligations under the Malaysian Income Tax Act 1967.",
      "Identity verification documents: retained for 5 years after last verification, then securely deleted.",
      "In-app chat messages: retained for 2 years, then permanently deleted.",
      "Job and payment records: retained for 7 years in compliance with financial record-keeping requirements.",
      "You may request deletion of your account and associated data at any time (see Section 7). Note that some data may be retained for the minimum periods required by law even after account deletion.",
    ],
  },
  {
    id: "your-rights",
    title: "7. Your Rights (PDPA)",
    content: [
      "Under the Personal Data Protection Act 2010, you have the following rights:",
      "Right of Access: you may request a copy of the personal data we hold about you. We will respond within 21 days.",
      "Right of Correction: you may request that inaccurate or incomplete data be corrected. Most profile data can be updated directly within the app.",
      "Right to Withdraw Consent: where processing is based on consent, you may withdraw it at any time. This does not affect the lawfulness of processing before withdrawal.",
      "Right to Limit Processing: in certain circumstances you may request that we restrict the processing of your data.",
      "Right to Data Portability: you may request an export of your data in a machine-readable format (JSON or CSV).",
      "To exercise any right, email dpo@neighbourhelp.my with the subject line 'Data Rights Request'. We may need to verify your identity before processing the request.",
    ],
  },
  {
    id: "cookies",
    title: "8. Cookies and Tracking",
    content: [
      "We use the following types of cookies and similar tracking technologies:",
      "Essential cookies: strictly necessary for the Platform to function (session management, authentication tokens). These cannot be disabled.",
      "Analytics cookies: used to understand how users interact with the Platform (e.g., Google Analytics 4 with IP anonymisation enabled). You may opt out via our Cookie Preferences banner.",
      "Preference cookies: used to remember your settings, such as language preference and notification settings.",
      "Marketing cookies: used to measure the effectiveness of our advertising campaigns. We do not display ads within the Platform; these cookies are used for external campaign attribution only. You may opt out at any time.",
      "You can manage your cookie preferences at any time through the Cookie Settings link in the footer, or via your browser's privacy settings.",
    ],
  },
  {
    id: "security",
    title: "9. Security",
    content: [
      "We implement industry-standard technical and organisational measures to protect your personal data, including: TLS 1.3 encryption for all data in transit; AES-256 encryption for data at rest; strict access controls limiting who within our organisation can access personal data; regular penetration testing and security audits; and multi-factor authentication for all internal admin systems.",
      "Despite these measures, no system is completely secure. If you suspect your account has been compromised, contact us immediately at security@neighbourhelp.my.",
      "In the event of a data breach that is likely to harm you, we will notify you and the relevant authorities within the timeframes required by the PDPA and any applicable regulations.",
    ],
  },
  {
    id: "children",
    title: "10. Children's Privacy",
    content: [
      "The Platform is not directed at individuals under the age of 18. We do not knowingly collect personal data from children. If we become aware that we have inadvertently collected data from a person under 18, we will delete it promptly.",
      "If you are a parent or guardian and believe your child has registered on our Platform, please contact us at dpo@neighbourhelp.my.",
    ],
  },
  {
    id: "transfers",
    title: "11. International Data Transfers",
    content: [
      "Your data is primarily stored on servers located in Singapore (AWS ap-southeast-1), which provides an adequate level of data protection comparable to Malaysian standards.",
      "Where we transfer data to service providers outside Malaysia, we ensure appropriate safeguards are in place, including standard contractual clauses and data processing agreements. A list of countries to which data may be transferred is available on request.",
    ],
  },
  {
    id: "changes",
    title: "12. Changes to This Policy",
    content: [
      "We may update this Privacy Policy from time to time. We will notify you of material changes by email and via an in-app notice at least 14 days before the change takes effect.",
      "The 'Last reviewed' date at the top of this page reflects the most recent update. Continued use of the Platform after changes are effective constitutes your acceptance of the revised Policy.",
    ],
  },
  {
    id: "contact-dpo",
    title: "13. Contact the DPO",
    content: [
      "For any privacy-related queries, concerns, or data rights requests, please contact our Data Protection Officer:",
      "Email: dpo@neighbourhelp.my",
      "Post: Data Protection Officer, NeighbourHelp Sdn. Bhd., Level 23, Menara Integra, 348 Jalan Tun Razak, 50400 Kuala Lumpur, Malaysia.",
      "If you are not satisfied with our response, you have the right to lodge a complaint with the Department of Personal Data Protection Malaysia (JPDP) at pdp.gov.my.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      {/* Header */}
      <section className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-green-50 rounded-2xl mb-5">
            <ShieldCheck className="w-6 h-6 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-[#111827] mb-3">Privacy Policy</h1>
          <p className="text-[#6B7280] text-sm">
            Effective date: <strong>1 January 2025</strong> &nbsp;·&nbsp; Last reviewed:{" "}
            <strong>1 March 2026</strong>
          </p>
          <p className="text-sm text-[#6B7280] mt-3 max-w-xl mx-auto">
            We take your privacy seriously. This policy explains exactly what data we collect, why we
            collect it, and how you can control it.
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex gap-8 items-start">
        {/* Table of contents — sticky sidebar */}
        <aside className="hidden lg:block w-56 flex-shrink-0 sticky top-24">
          <p className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-3">
            Contents
          </p>
          <nav className="space-y-1">
            {SECTIONS.map(({ id, title }) => (
              <a
                key={id}
                href={`#${id}`}
                className="block text-xs text-[#6B7280] hover:text-[#0B74FF] py-1 transition-colors"
              >
                {title}
              </a>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 space-y-8">
          {/* Summary banner */}
          <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 text-sm text-green-800">
            <strong>Plain-language summary:</strong> We collect only the data needed to run the
            platform. We never sell your data. Your address is only shared with a handyman after you
            accept their bid. You can request a copy, correction, or deletion of your data at any
            time by emailing dpo@neighbourhelp.my.
          </div>

          {SECTIONS.map(({ id, title, content, subsections }) => (
            <section key={id} id={id} className="bg-white rounded-2xl border border-[#E5E7EB] p-7">
              <h2 className="text-base font-bold text-[#111827] mb-4">{title}</h2>

              {subsections ? (
                <div className="space-y-5">
                  {subsections.map(({ label, items }) => (
                    <div key={label}>
                      <p className="text-sm font-semibold text-[#374151] mb-2">{label}</p>
                      <ul className="space-y-2">
                        {items.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-[#374151] leading-relaxed">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#0B74FF] flex-shrink-0 mt-2" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {content!.map((para, i) => (
                    <p key={i} className="text-sm text-[#374151] leading-relaxed">
                      {para}
                    </p>
                  ))}
                </div>
              )}
            </section>
          ))}

          <p className="text-xs text-[#9CA3AF] text-center pb-4">
            Questions? Visit our{" "}
            <Link href="/support" className="text-[#0B74FF] hover:underline">
              Support Centre
            </Link>{" "}
            or email{" "}
            <a href="mailto:dpo@neighbourhelp.my" className="text-[#0B74FF] hover:underline">
              dpo@neighbourhelp.my
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
