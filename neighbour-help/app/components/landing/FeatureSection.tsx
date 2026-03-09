import { ClipboardList, TrendingUp, ShieldCheck } from "lucide-react";

const features = [
  {
    icon: <ClipboardList className="w-6 h-6 text-[#0B74FF]" />,
    bg: "bg-blue-50",
    title: "Post a repair request",
    description:
      "Describe your home repair job, set a budget, and upload photos. Takes less than 2 minutes.",
  },
  {
    icon: <TrendingUp className="w-6 h-6 text-purple-600" />,
    bg: "bg-purple-50",
    title: "Receive competitive bids",
    description:
      "Local handymen send you their best price and estimated arrival time. Compare and choose freely.",
  },
  {
    icon: <ShieldCheck className="w-6 h-6 text-green-600" />,
    bg: "bg-green-50",
    title: "Hire trusted professionals",
    description:
      "Every handyman is background-checked and reviewed by real homeowners. Pay only when satisfied.",
  },
];

export default function FeatureSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F7F8FA]">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-[#0B74FF] uppercase tracking-wider mb-3">
            How it works
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#111827] mb-4">
            Get your home fixed in 3 steps
          </h2>
          <p className="text-[#6B7280] text-lg max-w-xl mx-auto">
            NeighborHelp makes home repairs simple, transparent, and stress-free.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-7 border border-[#E5E7EB] shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 group"
            >
              <div className={`w-12 h-12 ${feature.bg} rounded-xl flex items-center justify-center mb-5`}>
                {feature.icon}
              </div>
              <div className="flex items-start gap-2 mb-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#0B74FF] text-white text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <h3 className="text-lg font-semibold text-[#111827]">{feature.title}</h3>
              </div>
              <p className="text-[#6B7280] text-sm leading-relaxed pl-7">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
