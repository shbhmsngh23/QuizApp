import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export type StartAttemptPayload = {
  token: string;
  name?: string;
  password?: string;
};

export type AttemptAnswer = {
  questionIndex: number;
  optionIndex: number;
};

export async function startQuizAttempt(payload: StartAttemptPayload) {
  const callable = httpsCallable(functions, "startQuizAttempt");
  const result = await callable(payload);
  return result.data as { attemptId: string; startedAtMs?: number };
}

export async function submitQuizAttempt(attemptId: string, answers: AttemptAnswer[]) {
  const callable = httpsCallable(functions, "submitQuizAttempt");
  const result = await callable({ attemptId, answers });
  return result.data as {
    score: number;
    total: number;
    results: Array<{
      questionIndex: number;
      optionIndex: number;
      correctIndex: number;
      correct: boolean;
    }>;
  };
}

export async function listAttemptsByToken(
  token: string,
  password?: string,
  limit = 200
) {
  const callable = httpsCallable(functions, "listAttemptsByToken");
  const result = await callable({ token, password, limit });
  return result.data as {
    attempts: Array<{
      id: string;
      name: string;
      score: number;
      total: number;
      status: string;
      startedAtMs: number;
      completedAt: number | null;
    }>;
  };
}

export async function listQuizAttempts(quizId: string, limit = 200) {
  const callable = httpsCallable(functions, "listQuizAttempts");
  const result = await callable({ quizId, limit });
  return result.data as {
    attempts: Array<{
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
    }>;
  };
}
