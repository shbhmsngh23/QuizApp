"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth-context";
import { generateQuiz, extractText } from "@/lib/ai";
import { saveQuiz } from "@/lib/quizzes";
import { logUserEvent } from "@/lib/analytics";
import type { QuizSet } from "@shared/types";

const difficultyOptions = ["easy", "medium", "hard"] as const;

export default function UploadPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = React.useState("");
  const [topic, setTopic] = React.useState("");
  const [difficulty, setDifficulty] = React.useState<
    "easy" | "medium" | "hard"
  >("medium");
  const [content, setContent] = React.useState("");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);

  const onDrop = React.useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setFileName(file.name);
    setStatus("Extracting text...");

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const result = await extractText(base64, file.type);
        setContent(result.text.trim());
        setStatus("Text extracted. You can edit before generating.");
      } catch (error) {
        setStatus("Could not extract text. Paste content manually.");
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
        ".docx"
      ],
      "text/plain": [".txt"]
    }
  });

  const handleGenerate = async () => {
    if (!user) return;
    setLoading(true);
    setStatus("Generating quiz and flashcards...");
    try {
      const aiResult = await generateQuiz({
        title: title || "Untitled Quiz",
        content,
        difficulty,
        topic,
        count: 10
      });

      const quiz: QuizSet = {
        id: crypto.randomUUID(),
        title: title || "Untitled Quiz",
        createdAt: new Date().toISOString(),
        sourceText: content,
        difficulty,
        questions: aiResult.questions,
        flashcards: aiResult.flashcards
      };

      const docId = await saveQuiz(user.uid, quiz);
      await logUserEvent(user.uid, "quiz_generated", {
        questionCount: quiz.questions.length,
        flashcardCount: quiz.flashcards.length
      });
      setStatus("Quiz saved! Redirecting...");
      router.push(`/quizzes/${docId}`);
    } catch (error: any) {
      setStatus(error?.message ?? "Generation failed. Try again with shorter text.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>Upload content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            {...getRootProps()}
            className={`rounded-2xl border border-dashed p-6 text-center text-sm transition ${
              isDragActive ? "border-primary bg-indigo-50" : "border-border"
            }`}
          >
            <input {...getInputProps()} />
            <p className="font-medium text-slate-700">
              Drag & drop a PDF, DOCX, or TXT
            </p>
            <p className="text-xs text-slate-500">or click to upload</p>
            {fileName ? (
              <Badge variant="secondary" className="mt-3">
                {fileName}
              </Badge>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Quiz title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <Input
              placeholder="Topic (optional)"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
            />
          </div>

          <div className="flex gap-2">
            {difficultyOptions.map((option) => (
              <Button
                key={option}
                variant={difficulty === option ? "default" : "outline"}
                onClick={() => setDifficulty(option)}
              >
                {option}
              </Button>
            ))}
          </div>

          <Textarea
            placeholder="Paste or edit your content here..."
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />

          <Button
            size="lg"
            onClick={handleGenerate}
            disabled={!content || loading}
          >
            {loading ? "Generating..." : "Generate quiz"}
          </Button>
          {status ? <p className="text-xs text-slate-500">{status}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[480px] overflow-y-auto text-sm text-slate-600">
            {content ? content : "Upload or paste content to preview it here."}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
