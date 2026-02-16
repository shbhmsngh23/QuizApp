import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export async function generateQuiz(input: {
  title: string;
  content: string;
  difficulty: "easy" | "medium" | "hard";
  topic?: string;
  count?: number;
}) {
  const callable = httpsCallable(functions, "generateQuiz");
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
    }>;
    flashcards: Array<{ id: string; term: string; definition: string }>;
  };
}

export async function extractText(base64: string, mimeType: string) {
  const callable = httpsCallable(functions, "extractText");
  const result = await callable({ base64, mimeType });
  return result.data as { text: string };
}
