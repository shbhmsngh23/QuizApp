"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getQuiz } from "@/lib/quizzes";
import { listQuizAttempts } from "@/lib/attempts";
import type { QuizSet } from "@shared/types";

type Attempt = {
  id: string;
  name: string;
  score: number;
  total: number;
  status: string;
  startedAtMs: number;
  completedAt: number | null;
  results: Array<{
    questionIndex: number;
    optionIndex: number;
    correctIndex: number;
    correct: boolean;
  }>;
};

export default function QuizAttemptsPage() {
  const params = useParams();
  const { user } = useAuth();
  const quizId = String(params.id);
  const [quiz, setQuiz] = React.useState<QuizSet | null>(null);
  const [attempts, setAttempts] = React.useState<Attempt[]>([]);
  const [selectedAttempt, setSelectedAttempt] = React.useState<Attempt | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([getQuiz(user.uid, quizId), listQuizAttempts(quizId)])
      .then(([quizData, attemptData]) => {
        setQuiz(quizData);
        const sorted = [...attemptData.attempts].sort((a, b) => {
          const aTime = a.completedAt ?? a.startedAtMs;
          const bTime = b.completedAt ?? b.startedAtMs;
          return bTime - aTime;
        });
        setAttempts(sorted);
        setSelectedAttempt(sorted[0] ?? null);
      })
      .finally(() => setLoading(false));
  }, [user, quizId]);

  if (loading || !quiz) {
    return <div className="text-sm text-slate-500">Loading attempts...</div>;
  }

  const completed = attempts.filter((attempt) => attempt.status === "completed");
  const totalAttempts = attempts.length;
  const completedCount = completed.length;
  const avgScore =
    completedCount === 0
      ? 0
      : Math.round(
          (completed.reduce((sum, attempt) => sum + attempt.score, 0) /
            completedCount) *
            10
        ) / 10;

  const questionStats = quiz.questions.map((question, index) => {
    let correct = 0;
    let total = 0;
    completed.forEach((attempt) => {
      const result = attempt.results.find((item) => item.questionIndex === index);
      if (!result) return;
      total += 1;
      if (result.correct) correct += 1;
    });
    const rate = total === 0 ? 0 : Math.round((correct / total) * 100);
    return { prompt: question.prompt, correct, total, rate, index };
  });

  const hardest = [...questionStats].sort((a, b) => a.rate - b.rate).slice(0, 5);

  const downloadCsv = () => {
    const headers = [
      "Attempt ID",
      "Name",
      "Score",
      "Total",
      "Completed At",
      ...quiz.questions.map((_, index) => `Q${index + 1} Correct`),
      ...quiz.questions.map((_, index) => `Q${index + 1} Answer`)
    ];

    const rows = attempts.map((attempt) => {
      const row: string[] = [
        attempt.id,
        attempt.name,
        String(attempt.score),
        String(attempt.total),
        attempt.completedAt ? new Date(attempt.completedAt).toISOString() : ""
      ];
      quiz.questions.forEach((_, index) => {
        const result = attempt.results.find((item) => item.questionIndex === index);
        row.push(result ? (result.correct ? "TRUE" : "FALSE") : "");
      });
      quiz.questions.forEach((_, index) => {
        const result = attempt.results.find((item) => item.questionIndex === index);
        row.push(
          typeof result?.optionIndex === "number" && result.optionIndex >= 0
            ? String(result.optionIndex + 1)
            : ""
        );
      });
      return row;
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${quiz.title}-attempts.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{quiz.title}</h2>
          <p className="text-xs text-slate-500">Student attempts & analytics</p>
        </div>
        <Button variant="outline" onClick={downloadCsv}>
          Export attempts CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total attempts</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totalAttempts}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Completion count</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {completedCount}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Average score</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{avgScore}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Per-question difficulty</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {questionStats.map((stat) => (
            <div key={stat.index} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium text-foreground">{stat.prompt}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>
                  {stat.correct}/{stat.total} correct
                </span>
                <span>{stat.rate}% correct</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-indigo-500"
                  style={{ width: `${stat.rate}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hardest questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {hardest.map((stat) => (
            <div
              key={stat.index}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
            >
              <span className="text-slate-700">{stat.prompt}</span>
              <span className="font-semibold text-rose-500">{stat.rate}%</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attempts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {attempts.length === 0 ? (
            <p className="text-xs text-slate-500">
              No attempts yet. Share the quiz to collect student results.
            </p>
          ) : (
            attempts.map((attempt) => (
              <button
                key={attempt.id}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                  selectedAttempt?.id === attempt.id
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-border bg-white"
                }`}
                onClick={() => setSelectedAttempt(attempt)}
              >
                <span className="font-medium text-slate-700">{attempt.name}</span>
                <span className="text-slate-500">
                  {attempt.score}/{attempt.total}
                </span>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      {selectedAttempt ? (
        <Card>
          <CardHeader>
            <CardTitle>Teacher review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-500">
              Reviewing attempt by {selectedAttempt.name} ·{" "}
              {selectedAttempt.score}/{selectedAttempt.total}
            </p>
            {quiz.questions.map((question, index) => {
              const result = selectedAttempt.results.find(
                (item) => item.questionIndex === index
              );
              return (
                <div key={index} className="rounded-xl border border-border p-4">
                  <p className="text-sm font-semibold text-foreground">
                    {index + 1}. {question.prompt}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    {question.options.map((option, optionIndex) => {
                      const isSelected = result?.optionIndex === optionIndex;
                      const isCorrect = result?.correctIndex === optionIndex;
                      return (
                        <li
                          key={option.id}
                          className={
                            isCorrect
                              ? "font-semibold text-emerald-600"
                              : isSelected
                                ? "font-semibold text-rose-500"
                                : ""
                          }
                        >
                          {isSelected ? "• " : "○ "} {option.text}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
