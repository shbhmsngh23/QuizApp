"use client";

import { AuthProvider } from "@/components/auth-context";

export default function OnboardingLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <AuthProvider>{children}</AuthProvider>;
}
