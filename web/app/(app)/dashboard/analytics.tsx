"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth-context";
import { getUserEvents } from "@/lib/analytics";

export function AnalyticsPanel() {
  const { user } = useAuth();
  const [counts, setCounts] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    if (!user) return;
    getUserEvents(user.uid).then((events) => {
      const next = events.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      setCounts(next);
    });
  }, [user]);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {["quiz_generated", "share_link_created", "game_started"].map((key) => (
        <Card key={key}>
          <CardHeader>
            <CardTitle>
              {key === "quiz_generated"
                ? "Quizzes generated"
                : key === "share_link_created"
                  ? "Share links created"
                  : "Games started"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">
              {counts[key] ?? 0}
            </div>
            <p className="text-xs text-slate-500">Tracked events</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
