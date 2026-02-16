import { httpsCallable } from "firebase/functions";
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp
} from "firebase/firestore";
import { db, functions } from "@/lib/firebase";

export async function logShareView(token: string) {
  const callable = httpsCallable(functions, "logShareView");
  await callable({ token });
}

export async function logUserEvent(uid: string, type: string, metadata?: any) {
  const ref = collection(db, "users", uid, "analytics");
  await addDoc(ref, {
    type,
    metadata: metadata ?? {},
    createdAt: serverTimestamp()
  });
}

export async function getUserEvents(uid: string) {
  const ref = collection(db, "users", uid, "analytics");
  const snap = await getDocs(query(ref));
  return snap.docs.map((docItem) => docItem.data()) as Array<{
    type: string;
    metadata: Record<string, unknown>;
  }>;
}
