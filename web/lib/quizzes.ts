import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc
} from "firebase/firestore";

import type { QuizSet } from "@shared/types";

export async function saveQuiz(uid: string, quiz: QuizSet) {
  const ref = collection(db, "users", uid, "quizzes");
  const docRef = await addDoc(ref, quiz);
  return docRef.id;
}

export async function updateQuiz(uid: string, id: string, patch: Partial<QuizSet>) {
  const ref = doc(db, "users", uid, "quizzes", id);
  await updateDoc(ref, patch);
}

export async function getQuiz(uid: string, id: string) {
  const ref = doc(db, "users", uid, "quizzes", id);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as QuizSet) : null;
}

export async function getRecentQuizzes(uid: string) {
  const ref = collection(db, "users", uid, "quizzes");
  const q = query(ref, orderBy("createdAt", "desc"), limit(5));
  const snap = await getDocs(q);
  return snap.docs.map((docItem) => {
    const data = docItem.data() as QuizSet;
    return { ...data, id: docItem.id };
  });
}
