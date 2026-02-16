"use client";

import * as React from "react";
import { useParams } from "next/navigation";

import { useAuth } from "@/components/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { QRCodeCanvas } from "qrcode.react";
import { createShareLink } from "@/lib/share";
import { logUserEvent } from "@/lib/analytics";
import { getQuiz, updateQuiz } from "@/lib/quizzes";
import type { QuizSet } from "@shared/types";

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export default function QuizDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const [quiz, setQuiz] = React.useState<QuizSet | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [origin, setOrigin] = React.useState("");
  const [shareToken, setShareToken] = React.useState<string | null>(null);
  const id = String(params.id);

  React.useEffect(() => {
    if (!user) return;
    getQuiz(user.uid, id).then((data) => {
      setQuiz(data);
      setShareToken(data?.shareToken ?? null);
    });
  }, [user, id]);

  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const handleSave = async () => {
    if (!user || !quiz) return;
    setSaving(true);
    let token = shareToken;
    if (quiz.shareEnabled && !token) {
      const result = await createShareLink(id, quiz.sharePassword);
      token = result.token;
      setShareToken(result.token);
      setQuiz({ ...quiz, shareToken: result.token });
      await logUserEvent(user.uid, "share_link_created", {
        quizId: id
      });
    }
    const { sharePassword: _sharePassword, ...quizToSave } = quiz;
    await updateQuiz(user.uid, id, {
      ...quizToSave,
      shareToken: token ?? quizToSave.shareToken
    });
    setSaving(false);
  };

  const handleExport = (
    format: "json" | "csv" | "pdf" | "moodle" | "google"
  ) => {
    if (!quiz) return;
    if (format === "json") {
      downloadFile(
        `${quiz.title}-quiz.json`,
        JSON.stringify(quiz, null, 2),
        "application/json"
      );
      return;
    }

    if (format === "csv" || format === "google") {
      const rows = quiz.questions.flatMap((question) =>
        question.options.map((option) => [
          question.prompt,
          option.text,
          option.isCorrect ? "TRUE" : "FALSE",
          option.explanation ?? ""
        ])
      );
      const csv = [
        [
          "Question",
          "Option",
          "Correct",
          format === "google" ? "Feedback" : "Explanation"
        ],
        ...rows
      ]
        .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const suffix = format === "google" ? "google-forms" : "quiz";
      downloadFile(`${quiz.title}-${suffix}.csv`, csv, "text/csv");
      return;
    }

    if (format === "moodle") {
      const items = quiz.questions
        .map((question) => {
          const answers = question.options
            .map((option) => {
              const fraction = option.isCorrect ? 100 : 0;
              return `\n      <answer fraction="${fraction}">\n        <text>${escapeXml(option.text)}</text>\n      </answer>`;
            })
            .join("");

          return `\n  <question type="multichoice">\n    <name><text>${escapeXml(
      question.prompt
    )}</text></name>\n    <questiontext format="html"><text>${escapeXml(
      question.prompt
    )}</text></questiontext>\n    <generalfeedback><text>${escapeXml(
      question.hint ?? ""
    )}</text></generalfeedback>\n    ${answers}\n  </question>`;
        })
        .join("");

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<quiz>${items}\n</quiz>`;
      downloadFile(`${quiz.title}-moodle.xml`, xml, "application/xml");
      return;
    }

    window.print();
  };

  const handleCopyLink = () => {
    if (!shareToken) return;
    const url = `${window.location.origin}/share/${shareToken}`;
    navigator.clipboard.writeText(url);
  };

  if (!quiz) {
    return <div className="text-sm text-slate-500">Loading quiz...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{quiz.title}</h2>
          <p className="text-xs text-slate-500">
            {quiz.questions.length} questions · {quiz.flashcards.length} flashcards
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => (window.location.href = `/quizzes/${id}/attempts`)}>
            View attempts
          </Button>
          <Button variant="outline" onClick={() => handleExport("csv")}>
            CSV
          </Button>
          <Button variant="outline" onClick={() => handleExport("google")}>
            Google Forms
          </Button>
          <Button variant="outline" onClick={() => handleExport("moodle")}>
            Moodle XML
          </Button>
          <Button variant="outline" onClick={() => handleExport("json")}>
            JSON
          </Button>
          <Button variant="outline" onClick={() => handleExport("pdf")}>
            PDF
          </Button>
          <Button variant="outline" onClick={handleCopyLink} disabled={!shareToken}>
            Copy share link
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sharing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable share link</p>
              <p className="text-xs text-slate-500">
                Anyone with the link can view the quiz.
              </p>
            </div>
            <Switch
              checked={quiz.shareEnabled ?? false}
              onCheckedChange={(checked) =>
                setQuiz({ ...quiz, shareEnabled: checked })
              }
            />
          </div>
          <Input
            placeholder="Optional password"
            value={quiz.sharePassword ?? ""}
            onChange={(event) =>
              setQuiz({ ...quiz, sharePassword: event.target.value })
            }
          />
          {quiz.shareEnabled ? (
            <div className="rounded-xl border border-dashed border-border p-4">
              <p className="text-xs text-slate-500">Share QR code</p>
              <div className="mt-3">
                {origin && shareToken ? (
                  <QRCodeCanvas value={`${origin}/share/${shareToken}`} size={128} />
                ) : (
                  <p className="text-xs text-slate-500">
                    Save to generate a share link.
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Multiple-choice questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {quiz.questions.map((question, index) => (
            <div key={question.id} className="rounded-xl border border-border p-4">
              <Input
                value={question.prompt}
                onChange={(event) => {
                  const next = [...quiz.questions];
                  next[index] = { ...question, prompt: event.target.value };
                  setQuiz({ ...quiz, questions: next });
                }}
              />
              <div className="mt-3 grid gap-2">
                {question.options.map((option, optionIndex) => (
                  <Input
                    key={option.id}
                    value={option.text}
                    onChange={(event) => {
                      const nextQuestions = [...quiz.questions];
                      const nextOptions = [...question.options];
                      nextOptions[optionIndex] = {
                        ...option,
                        text: event.target.value
                      };
                      nextQuestions[index] = { ...question, options: nextOptions };
                      setQuiz({ ...quiz, questions: nextQuestions });
                    }}
                  />
                ))}
              </div>
              <Textarea
                className="mt-3"
                value={question.hint ?? ""}
                onChange={(event) => {
                  const next = [...quiz.questions];
                  next[index] = { ...question, hint: event.target.value };
                  setQuiz({ ...quiz, questions: next });
                }}
                placeholder="Hint (optional)"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Flashcards</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {quiz.flashcards.map((card, index) => (
            <div key={card.id} className="rounded-xl border border-border p-4">
              <Input
                value={card.term}
                onChange={(event) => {
                  const next = [...quiz.flashcards];
                  next[index] = { ...card, term: event.target.value };
                  setQuiz({ ...quiz, flashcards: next });
                }}
              />
              <Textarea
                className="mt-2"
                value={card.definition}
                onChange={(event) => {
                  const next = [...quiz.flashcards];
                  next[index] = { ...card, definition: event.target.value };
                  setQuiz({ ...quiz, flashcards: next });
                }}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
