"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth-context";
import { setUserRole } from "@/lib/users";

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [role, setRole] = React.useState<"educator" | "trainer" | null>(null);

  React.useEffect(() => {
    if (!user) {
      router.replace("/signin");
    }
  }, [user, router]);

  const handleContinue = async () => {
    if (!user || !role) return;
    await setUserRole(user.uid, role);
    router.replace("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Tell us about your role</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <button
            className={`w-full rounded-xl border p-4 text-left text-sm transition ${
              role === "educator" ? "border-primary bg-indigo-50" : "border-border"
            }`}
            onClick={() => setRole("educator")}
          >
            <div className="font-semibold">Educator</div>
            <p className="text-xs text-slate-500">
              Create quizzes and flashcards for students or classes.
            </p>
          </button>
          <button
            className={`w-full rounded-xl border p-4 text-left text-sm transition ${
              role === "trainer" ? "border-primary bg-indigo-50" : "border-border"
            }`}
            onClick={() => setRole("trainer")}
          >
            <div className="font-semibold">Trainer</div>
            <p className="text-xs text-slate-500">
              Build learning modules for teams or corporate training.
            </p>
          </button>
          <Button className="w-full" onClick={handleContinue} disabled={!role}>
            Continue
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
