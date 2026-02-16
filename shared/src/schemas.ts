import { z } from "zod";

export const mcqOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  isCorrect: z.boolean(),
  explanation: z.string().optional()
});

export const mcqQuestionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  options: z.array(mcqOptionSchema).min(2),
  hint: z.string().optional(),
  topic: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional()
});

export const flashcardSchema = z.object({
  id: z.string(),
  term: z.string(),
  definition: z.string()
});

export const quizSetSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string(),
  sourceText: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  shareEnabled: z.boolean().optional(),
  sharePassword: z.string().optional(),
  shareToken: z.string().optional(),
  questions: z.array(mcqQuestionSchema).min(1),
  flashcards: z.array(flashcardSchema).min(1)
});

export type QuizSetPayload = z.infer<typeof quizSetSchema>;
