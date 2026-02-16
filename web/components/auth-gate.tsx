"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-context";
import { getUserProfile } from "@/lib/users";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [checkingRole, setCheckingRole] = React.useState(true);

  React.useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/signin");
      return;
    }

    getUserProfile(user.uid)
      .then((profile) => {
        if (!profile) {
          router.replace("/onboarding");
          return;
        }
        setCheckingRole(false);
      })
      .catch(() => setCheckingRole(false));
  }, [loading, user, router]);

  if (loading || checkingRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-sm text-slate-500">
          Loading your workspace...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
