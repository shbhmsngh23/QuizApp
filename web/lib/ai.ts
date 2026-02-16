import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import type { QuizDifficulty } from "@shared/types";

export type GenerateQuizInput = {
  title: string;
  content: string;
  difficulty: "easy" | "medium" | "hard";
  topic?: string;
  count?: number;
};

export async function generateQuiz(input: GenerateQuizInput) {
  const callable = httpsCallable(functions, "generateQuiz");
  try {
    const result = await callable(input);
    return result.data as {
    questions: Array<{
      id: string;
      prompt: string;
      options: Array<{
        id: string;
        text: string;
        isCorrect: boolean;
        explanation?: string;
      }>;
      hint?: string;
      topic?: string;
      difficulty?: QuizDifficulty;
    }>;
    flashcards: Array<{ id: string; term: string; definition: string }>;
    };
  } catch (error: any) {
    if (error?.code === "resource-exhausted") {
      throw new Error(
        `Daily limit reached (${error?.details?.currentCount ?? 0}/${error?.details?.dailyLimit ?? 20}).`
      );
    }
    throw error;
  }
}

export async function extractText(base64: string, mimeType: string) {
  const callable = httpsCallable(functions, "extractText");
  const result = await callable({ base64, mimeType });
  return result.data as { text: string };
}
