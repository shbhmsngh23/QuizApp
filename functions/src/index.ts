import { onCall, HttpsError } from "firebase-functions/v2/https";
import { randomUUID, createHash } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import OpenAI from "openai";
import pdf from "pdf-parse";
import mammoth from "mammoth";

initializeApp();
const db = getFirestore();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const generateSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(20),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  topic: z.string().optional(),
  count: z.number().min(5).max(30).default(10)
});

const quizSchema = z.object({
  questions: z.array(
    z.object({
      id: z.string().optional(),
      prompt: z.string(),
      options: z.array(
        z.object({
          id: z.string().optional(),
          text: z.string(),
          isCorrect: z.boolean(),
          explanation: z.string().optional()
        })
      ),
      hint: z.string().optional(),
      topic: z.string().optional(),
      difficulty: z.enum(["easy", "medium", "hard"]).optional()
    })
  ),
  flashcards: z.array(
    z.object({
      id: z.string().optional(),
      term: z.string(),
      definition: z.string()
    })
  )
});

export const generateQuiz = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const parsed = generateSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Invalid payload.");
  }

  const uid = request.auth.uid;
  const today = new Date().toISOString().slice(0, 10);
  const usageRef = db.doc(`usage/${uid}_${today}`);
  const usageSnap = await usageRef.get();
  const currentCount = usageSnap.exists ? (usageSnap.data()?.count ?? 0) : 0;
  const dailyLimit = 20;
  if (currentCount >= dailyLimit) {
    throw new HttpsError("resource-exhausted", "Daily quiz limit reached.", {
      dailyLimit,
      currentCount
    });
  }

  const { title, content, difficulty, topic, count } = parsed.data;
  const trimmedContent = content.slice(0, 12000);

  const system =
    "You are an expert instructional designer. Generate multiple-choice questions and flashcards. Return valid JSON only.";

  const user = `Title: ${title}\nTopic: ${topic ?? "General"}\nDifficulty: ${difficulty}\n\nContent:\n${trimmedContent}\n\nRequirements:\n- Create ${count} multiple-choice questions.\n- Each question has 4 options with exactly one correct answer.\n- Include a concise explanation for the correct answer.\n- Generate at least ${Math.max(6, Math.floor(count * 0.6))} flashcards.\n- JSON shape: { "questions": [...], "flashcards": [...] }`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  });

  const contentJson = completion.choices[0]?.message?.content ?? "{}";
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(contentJson);
  } catch (error) {
    throw new HttpsError("internal", "AI response was not valid JSON.");
  }

  const quiz = quizSchema.safeParse(parsedJson);
  if (!quiz.success) {
    throw new HttpsError("internal", "AI response did not match schema.");
  }

  const normalized = {
    questions: quiz.data.questions.map((question) => ({
      ...question,
      id: question.id ?? randomUUID(),
      options: question.options.map((option) => ({
        ...option,
        id: option.id ?? randomUUID()
      }))
    })),
    flashcards: quiz.data.flashcards.map((card) => ({
      ...card,
      id: card.id ?? randomUUID()
    }))
  };

  await usageRef.set(
    { count: currentCount + 1, date: today, uid },
    { merge: true }
  );

  return normalized;
});

const extractSchema = z.object({
  base64: z.string().min(20),
  mimeType: z.string().min(3)
});

export const extractText = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const parsed = extractSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Invalid payload.");
  }

  const { base64, mimeType } = parsed.data;
  const buffer = Buffer.from(base64, "base64");

  if (buffer.length > 3_000_000) {
    throw new HttpsError("invalid-argument", "File too large.");
  }

  if (mimeType === "application/pdf") {
    const data = await pdf(buffer);
    return { text: data.text };
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const data = await mammoth.extractRawText({ buffer });
    return { text: data.value };
  }

  if (mimeType.startsWith("text/")) {
    return { text: buffer.toString("utf8") };
  }

  throw new HttpsError("invalid-argument", "Unsupported file type.");
});

const createShareSchema = z.object({
  quizId: z.string().min(1),
  password: z.string().optional()
});

