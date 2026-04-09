import Link from "next/link";
import { Users, Briefcase, Star, Shield, Wrench, Heart, Zap, CheckCircle } from "lucide-react";
import PrimaryButton from "@/app/components/ui/PrimaryButton";

const STATS = [
  { label: "Registered Users", value: "28,400+", icon: <Users className="w-5 h-5" /> },
  { label: "Jobs Completed", value: "61,200+", icon: <Briefcase className="w-5 h-5" /> },
  { label: "Verified Handymen", value: "3,800+", icon: <Shield className="w-5 h-5" /> },
  { label: "Average Rating", value: "4.8 / 5", icon: <Star className="w-5 h-5" /> },
];

const TEAM = [
  {
    name: "Nurul Ain Binti Zulkifli",
    role: "Co-Founder & CEO",
    bio: "Former product manager at Grab with 10+ years building marketplace platforms across Southeast Asia.",
    avatar: "NA",
    bg: "bg-blue-100",
    color: "text-blue-700",
  },
  {
    name: "Marcus Chong Wei Lun",
    role: "Co-Founder & CTO",
    bio: "Full-stack engineer who previously led engineering at PropertyGuru. Obsessed with developer experience and scalable architecture.",
    avatar: "MC",
    bg: "bg-purple-100",
    color: "text-purple-700",
  },
  {
    name: "Priya Ramasamy",
    role: "Head of Operations",
    bio: "Built and scaled the handyman workforce at Kaodim before joining NeighbourHelp to lead quality assurance and vetting.",
    avatar: "PR",
    bg: "bg-green-100",
    color: "text-green-700",
  },
  {
    name: "Ahmad Fadzil bin Hassan",
    role: "Head of Product",
    bio: "UX-first product leader with a background in fintech. Passionate about making home services accessible to every Malaysian.",
    avatar: "AF",
    bg: "bg-amber-100",
    color: "text-amber-700",
  },
];

const VALUES = [
  {
    icon: <Shield className="w-5 h-5 text-[#0B74FF]" />,
    title: "Trust & Safety",
    desc: "Every handyman on our platform is background-checked, identity-verified, and skill-assessed before their first job.",
  },
  {
    icon: <Heart className="w-5 h-5 text-red-500" />,
    title: "Community First",
    desc: "We built NeighbourHelp to strengthen local communities — connecting neighbours with skilled tradespeople nearby.",
  },
  {
    icon: <Zap className="w-5 h-5 text-amber-500" />,
    title: "Speed & Reliability",
    desc: "Our emergency response feature connects homeowners with available handymen within an average of 38 minutes.",
  },
  {
    icon: <CheckCircle className="w-5 h-5 text-green-600" />,
    title: "Quality Guarantee",
    desc: "Not satisfied with the work? We offer a 30-day service guarantee and will re-assign another handyman at no extra cost.",
  },
];

