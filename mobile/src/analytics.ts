import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";

export async function getUserEvents(uid: string) {
  const ref = collection(db, "users", uid, "analytics");
  const snap = await getDocs(ref);
  return snap.docs.map((docItem) => docItem.data()) as Array<{
    type: string;
    metadata?: Record<string, unknown>;
  }>;
}
