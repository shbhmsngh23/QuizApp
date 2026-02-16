"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getRecentQuizzes } from "@/lib/quizzes";
import { getUserEvents } from "@/lib/analytics";
import { AnalyticsPanel } from "./analytics";
import type { QuizSet } from "@shared/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = React.useState<QuizSet[]>([]);
  const [events, setEvents] = React.useState<{ [key: string]: number }>({});

  React.useEffect(() => {
    if (!user) return;
    getRecentQuizzes(user.uid).then(setQuizzes);
    getUserEvents(user.uid).then((data) => {
      const counts = data.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      setEvents(counts);
    });
  }, [user]);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Quizzes created</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">
              {events.quiz_generated ?? quizzes.length}
            </div>
            <p className="text-xs text-slate-500">Last 5 quiz sets</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Students reached</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">
              {events.share_view ?? 0}
            </div>
            <p className="text-xs text-slate-500">Share views (tracked)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Avg. completion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">82%</div>
            <p className="text-xs text-slate-500">Demo metric</p>
          </CardContent>
        </Card>
      </div>

      <AnalyticsPanel />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent activity</h2>
        <Button asChild>
          <Link href="/upload">Create new quiz</Link>
        </Button>
      </div>

      <div className="grid gap-4">
        {quizzes.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-sm text-slate-500">
              No quizzes yet. Upload content to generate your first set.
            </CardContent>
          </Card>
        ) : (
          quizzes.map((quiz) => (
            <Card key={quiz.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {quiz.title}
                  </div>
                  <div className="text-xs text-slate-500">
                    {quiz.questions.length} questions · {quiz.flashcards.length} flashcards
                  </div>
                </div>
                <Button asChild variant="outline">
                  <Link href={`/quizzes/${quiz.id}`}>Open</Link>
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
