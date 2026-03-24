"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { UserRole } from "@/app/types";
import { useAuth } from "@/app/lib/context/AuthContext";

function getRoleHome(role: UserRole): string {
  if (role === "handyman") return "/handyman";
  if (role === "admin") return "/admin";
  return "/dashboard";
}

export function useRequireRole(allowedRoles: UserRole | UserRole[]) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
      return;
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (!roles.includes(user.role)) {
      router.replace(getRoleHome(user.role));
    }
  }, [allowedRoles, loading, pathname, router, user]);

  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const authorized = !loading && !!user && roles.includes(user.role);

  return { authorized, loading, user };
}
