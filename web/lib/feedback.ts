import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export type FeedbackPayload = {
  message: string;
  platform?: "web" | "mobile";
  appVersion?: string;
};

export async function submitFeedback(payload: FeedbackPayload) {
  const callable = httpsCallable(functions, "submitFeedback");
  const result = await callable(payload);
  return result.data as { ok: boolean; cooldownSeconds?: number };
}
