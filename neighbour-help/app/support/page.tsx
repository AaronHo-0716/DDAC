"use client";

import { useState } from "react";
import { useAuth } from "@/app/lib/context/AuthContext";
import { useChatWidget } from "@/app/lib/context/ChatWidgetContext";
import { supportService } from "@/app/lib/api/messages";
import {
  MessageCircle,
  Phone,
  Mail,
  Clock,
  ChevronDown,
  ChevronUp,
  Search,
  Wrench,
  ShieldCheck,
  CreditCard,
  FileText,
  CheckCircle,
} from "lucide-react";

const CATEGORIES = [
  {
    icon: <Wrench className="w-5 h-5 text-[#0B74FF]" />,
    bg: "bg-blue-50",
    label: "Jobs & Bookings",
    count: 14,
  },
  {
    icon: <ShieldCheck className="w-5 h-5 text-green-600" />,
    bg: "bg-green-50",
    label: "Account & Verification",
    count: 9,
  },
  {
    icon: <CreditCard className="w-5 h-5 text-purple-600" />,
    bg: "bg-purple-50",
    label: "Payments & Billing",
    count: 11,
  },
  {
    icon: <FileText className="w-5 h-5 text-amber-600" />,
    bg: "bg-amber-50",
    label: "Policies & Safety",
    count: 7,
  },
];

const FAQS = [
  {
    q: "How do I post a job on NeighbourHelp?",
    a: 'Click "Post a Job" from your dashboard. You\'ll be guided through a short 4-step form — choose a category, describe the work, optionally add photos, and review your posting. Once submitted, verified handymen in your area will start bidding within minutes.',
    category: "Jobs & Bookings",
  },
  {
    q: "How are handymen verified?",
    a: "Every handyman on our platform goes through a 3-step verification process: (1) identity verification via MyKad or passport, (2) skill assessment conducted by our in-house team or accredited trade partners, and (3) a background check through the Royal Malaysia Police criminal record system. Verified Pro handymen additionally carry RM 50,000 liability insurance.",
    category: "Account & Verification",
  },
  {
    q: "What is the 30-day service guarantee?",
    a: "If you are unsatisfied with a completed job within 30 days — for example, a repair fails or the work is substandard — contact our support team. We will arrange for the original handyman to return and fix the issue at no cost, or assign a new handyman if necessary. This guarantee applies to all jobs booked through NeighbourHelp.",
    category: "Policies & Safety",
  },
  {
    q: "How does the bidding system work?",
    a: "After you post a job, available handymen in your area can submit bids. Each bid includes their price, estimated arrival time, and a short message. You can review each handyman's rating, completed jobs, and reviews before accepting. You are under no obligation to accept any bid.",
    category: "Jobs & Bookings",
  },
  {
    q: "When and how do I pay?",
    a: "Payment is only processed after you confirm the job is complete. You can pay via credit/debit card, online banking (FPX), or e-wallets (Touch 'n Go, GrabPay). NeighbourHelp holds the payment in escrow until you confirm completion, protecting both you and the handyman.",
    category: "Payments & Billing",
  },
  {
    q: "Can I cancel a job after accepting a bid?",
    a: "Yes. You may cancel a job up to 2 hours before the handyman's scheduled arrival at no charge. Cancellations within 2 hours may incur a RM 15 late cancellation fee to compensate the handyman for their time. Emergency jobs cannot be cancelled once the handyman is en route.",
    category: "Jobs & Bookings",
  },
  {
    q: "What happens if a handyman no-shows?",
    a: "If a handyman does not arrive within 30 minutes of the agreed time and is unresponsive, you can mark them as a no-show in the app. NeighbourHelp will immediately re-match you with another available handyman. No-show handymen receive a strike and may be suspended from the platform.",
    category: "Jobs & Bookings",
  },
  {
    q: "Is my personal information safe?",
    a: "Yes. NeighbourHelp is fully compliant with Malaysia's Personal Data Protection Act 2010 (PDPA). Your address and contact details are only shared with a handyman after you have accepted their bid. We never sell your data to third parties. See our Privacy Policy for full details.",
    category: "Policies & Safety",
  },
  {
    q: "How do I become a verified handyman?",
    a: 'Navigate to the Handyman registration page and complete your profile. You will be prompted to upload your IC/passport, a selfie, proof of trade qualifications (if applicable), and agree to a background check. The verification process typically takes 2–3 business days. You\'ll be notified by email once approved.',
    category: "Account & Verification",
  },
  {
    q: "What are platform fees for handymen?",
    a: "NeighbourHelp charges a 12% platform fee on each completed job. This covers payment processing, insurance contribution, and platform maintenance. There are no monthly subscription fees or sign-up costs. The fee is automatically deducted before payout to your registered bank account.",
    category: "Payments & Billing",
  },
];

function FAQItem({ faq }: { faq: (typeof FAQS)[0] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[#E5E7EB] rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left bg-white hover:bg-[#F7F8FA] transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm font-medium text-[#111827] pr-4">{faq.q}</span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-5 py-4 bg-[#F7F8FA] border-t border-[#E5E7EB]">
          <p className="text-sm text-[#374151] leading-relaxed">{faq.a}</p>
        </div>
      )}
    </div>
  );
}