export const createShareLink = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const parsed = createShareSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Invalid payload.");
  }

  const { quizId, password } = parsed.data;
  const uid = request.auth.uid;
  const quizRef = db.doc(`users/${uid}/quizzes/${quizId}`);
  const quizSnap = await quizRef.get();

  if (!quizSnap.exists) {
    throw new HttpsError("not-found", "Quiz not found.");
  }

  const token = randomUUID();
  const passwordHash = password
    ? createHash("sha256").update(password).digest("hex")
    : null;

  await db.collection("shareLinks").doc(token).set({
    quizPath: quizRef.path,
    uid,
    passwordHash,
    createdAt: FieldValue.serverTimestamp()
  });

  await quizRef.set(
    {
      shareEnabled: true,
      shareToken: token
    },
    { merge: true }
  );

  return { token };
});

const getShareSchema = z.object({
  token: z.string().min(6),
  password: z.string().optional()
});

export const getSharedQuiz = onCall({ cors: true }, async (request) => {
  const parsed = getShareSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Invalid payload.");
  }

  const { token, password } = parsed.data;
  const shareSnap = await db.collection("shareLinks").doc(token).get();

  if (!shareSnap.exists) {
    throw new HttpsError("not-found", "Share link not found.");
  }

  const share = shareSnap.data() as {
    quizPath: string;
    uid?: string;
    passwordHash?: string | null;
  };

  if (share.passwordHash) {
    const provided = password ?? "";
    const providedHash = createHash("sha256").update(provided).digest("hex");
    if (providedHash !== share.passwordHash) {
      throw new HttpsError("permission-denied", "Invalid password.");
    }
  }

  const quizSnap = await db.doc(share.quizPath).get();
  if (!quizSnap.exists) {
    throw new HttpsError("not-found", "Quiz not found.");
  }

  return quizSnap.data();
});

const shareViewSchema = z.object({
  token: z.string().min(6)
});

export const logShareView = onCall({ cors: true }, async (request) => {
  const parsed = shareViewSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Invalid payload.");
  }

  const { token } = parsed.data;
  await db.collection("shareViews").add({
    token,
    createdAt: FieldValue.serverTimestamp()
  });
  return { ok: true };
});

const submitAnswerSchema = z.object({
  gameId: z.string().min(1),
  questionIndex: z.number().min(0),
  optionIndex: z.number().min(0)
});

const feedbackSchema = z.object({
  message: z.string().min(5).max(2000),
  platform: z.enum(["web", "mobile"]).optional(),
  appVersion: z.string().max(50).optional()
});

const attemptStartSchema = z.object({
  token: z.string().min(6),
  name: z.string().max(120).optional(),
  password: z.string().optional()
});

const attemptSubmitSchema = z.object({
  attemptId: z.string().min(6),
  answers: z.array(
    z.object({
      questionIndex: z.number().min(0),
      optionIndex: z.number().min(0)
    })
  )
});

const listAttemptsByTokenSchema = z.object({
  token: z.string().min(6),
  password: z.string().optional(),
  limit: z.number().min(1).max(200).optional()
});

const listQuizAttemptsSchema = z.object({
  quizId: z.string().min(1),
  limit: z.number().min(1).max(200).optional()
});

export const startQuizAttempt = onCall({ cors: true }, async (request) => {
  const parsed = attemptStartSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Invalid payload.");
  }

  const { token, name, password } = parsed.data;
  const shareSnap = await db.collection("shareLinks").doc(token).get();
  if (!shareSnap.exists) {
    throw new HttpsError("not-found", "Share link not found.");
  }

  const share = shareSnap.data() as {
    quizPath: string;
    uid?: string;
    passwordHash?: string | null;
  };
  if (share.passwordHash) {
    const provided = password ?? "";
    const providedHash = createHash("sha256").update(provided).digest("hex");
    if (providedHash !== share.passwordHash) {
      throw new HttpsError("permission-denied", "Invalid password.");
    }
  }

  const attemptRef = db.collection("quizAttempts").doc();
  const startedAtMs = Date.now();
  await attemptRef.set({
    token,
    quizPath: share.quizPath,
    ownerId: share.uid ?? null,
    name: name ?? null,
    status: "in_progress",
    startedAtMs,
    startedAt: FieldValue.serverTimestamp()
  });

  return { attemptId: attemptRef.id, startedAtMs };
});