const MILESTONES = [
  { year: "2021", title: "Founded", desc: "NeighbourHelp was incorporated in Kuala Lumpur with a seed round of RM 2.5M." },
  { year: "2022", title: "Public Launch", desc: "Launched in Klang Valley with 200 verified handymen and 1,000 registered homeowners." },
  { year: "2023", title: "Series A", desc: "Raised RM 18M Series A. Expanded to Penang, Johor Bahru, and Kota Kinabalu." },
  { year: "2024", title: "Emergency Feature", desc: "Launched real-time emergency job matching, cutting average response time to under 40 minutes." },
  { year: "2025", title: "50K Milestone", desc: "Surpassed 50,000 completed jobs and launched the Verified Pro handyman tier." },
  { year: "2026", title: "Today", desc: "Operating in 12 Malaysian cities with over 28,000 registered users and 3,800+ verified handymen." },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      {/* Hero */}
      <section className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#0B74FF] rounded-2xl mb-6">
            <Wrench className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-[#111827] mb-4">
            We&apos;re fixing home services — one job at a time.
          </h1>
          <p className="text-lg text-[#6B7280] max-w-2xl mx-auto leading-relaxed">
            NeighbourHelp is Malaysia&apos;s most trusted marketplace for home repair and maintenance services.
            We connect homeowners with honest, skilled, and vetted handymen in their neighbourhood.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map(({ label, value, icon }) => (
            <div
              key={label}
              className="bg-white rounded-2xl border border-[#E5E7EB] p-6 text-center hover:shadow-md transition-shadow"
            >
              <div className="flex justify-center text-[#0B74FF] mb-3">{icon}</div>
              <p className="text-2xl font-bold text-[#111827]">{value}</p>
              <p className="text-sm text-[#6B7280] mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Our Story */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-14">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 lg:p-12">
          <h2 className="text-2xl font-bold text-[#111827] mb-4">Our Story</h2>
          <div className="space-y-4 text-[#374151] leading-relaxed text-[15px]">
            <p>
              NeighbourHelp was born out of a frustrating Saturday afternoon in 2021. Our co-founders — Nurul and Marcus — were trying to get a plumber to fix a burst pipe in their apartment. After calling six different numbers found on lampposts, none showed up. The one who finally came charged triple the fair market rate.
            </p>
            <p>
              They knew there had to be a better way. Malaysia has hundreds of thousands of skilled tradespeople who struggle to find consistent work, and millions of homeowners who can&apos;t find reliable help. The gap wasn&apos;t a talent problem — it was a trust and discovery problem.
            </p>
            <p>
              Within six months, they had built a simple prototype, verified 200 handymen in Kuala Lumpur, and processed their first 1,000 jobs. Today, NeighbourHelp operates across 12 cities, has processed over 61,000 jobs, and is the highest-rated home services app in Malaysia on both the App Store and Google Play.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-14">
        <h2 className="text-2xl font-bold text-[#111827] mb-6 text-center">What We Stand For</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {VALUES.map(({ icon, title, desc }) => (
            <div
              key={title}
              className="bg-white rounded-2xl border border-[#E5E7EB] p-6 flex items-start gap-4 hover:shadow-md transition-shadow"
            >
              <div className="w-10 h-10 bg-[#F7F8FA] rounded-xl flex items-center justify-center flex-shrink-0">
                {icon}
              </div>
              <div>
                <h3 className="font-semibold text-[#111827] mb-1">{title}</h3>
                <p className="text-sm text-[#6B7280] leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Timeline */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-14">
        <h2 className="text-2xl font-bold text-[#111827] mb-8 text-center">Our Journey</h2>
        <div className="relative">
          <div className="absolute left-[68px] top-0 bottom-0 w-px bg-[#E5E7EB]" />
          <div className="space-y-6">
            {MILESTONES.map(({ year, title, desc }) => (
              <div key={year} className="flex items-start gap-5">
                <div className="w-[56px] flex-shrink-0 text-right">
                  <span className="text-sm font-bold text-[#0B74FF]">{year}</span>
                </div>
                <div className="w-6 h-6 rounded-full bg-[#0B74FF] border-4 border-white ring-1 ring-[#E5E7EB] flex-shrink-0 mt-0.5 z-10" />
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 flex-1">
                  <p className="font-semibold text-[#111827] text-sm">{title}</p>
                  <p className="text-sm text-[#6B7280] mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-14">
        <h2 className="text-2xl font-bold text-[#111827] mb-6 text-center">Meet the Team</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TEAM.map(({ name, role, bio, avatar, bg, color }) => (
            <div
              key={name}
              className="bg-white rounded-2xl border border-[#E5E7EB] p-6 text-center hover:shadow-md transition-shadow"
            >
              <div
                className={`w-14 h-14 ${bg} ${color} rounded-2xl flex items-center justify-center text-lg font-bold mx-auto mb-4`}
              >
                {avatar}
              </div>
              <p className="font-semibold text-[#111827] text-sm">{name}</p>
              <p className="text-xs text-[#0B74FF] font-medium mt-0.5 mb-3">{role}</p>
              <p className="text-xs text-[#6B7280] leading-relaxed">{bio}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="bg-[#0B74FF] rounded-2xl p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-2">Ready to get started?</h2>
          <p className="text-blue-100 mb-6 text-sm">
            Join over 28,000 homeowners who trust NeighbourHelp to keep their homes in great shape.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/login">
              <PrimaryButton variant="secondary" size="lg">
                Post a Job
              </PrimaryButton>
            </Link>
            <Link href="/support">
              <button className="px-6 py-3 rounded-xl border border-blue-300 text-white text-sm font-semibold hover:bg-white/10 transition-colors">
                Contact Us
              </button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
