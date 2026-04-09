import Link from "next/link";
import { FileText } from "lucide-react";

const SECTIONS = [
  {
    id: "acceptance",
    title: "1. Acceptance of Terms",
    content: [
      'By accessing or using the NeighbourHelp platform — including our website at neighbourhelp.my and our mobile applications ("the Platform") — you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the Platform.',
      "These Terms constitute a legally binding agreement between you and NeighbourHelp Sdn. Bhd. (Company No. 202101234567), a company incorporated in Malaysia under the Companies Act 2016, with its registered office at Level 23, Menara Integra, 348 Jalan Tun Razak, 50400 Kuala Lumpur.",
      'We may update these Terms from time to time. We will give you at least 14 days\' notice of material changes by email or via an in-app notification. Continued use of the Platform after changes take effect constitutes acceptance of the revised Terms.',
    ],
  },
  {
    id: "definitions",
    title: "2. Definitions",
    content: [
      '"Homeowner" means a registered user who posts job listings on the Platform seeking home repair or maintenance services.',
      '"Handyman" means a registered user who creates a professional profile on the Platform to offer home repair or maintenance services.',
      '"Job" means a request for services posted by a Homeowner on the Platform.',
      '"Bid" means an offer submitted by a Handyman in response to a Job listing.',
      '"Service Fee" means the percentage of the agreed job price charged by NeighbourHelp to Handymen upon successful completion of a Job.',
      '"Escrow" means the temporary holding of funds by NeighbourHelp between a Homeowner\'s payment and release to the Handyman.',
    ],
  },
  {
    id: "eligibility",
    title: "3. Eligibility",
    content: [
      "To use the Platform you must be at least 18 years of age and possess the legal capacity to enter into binding contracts under Malaysian law.",
      "To register as a Handyman, you must in addition: (a) be a Malaysian citizen or hold a valid Malaysian work permit; (b) successfully complete NeighbourHelp's identity and background verification process; and (c) possess the skills, qualifications, and licences required by applicable Malaysian law to perform the services you offer.",
      "NeighbourHelp reserves the right to refuse registration or suspend any account at its sole discretion, including where we have reason to believe that the information provided is inaccurate, fraudulent, or where the user poses a risk to other users or to the integrity of the Platform.",
    ],
  },
  {
    id: "platform-role",
    title: "4. NeighbourHelp's Role",
    content: [
      "NeighbourHelp operates as an intermediary marketplace only. We facilitate connections between Homeowners and Handymen but are not a party to any service agreement entered into between them. NeighbourHelp is not an employer, agent, or contractor of any Handyman.",
      "The service contract for any given job is formed directly between the Homeowner and the Handyman upon the Homeowner's acceptance of a Bid. NeighbourHelp is not responsible for the quality, timeliness, legality, or safety of any services provided through the Platform, except to the extent expressly set out in our Service Guarantee.",
      "Where we operate the 30-Day Service Guarantee, we do so as a voluntary customer satisfaction commitment and not as an admission of liability.",
    ],
  },
  {
    id: "payments",
    title: "5. Payments and Fees",
    content: [
      "Homeowners agree to pay the full amount of an accepted Bid upon confirmation that a job is complete. Payment is processed via our third-party payment processor and held in Escrow until the Homeowner confirms completion.",
      "NeighbourHelp charges Handymen a Service Fee of 12% of the agreed job price. This fee is automatically deducted prior to payout. The Service Fee is non-refundable except in the event of a verified no-show by the Homeowner.",
      "All prices displayed on the Platform are in Malaysian Ringgit (RM) inclusive of any applicable taxes. NeighbourHelp will provide Handymen with electronic tax invoices as required under the Malaysian e-Invoice mandate.",
      "Payouts to Handymen are processed within 3 business days of job completion confirmation. NeighbourHelp assumes no liability for delays caused by bank processing times.",
    ],
  },
  {
    id: "cancellations",
    title: "6. Cancellations and Refunds",
    content: [
      "Homeowners may cancel a confirmed booking at no charge up to 2 hours before the Handyman's scheduled arrival. Cancellations made with less than 2 hours' notice will incur a Late Cancellation Fee of RM 15, credited to the Handyman as partial compensation.",
      "Emergency jobs (those flagged as urgent) may not be cancelled once the Handyman has confirmed they are en route.",
      "If a Handyman cancels a confirmed job, any pre-authorised funds are immediately released back to the Homeowner. A Handyman who cancels without reasonable cause may receive a strike against their account.",
      "Refunds for disputed jobs are handled on a case-by-case basis by our disputes team. We aim to resolve all disputes within 5 business days.",
    ],
  },
  {
    id: "conduct",
    title: "7. User Conduct",
    content: [
      "You agree not to use the Platform to: (a) post false, misleading, or fraudulent job listings or bids; (b) harass, threaten, or abuse other users; (c) solicit Handymen to work outside the Platform to avoid Service Fees ('off-platform transactions'); (d) use the Platform for any unlawful purpose; or (e) attempt to reverse-engineer, scrape, or interfere with the Platform.",
      "Off-platform transactions arranged through contacts made on NeighbourHelp are a violation of these Terms and will result in immediate account termination for both parties.",
      "NeighbourHelp may monitor communications made through in-app messaging solely for safety, fraud prevention, and dispute resolution purposes.",
    ],
  },
  {
    id: "guarantee",
    title: "8. Service Guarantee",
    content: [
      "NeighbourHelp offers a 30-Day Service Guarantee on all jobs completed through the Platform. If, within 30 days of job completion, you are dissatisfied with the quality of work for the same original issue, you may submit a guarantee claim via our Support team.",
      "Upon verification of a valid claim, NeighbourHelp will at its discretion: (a) arrange for the original Handyman to rectify the issue at no additional cost; or (b) assign an alternative Handyman to complete the rectification work at no additional cost.",
      "The Service Guarantee does not cover damage caused by misuse, natural disasters, or issues unrelated to the original job scope. It also does not apply to jobs cancelled or completed outside the Platform.",
    ],
  },
  {
    id: "liability",
    title: "9. Limitation of Liability",
    content: [
      'To the fullest extent permitted by Malaysian law, NeighbourHelp\'s total liability to you for any claim arising out of or related to these Terms or the Platform shall not exceed the greater of: (a) the total Service Fees paid by you to NeighbourHelp in the 12 months preceding the claim; or (b) RM 500.',
      "NeighbourHelp shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill, whether arising from contract, tort, or otherwise.",
      "Nothing in these Terms limits liability for death or personal injury caused by negligence, fraud, or any other liability that cannot be limited by law.",
    ],
  },
  {
    id: "termination",
    title: "10. Termination",
    content: [
      "You may close your account at any time by contacting support@neighbourhelp.my. Upon closure, your profile will be deactivated and your personal data will be handled in accordance with our Privacy Policy.",
      "NeighbourHelp may suspend or terminate your access to the Platform immediately and without notice if you breach these Terms, pose a safety risk to other users, or if we are required to do so by applicable law.",
      "Provisions that by their nature should survive termination — including but not limited to sections on payments, liability, and dispute resolution — shall continue to apply.",
    ],
  },
  {
    id: "governing-law",
    title: "11. Governing Law and Dispute Resolution",
    content: [
      "These Terms are governed by the laws of Malaysia. Any dispute arising in connection with these Terms shall first be subject to good-faith negotiation. If unresolved within 30 days, the dispute shall be referred to mediation under the Asian International Arbitration Centre (AIAC) Mediation Rules.",
      "If mediation fails, disputes shall be finally resolved by binding arbitration under the AIAC Arbitration Rules, with proceedings conducted in English in Kuala Lumpur. The arbitral tribunal shall consist of one arbitrator.",
      "Notwithstanding the above, either party may seek interim or injunctive relief from the courts of Malaysia.",
    ],
  },
  {
    id: "contact",
    title: "12. Contact",
    content: [
      "For questions about these Terms, please contact our legal team at: legal@neighbourhelp.my or by post at Level 23, Menara Integra, 348 Jalan Tun Razak, 50400 Kuala Lumpur, Malaysia.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      {/* Header */}
      <section className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-50 rounded-2xl mb-5">
            <FileText className="w-6 h-6 text-[#0B74FF]" />
          </div>
          <h1 className="text-3xl font-bold text-[#111827] mb-3">Terms of Service</h1>
          <p className="text-[#6B7280] text-sm">
            Effective date: <strong>1 January 2025</strong> &nbsp;·&nbsp; Last reviewed:{" "}
            <strong>1 March 2026</strong>
          </p>
          <p className="text-sm text-[#6B7280] mt-3 max-w-xl mx-auto">
            Please read these Terms carefully before using NeighbourHelp. They explain your rights and
            obligations when using our platform.
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
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-800">
            <strong>Summary:</strong> NeighbourHelp is a two-sided marketplace — we connect you with
            handymen but are not a party to service contracts. You must be 18+, pay through the
            platform, and treat other users with respect. Handymen pay a 12% fee per job. We offer a
            30-day service guarantee on all completed jobs.
          </div>

          {SECTIONS.map(({ id, title, content }) => (
            <section key={id} id={id} className="bg-white rounded-2xl border border-[#E5E7EB] p-7">
              <h2 className="text-base font-bold text-[#111827] mb-4">{title}</h2>
              <div className="space-y-3">
                {content.map((para, i) => (
                  <p key={i} className="text-sm text-[#374151] leading-relaxed">
                    {para}
                  </p>
                ))}
              </div>
            </section>
          ))}

          <p className="text-xs text-[#9CA3AF] text-center pb-4">
            If you have questions, visit our{" "}
            <Link href="/support" className="text-[#0B74FF] hover:underline">
              Support Centre
            </Link>{" "}
            or email{" "}
            <a href="mailto:legal@neighbourhelp.my" className="text-[#0B74FF] hover:underline">
              legal@neighbourhelp.my
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