export const submitQuizAttempt = onCall({ cors: true }, async (request) => {
  const parsed = attemptSubmitSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Invalid payload.");
  }

  const { attemptId, answers } = parsed.data;
  const attemptRef = db.doc(`quizAttempts/${attemptId}`);
  const attemptSnap = await attemptRef.get();
  if (!attemptSnap.exists) {
    throw new HttpsError("not-found", "Attempt not found.");
  }

  const attempt = attemptSnap.data() as {
    quizPath: string;
    status?: "in_progress" | "completed";
    score?: number;
    total?: number;
    results?: Array<{
      questionIndex: number;
      optionIndex: number;
      correctIndex: number;
      correct: boolean;
    }>;
  };

  if (attempt.status === "completed") {
    return {
      score: attempt.score ?? 0,
      total: attempt.total ?? 0,
      results: attempt.results ?? []
    };
  }

  const quizSnap = await db.doc(attempt.quizPath).get();
  if (!quizSnap.exists) {
    throw new HttpsError("not-found", "Quiz not found.");
  }

  const quiz = quizSnap.data() as {
    questions?: Array<{ options: Array<{ isCorrect: boolean }> }>;
  };
  const questions = quiz.questions ?? [];
  const answerMap = new Map(
    answers.map((answer) => [answer.questionIndex, answer.optionIndex])
  );

  let score = 0;
  const results = questions.map((question, questionIndex) => {
    const correctIndex = question.options.findIndex((option) => option.isCorrect);
    const optionIndex = answerMap.get(questionIndex) ?? -1;
    const correct = optionIndex === correctIndex;
    if (correct) score += 1;
    return {
      questionIndex,
      optionIndex,
      correctIndex,
      correct
    };
  });

  await attemptRef.set(
    {
      status: "completed",
      score,
      total: questions.length,
      results,
      answers,
      completedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return { score, total: questions.length, results };
});

export const listAttemptsByToken = onCall({ cors: true }, async (request) => {
  const parsed = listAttemptsByTokenSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Invalid payload.");
  }

  const { token, password, limit } = parsed.data;
  const shareSnap = await db.collection("shareLinks").doc(token).get();
  if (!shareSnap.exists) {
    throw new HttpsError("not-found", "Share link not found.");
  }

  const share = shareSnap.data() as {
    passwordHash?: string | null;
  };
  if (share.passwordHash) {
    const provided = password ?? "";
    const providedHash = createHash("sha256").update(provided).digest("hex");
    if (providedHash !== share.passwordHash) {
      throw new HttpsError("permission-denied", "Invalid password.");
    }
  }

  const attemptSnap = await db
    .collection("quizAttempts")
    .where("token", "==", token)
    .limit(limit ?? 200)
    .get();

  const attempts = attemptSnap.docs.map((docItem) => {
    const data = docItem.data() as {
      name?: string | null;
      score?: number;
      total?: number;
      status?: string;
      startedAtMs?: number;
      completedAt?: FirebaseFirestore.Timestamp;
    };
    return {
      id: docItem.id,
      name: data.name ?? "Anonymous",
      score: data.score ?? 0,
      total: data.total ?? 0,
      status: data.status ?? "in_progress",
      startedAtMs: data.startedAtMs ?? 0,
      completedAt: data.completedAt?.toMillis?.() ?? null
    };
  });

  return { attempts };
});

