import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export type UserProfile = {
  uid: string;
  email?: string | null;
  role: "educator" | "trainer";
  createdAt: string;
};

export async function getUserProfile(uid: string) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function setUserRole(uid: string, role: "educator" | "trainer") {
  const ref = doc(db, "users", uid);
  const now = new Date().toISOString();
  await setDoc(
    ref,
    {
      uid,
      role,
      createdAt: now
    },
    { merge: true }
  );
}
