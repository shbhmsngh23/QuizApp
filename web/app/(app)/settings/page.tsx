"use client";

import { useAuth } from "@/components/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { FontToggle } from "@/components/font-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import * as React from "react";
import { submitFeedback } from "@/lib/feedback";

export default function SettingsPage() {
  const { user } = useAuth();
  const [feedback, setFeedback] = React.useState("");
  const [status, setStatus] = React.useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = React.useState<number | null>(null);
  const cooldownMs = 5 * 60 * 1000;

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("feedbackCooldownUntil");
    if (stored) {
      const parsed = Number(stored);
      if (!Number.isNaN(parsed)) {
        setCooldownUntil(parsed);
      }
    }
  }, []);

  React.useEffect(() => {
    if (!cooldownUntil) return;
    const timer = setInterval(() => {
      if (Date.now() >= cooldownUntil) {
        setCooldownUntil(null);
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("feedbackCooldownUntil");
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownUntil]);

  const remainingSeconds = cooldownUntil
    ? Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000))
    : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input value={user?.email ?? ""} readOnly />
          <div className="flex flex-col gap-3">
            <ThemeToggle />
            <FontToggle />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feedback</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Share ideas or report an issue..."
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
          />
          {status ? (
            <p className="text-xs text-slate-500">{status}</p>
          ) : null}
          {cooldownUntil ? (
            <p className="text-xs text-amber-600">
              Please wait {remainingSeconds}s before sending more feedback.
            </p>
          ) : null}
          <Button
            variant="outline"
            disabled={!feedback.trim() || !!cooldownUntil}
            onClick={async () => {
              if (cooldownUntil) return;
              setStatus("Sending feedback...");
              try {
                const result = await submitFeedback({
                  message: feedback.trim(),
                  platform: "web"
                });
                const nextCooldown =
                  Date.now() + (result.cooldownSeconds ?? cooldownMs / 1000) * 1000;
                setCooldownUntil(nextCooldown);
                if (typeof window !== "undefined") {
                  window.localStorage.setItem(
                    "feedbackCooldownUntil",
                    String(nextCooldown)
                  );
                }
                setFeedback("");
                setStatus("Thanks for the feedback! We'll review it shortly.");
              } catch (error: any) {
                const retryAfter =
                  error?.details?.retryAfterSeconds ??
                  error?.data?.retryAfterSeconds;
                if (error?.code === "functions/resource-exhausted" && retryAfter) {
                  const nextCooldown = Date.now() + retryAfter * 1000;
                  setCooldownUntil(nextCooldown);
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem(
                      "feedbackCooldownUntil",
                      String(nextCooldown)
                    );
                  }
                  setStatus("You're sending feedback too fast. Please wait.");
                  return;
                }
                setStatus("Could not send feedback. Please try again.");
              }
            }}
          >
            Send feedback
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