export const listQuizAttempts = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const parsed = listQuizAttemptsSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Invalid payload.");
  }

  const { quizId, limit } = parsed.data;
  const uid = request.auth.uid;
  const quizPath = `users/${uid}/quizzes/${quizId}`;

  const attemptSnap = await db
    .collection("quizAttempts")
    .where("quizPath", "==", quizPath)
    .limit(limit ?? 200)
    .get();

  const attempts = attemptSnap.docs.map((docItem) => {
    const data = docItem.data() as {
      name?: string | null;
      score?: number;
      total?: number;
      status?: string;
      startedAtMs?: number;
      completedAt?: FirebaseFirestore.Timestamp;
      results?: Array<{
        questionIndex: number;
        optionIndex: number;
        correctIndex: number;
        correct: boolean;
      }>;
    };
    return {
      id: docItem.id,
      name: data.name ?? "Anonymous",
      score: data.score ?? 0,
      total: data.total ?? 0,
      status: data.status ?? "in_progress",
      startedAtMs: data.startedAtMs ?? 0,
      completedAt: data.completedAt?.toMillis?.() ?? null,
      results: data.results ?? []
    };
  });

  return { attempts };
});

export const submitFeedback = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const parsed = feedbackSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Invalid feedback payload.");
  }

  const uid = request.auth.uid;
  const cooldownRef = db.doc(`feedbackCooldown/${uid}`);
  const now = Date.now();
  const cooldownMs = 5 * 60 * 1000;

  await db.runTransaction(async (tx) => {
    const cooldownSnap = await tx.get(cooldownRef);
    const lastSubmittedAt = cooldownSnap.exists
      ? (cooldownSnap.data()?.lastSubmittedAt as number | undefined)
      : undefined;
    if (lastSubmittedAt && now - lastSubmittedAt < cooldownMs) {
      const retryAfterSeconds = Math.ceil(
        (cooldownMs - (now - lastSubmittedAt)) / 1000
      );
      throw new HttpsError("resource-exhausted", "Feedback rate limit.", {
        retryAfterSeconds
      });
    }

    tx.set(cooldownRef, { lastSubmittedAt: now }, { merge: true });
    const feedbackRef = db.collection("feedback").doc();
    tx.set(feedbackRef, {
      userId: uid,
      message: parsed.data.message,
      platform: parsed.data.platform ?? "web",
      appVersion: parsed.data.appVersion ?? null,
      createdAt: FieldValue.serverTimestamp()
    });
  });

  return { ok: true, cooldownSeconds: Math.ceil(cooldownMs / 1000) };
});

export const submitGameAnswer = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const parsed = submitAnswerSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Invalid payload.");
  }

  const { gameId, questionIndex, optionIndex } = parsed.data;
  const uid = request.auth.uid;

  const gameRef = db.doc(`games/${gameId}`);
  const gameSnap = await gameRef.get();
  if (!gameSnap.exists) {
    throw new HttpsError("not-found", "Game not found.");
  }

  const game = gameSnap.data() as {
    status?: "waiting" | "live" | "finished";
    endsAt?: number;
    answersLocked?: boolean;
    questions?: Array<{ options: Array<{ isCorrect: boolean }> }>;
  };
  if (game.status !== "live") {
    throw new HttpsError("failed-precondition", "Answers are closed.");
  }
  if (game.answersLocked) {
    throw new HttpsError("failed-precondition", "Answers are closed.");
  }
  if (game.endsAt && Date.now() >= game.endsAt) {
    throw new HttpsError("failed-precondition", "Answers are closed.");
  }
  const question = game.questions?.[questionIndex];
  if (!question) {
    throw new HttpsError("invalid-argument", "Question not found.");
  }
  const option = question.options?.[optionIndex];
  if (!option) {
    throw new HttpsError("invalid-argument", "Option not found.");
  }

  const participantRef = db.doc(`games/${gameId}/participants/${uid}`);
  const participantSnap = await participantRef.get();
  if (participantSnap.exists) {
    const participant = participantSnap.data() as {
      lastAnsweredQuestionIndex?: number;
    };
    if (participant.lastAnsweredQuestionIndex === questionIndex) {
      return { correct: option.isCorrect, alreadyAnswered: true };
    }
  }

  await participantRef.set(
    {
      lastAnsweredQuestionIndex: questionIndex,
      score: option.isCorrect ? FieldValue.increment(1) : FieldValue.increment(0)
    },
    { merge: true }
  );

  return { correct: option.isCorrect, alreadyAnswered: false };
});
