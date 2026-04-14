"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/app/lib/context/ThemeContext";

interface ThemeToggleProps {
  compact?: boolean;
}

export default function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { toggleMode } = useTheme();

  const sizeClass = compact ? "w-9 h-9" : "w-10 h-10";

  return (
    <button
      type="button"
      onClick={toggleMode}
      aria-label="Toggle theme"
      title="Toggle theme"
      className={`${sizeClass} inline-flex items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#111827] hover:bg-[#F7F8FA] transition-colors`}
    >
      <Sun className="hidden dark:block w-4 h-4" />
      <Moon className="block dark:hidden w-4 h-4" />
    </button>
  );
}
