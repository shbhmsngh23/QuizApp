"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { getSharedQuiz } from "@/lib/share";
import { startQuizAttempt, submitQuizAttempt, type AttemptAnswer } from "@/lib/attempts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Result = {
  score: number;
  total: number;
  results: Array<{
    questionIndex: number;
    optionIndex: number;
    correctIndex: number;
    correct: boolean;
  }>;
};

export default function AttemptQuizPage() {
  const params = useParams();
  const token = String(params.token);
  const [quiz, setQuiz] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [attemptId, setAttemptId] = React.useState<string | null>(null);
  const [startedAtMs, setStartedAtMs] = React.useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<AttemptAnswer[]>([]);
  const [result, setResult] = React.useState<Result | null>(null);
  const timeLimitSec = 15 * 60;
  const [timeLeft, setTimeLeft] = React.useState(timeLimitSec);
  const autoSubmittedRef = React.useRef(false);

  const fetchQuiz = React.useCallback(
    async (providedPassword?: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await getSharedQuiz(token, providedPassword);
        setQuiz(data);
      } catch (err) {
        setError("Password required or link invalid.");
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  React.useEffect(() => {
    fetchQuiz();
  }, [fetchQuiz]);

  const totalQuestions = quiz?.questions?.length ?? 0;
  const currentQuestion = quiz?.questions?.[currentIndex];

  const selectAnswer = (questionIndex: number, optionIndex: number) => {
    setAnswers((prev) => {
      const next = prev.filter((item) => item.questionIndex !== questionIndex);
      next.push({ questionIndex, optionIndex });
      return next;
    });
  };

  const getSelected = (questionIndex: number) =>
    answers.find((item) => item.questionIndex === questionIndex)?.optionIndex ?? -1;

  React.useEffect(() => {
    if (!attemptId || !startedAtMs || result) return;
    const timer = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startedAtMs) / 1000);
      const remaining = Math.max(0, timeLimitSec - elapsedSec);
      setTimeLeft(remaining);
      if (remaining <= 0 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        clearInterval(timer);
        submitQuizAttempt(attemptId, answers).then(setResult).catch(() => undefined);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [attemptId, startedAtMs, result, timeLimitSec, answers]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-slate-500">Loading quiz attempt...</p>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Protected quiz</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-500">
              This quiz is password protected. Enter the access code to continue.
            </p>
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {error ? <p className="text-xs text-red-500">{error}</p> : null}
            <Button onClick={() => fetchQuiz(password)} className="w-full">
              Unlock
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen bg-background px-6 py-12">
        <div className="mx-auto max-w-3xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quiz results</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-foreground">
                {result.score} / {result.total}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Thanks for completing the quiz! Review your answers below.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Answer review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {quiz.questions?.map((question: any, index: number) => {
                const summary = result.results.find(
                  (item) => item.questionIndex === index
                );
                return (
                  <div key={index} className="rounded-xl border border-border p-4">
                    <p className="text-sm font-semibold text-foreground">
                      {index + 1}. {question.prompt}
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-slate-600">
                      {question.options?.map((option: any, optionIndex: number) => {
                        const isSelected = summary?.optionIndex === optionIndex;
                        const isCorrect = summary?.correctIndex === optionIndex;
                        return (
                          <li
                            key={optionIndex}
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
        </div>
      </div>
    );
  }

  if (!attemptId) {
    return (
      <div className="min-h-screen bg-background px-6 py-12">
        <div className="mx-auto max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{quiz.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-500">
                You are about to attempt a quiz with {totalQuestions} questions.
                You will have {Math.floor(timeLimitSec / 60)} minutes to finish.
              </p>
              <Input
                placeholder="Your name (optional)"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              {error ? <p className="text-xs text-red-500">{error}</p> : null}
              <Button
                onClick={async () => {
                  setError(null);
                  try {
                    const response = await startQuizAttempt({
                      token,
                      name: name.trim() || undefined,
                      password: password || undefined
                    });
                    setAttemptId(response.attemptId);
                    setStartedAtMs(response.startedAtMs ?? Date.now());
                    autoSubmittedRef.current = false;
                    setCurrentIndex(0);
                    setAnswers([]);
                    setTimeLeft(timeLimitSec);
                  } catch (err: any) {
                    if (err?.code === "functions/permission-denied") {
                      setError("Password required or invalid.");
                    } else {
                      setError("Unable to start attempt. Please try again.");
                    }
                  }
                }}
              >
                Start attempt
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              Question {currentIndex + 1} of {totalQuestions}
            </CardTitle>
            <p className="text-xs text-slate-500">
              Time left: {Math.floor(timeLeft / 60)
                .toString()
                .padStart(2, "0")}
              :{(timeLeft % 60).toString().padStart(2, "0")}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-base font-semibold text-foreground">
              {currentQuestion?.prompt}
            </p>
            <div className="space-y-2">
              {currentQuestion?.options?.map((option: any, optionIndex: number) => (
                <button
                  key={optionIndex}
                  disabled={timeLeft <= 0}
                  onClick={() => selectAnswer(currentIndex, optionIndex)}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-sm ${
                    getSelected(currentIndex) === optionIndex
                      ? "border-indigo-500 bg-indigo-50 font-semibold text-indigo-700"
                      : "border-border bg-white text-slate-700"
                  }`}
                >
                  {option.text}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              >
                Previous
              </Button>
              {currentIndex < totalQuestions - 1 ? (
                <Button
                  disabled={getSelected(currentIndex) === -1 || timeLeft <= 0}
                  onClick={() => setCurrentIndex((prev) => prev + 1)}
                >
                  Next
                </Button>
              ) : (
                <Button
                  disabled={getSelected(currentIndex) === -1 || timeLeft <= 0}
                  onClick={async () => {
                    if (!attemptId) return;
                    autoSubmittedRef.current = true;
                    const response = await submitQuizAttempt(attemptId, answers);
                    setResult(response);
                  }}
                >
                  Submit quiz
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
