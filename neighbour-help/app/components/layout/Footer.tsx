import Link from "next/link";
import { Wrench } from "lucide-react";

const footerLinks = [
  { label: "About", href: "/about" },
  { label: "Support", href: "/support" },
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
];

export default function Footer() {
  return (
    <footer className="bg-white border-t border-[#E5E7EB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#0B74FF] rounded-lg flex items-center justify-center">
              <Wrench className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-base font-bold text-[#111827]">
              Neighbour<span className="text-[#0B74FF]">Help</span>
            </span>
          </Link>

          {/* Links */}
          <nav className="flex items-center gap-1 flex-wrap justify-center">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 text-sm text-[#6B7280] hover:text-[#111827] transition-colors rounded-md hover:bg-[#F7F8FA]"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Copyright */}
          <p className="text-sm text-[#6B7280]">
            © {new Date().getFullYear()} NeighbourHelp. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
