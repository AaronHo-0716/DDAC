import {
  Users,
  Briefcase,
  CheckCircle,
  Clock,
  ShieldCheck,
  Zap,
  Star,
} from "lucide-react";

// ─── Mock data — replace with admin API endpoints ────────────────────────────

const METRICS = [
  { label: "Active Users", value: "1,284", delta: "+12%", icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
  { label: "Open Jobs", value: "87", delta: "+5", icon: Briefcase, color: "text-amber-600", bg: "bg-amber-50" },
  { label: "Completed Jobs", value: "3,412", delta: "+23 today", icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
  { label: "Avg. Response Time", value: "38 min", delta: "-4 min", icon: Clock, color: "text-purple-600", bg: "bg-purple-50" },
];

const PENDING_HANDYMEN = [
  { id: "v1", name: "Ahmad Faris", email: "ahmad@example.com", category: "Plumbing", experience: "5 years", submittedAt: "2026-03-10T08:00:00Z" },
  { id: "v2", name: "Raj Kumar", email: "raj@example.com", category: "Electrical", experience: "8 years", submittedAt: "2026-03-10T11:30:00Z" },
  { id: "v3", name: "Lim Wei", email: "limwei@example.com", category: "Carpentry", experience: "3 years", submittedAt: "2026-03-11T09:15:00Z" },
];

const EMERGENCY_JOBS = [
  { id: "e1", title: "Gas leak suspected", location: "Cheras, KL", postedAt: "2026-03-11T06:45:00Z", bidCount: 0, category: "Plumbing" },
  { id: "e2", title: "Water heater sparking", location: "Bangsar, KL", postedAt: "2026-03-11T07:10:00Z", bidCount: 1, category: "Electrical" },
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function MetricCard({
  metric,
}: {
  metric: (typeof METRICS)[0];
}) {
  const Icon = metric.icon;
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 ${metric.bg} rounded-xl flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${metric.color}`} />
        </div>
        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
          {metric.delta}
        </span>
      </div>
      <p className="text-2xl font-bold text-[#111827]">{metric.value}</p>
      <p className="text-sm text-[#6B7280] mt-0.5">{metric.label}</p>
    </div>
  );
}

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-[#F7F8FA] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#111827]">Admin Panel</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Platform overview and moderation tools
          </p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {METRICS.map((m) => (
            <MetricCard key={m.label} metric={m} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending Handyman Verification */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-[#0B74FF]" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[#111827]">
                    Pending Verification
                  </h2>
                  <p className="text-xs text-[#6B7280]">
                    {PENDING_HANDYMEN.length} handymen awaiting review
                  </p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-[#F3F4F6]">
              {PENDING_HANDYMEN.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center gap-4 px-6 py-4"
                >
                  <div className="w-9 h-9 rounded-full bg-[#0B74FF] text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
                    {h.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#111827] truncate">
                      {h.name}
                    </p>
                    <p className="text-xs text-[#6B7280]">
                      {h.category} · {h.experience} · {timeAgo(h.submittedAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                      Reject
                    </button>
                    <button className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0B74FF] rounded-lg hover:bg-[#0056CC] transition-colors">
                      Approve
                    </button>
                  </div>
                </div>
              ))}
              {PENDING_HANDYMEN.length === 0 && (
                <div className="px-6 py-8 text-center text-sm text-[#6B7280]">
                  All verifications up to date ✓
                </div>
              )}
            </div>
          </div>

          {/* Emergency Job Queue */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                  <Zap className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[#111827]">
                    Emergency Job Queue
                  </h2>
                  <p className="text-xs text-[#6B7280]">
                    {EMERGENCY_JOBS.length} urgent jobs requiring attention
                  </p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-[#F3F4F6]">
              {EMERGENCY_JOBS.map((job) => (
                <div key={job.id} className="flex items-start gap-4 px-6 py-4">
                  <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center text-lg flex-shrink-0">
                    🚨
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#111827] truncate">
                      {job.title}
                    </p>
                    <p className="text-xs text-[#6B7280]">
                      {job.category} · {job.location} ·{" "}
                      {timeAgo(job.postedAt)}
                    </p>
                    <p className="text-xs mt-0.5">
                      {job.bidCount === 0 ? (
                        <span className="text-red-600 font-medium">
                          No bids yet — needs urgent assignment
                        </span>
                      ) : (
                        <span className="text-amber-600">
                          {job.bidCount} bid received
                        </span>
                      )}
                    </p>
                  </div>
                  <button className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-[#0B74FF] border border-[#0B74FF] rounded-lg hover:bg-blue-50 transition-colors">
                    Assign
                  </button>
                </div>
              ))}
              {EMERGENCY_JOBS.length === 0 && (
                <div className="px-6 py-8 text-center text-sm text-[#6B7280]">
                  No emergency jobs at the moment ✓
                </div>
              )}
            </div>
          </div>

          {/* Recent handymen ratings */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] lg:col-span-2">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-[#E5E7EB]">
              <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                <Star className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#111827]">
                  Top Rated Handymen
                </h2>
                <p className="text-xs text-[#6B7280]">
                  Platform-wide leaderboard this month
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide border-b border-[#F3F4F6]">
                    <th className="text-left px-6 py-3">Handyman</th>
                    <th className="text-left px-6 py-3">Category</th>
                    <th className="text-left px-6 py-3">Jobs Completed</th>
                    <th className="text-left px-6 py-3">Rating</th>
                    <th className="text-left px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {[
                    { name: "Mike Rahman", cat: "Plumbing", jobs: 142, rating: 4.9, verified: true },
                    { name: "David Lim", cat: "Electrical", jobs: 98, rating: 4.8, verified: true },
                    { name: "Amir Hassan", cat: "Carpentry", jobs: 76, rating: 4.7, verified: true },
                    { name: "Kevin Tan", cat: "Appliance Repair", jobs: 55, rating: 4.6, verified: false },
                  ].map((h, i) => (
                    <tr key={h.name} className="hover:bg-[#F7F8FA] transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-[#9CA3AF] w-4">
                            {i + 1}
                          </span>
                          <div className="w-8 h-8 rounded-full bg-[#0B74FF] text-white text-xs font-bold flex items-center justify-center">
                            {h.name.charAt(0)}
                          </div>
                          <span className="font-medium text-[#111827]">
                            {h.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-[#6B7280]">{h.cat}</td>
                      <td className="px-6 py-3 font-semibold text-[#111827]">
                        {h.jobs}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span className="font-semibold text-[#111827]">
                            {h.rating}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        {h.verified ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-0.5 rounded-full">
                            <CheckCircle className="w-3 h-3" /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
