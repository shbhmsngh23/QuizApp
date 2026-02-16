import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export async function createShareLink(quizId: string, password?: string) {
  const callable = httpsCallable(functions, "createShareLink");
  const result = await callable({ quizId, password });
  return result.data as { token: string };
}

export async function getSharedQuiz(token: string, password?: string) {
  const callable = httpsCallable(functions, "getSharedQuiz");
  const result = await callable({ token, password });
  return result.data as Record<string, unknown>;
}
