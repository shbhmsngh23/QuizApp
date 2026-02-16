import {
  addDoc,
  collection,
  doc,
  getDocs,
  deleteDoc,
  limit,
  orderBy,
  query,
  updateDoc
} from "firebase/firestore";
import { db } from "./firebase";

export async function saveQuiz(uid: string, quiz: any) {
  const ref = collection(db, "users", uid, "quizzes");
  const docRef = await addDoc(ref, quiz);
  return docRef.id;
}

export async function getLatestQuiz(uid: string) {
  const ref = collection(db, "users", uid, "quizzes");
  const q = query(ref, orderBy("createdAt", "desc"), limit(1));
  const snap = await getDocs(q);
  const docItem = snap.docs[0];
  if (!docItem) return null;
  return { ...docItem.data(), id: docItem.id } as any;
}

export async function getRecentQuizzes(uid: string) {
  const ref = collection(db, "users", uid, "quizzes");
  const q = query(ref, orderBy("createdAt", "desc"), limit(5));
  const snap = await getDocs(q);
  return snap.docs.map((docItem) => ({ ...docItem.data(), id: docItem.id })) as any[];
}

export async function updateQuiz(uid: string, id: string, patch: any) {
  const ref = doc(db, "users", uid, "quizzes", id);
  await updateDoc(ref, patch);
}

export async function deleteQuiz(uid: string, id: string) {
  const ref = doc(db, "users", uid, "quizzes", id);
  await deleteDoc(ref);
}
