import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PrimaryButton from "../ui/PrimaryButton";

const stats = [
  { value: "10K+", label: "Homeowners" },
  { value: "500+", label: "Verified Handymen" },
  { value: "98%", label: "Satisfaction Rate" },
  { value: "<2hr", label: "Avg. Response Time" },
];

export default function CtaSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-[#0B1220]">
      <div className="max-w-7xl mx-auto">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
          {stats.map((stat, i) => (
            <div key={i} className="text-center">
              <p className="text-3xl sm:text-4xl font-bold text-[#0B74FF] dark:text-[#93C5FD] mb-1">
                {stat.value}
              </p>
              <p className="text-sm text-[#6B7280] dark:text-[#CBD5E1] font-medium">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* CTA banner */}
        <div className="bg-gradient-to-r from-[#0B74FF] to-[#1D4ED8] rounded-3xl p-10 sm:p-14 text-center relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4 pointer-events-none" />

          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to get your home fixed?
            </h2>
            <p className="text-blue-100 text-lg mb-8 max-w-lg mx-auto">
              Join thousands of homeowners who trust NeighbourHelp for fast, affordable, and professional repairs.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/create-job">
                <PrimaryButton size="lg" variant="secondary">
                  Post a Job for Free
                  <ArrowRight className="w-4 h-4" />
                </PrimaryButton>
              </Link>
              <Link href="/register">
                <button className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-base font-semibold text-white border border-white/40 rounded-xl hover:bg-white/10 transition-colors">
                  Join as a Handyman
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