export default function SupportPage() {
  const { user } = useAuth();
  const { open, setActiveConversationId } = useChatWidget();
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [supportChatLoading, setSupportChatLoading] = useState(false);
  const [supportChatError, setSupportChatError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    category: "",
    message: "",
  });

  const filtered = FAQS.filter(
    (f) =>
      search === "" ||
      f.q.toLowerCase().includes(search.toLowerCase()) ||
      f.a.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const handleStartSupportChat = async () => {
    if (!user) {
      if (typeof window !== "undefined") {
        window.location.href = "/login?next=/support";
      }
      return;
    }

    setSupportChatLoading(true);
    setSupportChatError(null);
    try {
      const conversation = await supportService.createSupportConversation();
      setActiveConversationId(conversation.id);
      open();
    } catch (err) {
      setSupportChatError(err instanceof Error ? err.message : "Unable to start support chat.");
    } finally {
      setSupportChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      {/* Hero */}
      <section className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h1 className="text-3xl font-bold text-[#111827] mb-3">How can we help?</h1>
          <p className="text-[#6B7280] mb-8">
            Search our help centre or browse topics below. Our team is also available 7 days a week.
          </p>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Search for help, e.g. 'cancel a job', 'refund', 'verification'…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF] focus:border-transparent"
            />
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* Help categories */}
        {search === "" && (
          <div>
            <h2 className="text-lg font-bold text-[#111827] mb-4">Browse by topic</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {CATEGORIES.map(({ icon, bg, label, count }) => (
                <button
                  key={label}
                  onClick={() => setSearch(label.split(" ")[0])}
                  className="bg-white rounded-2xl border border-[#E5E7EB] p-5 text-center hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <div
                    className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mx-auto mb-3`}
                  >
                    {icon}
                  </div>
                  <p className="text-sm font-semibold text-[#111827]">{label}</p>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">{count} articles</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* FAQ */}
        <div>
          <h2 className="text-lg font-bold text-[#111827] mb-4">
            {search === ""
              ? "Frequently Asked Questions"
              : `${filtered.length} result${filtered.length !== 1 ? "s" : ""} for "${search}"`}
          </h2>
          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 text-center text-[#6B7280] text-sm">
              No articles found. Try a different search term or contact our support team below.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((faq) => (
                <FAQItem key={faq.q} faq={faq} />
              ))}
            </div>
          )}
        </div>

        {/* Contact channels */}
        <div>
          <h2 className="text-lg font-bold text-[#111827] mb-4">Contact Us</h2>
          {supportChatError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {supportChatError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[
              {
                icon: <MessageCircle className="w-5 h-5 text-[#0B74FF]" />,
                bg: "bg-blue-50",
                title: "Live Chat",
                desc: "Chat with a support agent",
                detail: "Avg. response: 3 minutes",
                action: "Start Chat",
              },
              {
                icon: <Mail className="w-5 h-5 text-purple-600" />,
                bg: "bg-purple-50",
                title: "Email",
                desc: "support@neighbourhelp.my",
                detail: "Response within 24 hours",
                action: "Send Email",
              },
              {
                icon: <Phone className="w-5 h-5 text-green-600" />,
                bg: "bg-green-50",
                title: "Phone",
                desc: "+603 8888 7777",
                detail: (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Mon–Sun 8 AM–10 PM
                  </span>
                ),
                action: "Call Now",
              },
            ].map(({ icon, bg, title, desc, detail, action }) => (
              <div
                key={title}
                className="bg-white rounded-2xl border border-[#E5E7EB] p-6 flex flex-col items-center text-center hover:shadow-md transition-shadow"
              >
                <div
                  className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center mb-3`}
                >
                  {icon}
                </div>
                <p className="font-semibold text-[#111827] text-sm">{title}</p>
                <p className="text-sm text-[#6B7280] mt-0.5">{desc}</p>
                <p className="text-xs text-[#9CA3AF] mt-1 mb-4">{detail}</p>
                <button
                  onClick={() => {
                    if (title === "Live Chat") {
                      void handleStartSupportChat();
                      return;
                    }

                    if (title === "Email" && typeof window !== "undefined") {
                      window.location.href = "mailto:support@neighbourhelp.my";
                      return;
                    }

                    if (title === "Phone" && typeof window !== "undefined") {
                      window.location.href = "tel:+60388887777";
                    }
                  }}
                  disabled={title === "Live Chat" && supportChatLoading}
                  className="px-4 py-2 text-xs font-semibold text-[#0B74FF] border border-[#0B74FF] rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-60"
                >
                  {title === "Live Chat" && supportChatLoading ? "Starting..." : action}
                </button>
              </div>
            ))}
          </div>

          {/* Contact form */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 lg:p-8">
            {submitted ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-[#111827] mb-2">Message Received!</h3>
                <p className="text-sm text-[#6B7280]">
                  Thanks for reaching out. Our team will get back to you at{" "}
                  <span className="font-medium text-[#111827]">{formData.email}</span> within 24
                  hours.
                </p>
                <button
                  onClick={() => { setSubmitted(false); setFormData({ name: "", email: "", category: "", message: "" }); }}
                  className="mt-6 text-sm text-[#0B74FF] hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-base font-bold text-[#111827] mb-5">Send Us a Message</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#111827] mb-1.5">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        placeholder="Ahmad bin Razif"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-2.5 border border-[#E5E7EB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#111827] mb-1.5">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="email"
                        placeholder="you@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-2.5 border border-[#E5E7EB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF] focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#111827] mb-1.5">
                      Topic <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-2.5 border border-[#E5E7EB] rounded-xl text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#0B74FF] focus:border-transparent bg-white"
                    >
                      <option value="">Select a topic…</option>
                      <option>Jobs &amp; Bookings</option>
                      <option>Account &amp; Verification</option>
                      <option>Payments &amp; Billing</option>
                      <option>Policies &amp; Safety</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#111827] mb-1.5">
                      Message <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Please describe your issue or question in as much detail as possible…"
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full px-4 py-2.5 border border-[#E5E7EB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0B74FF] focus:border-transparent resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-[#0B74FF] text-white rounded-xl text-sm font-semibold hover:bg-[#0056CC] transition-colors"
                  >
                    Submit Request
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
