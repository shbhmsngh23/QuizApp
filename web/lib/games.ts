import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export type Game = {
  id?: string;
  hostId: string;
  createdAt?: string;
  status: "waiting" | "live" | "finished";
  currentQuestionIndex?: number;
  endsAt?: number;
  showAnswers?: boolean;
  answersLocked?: boolean;
  autoReveal?: boolean;
  questions?: Array<{
    prompt: string;
    options: Array<{ text: string; isCorrect: boolean }>;
  }>;
};

export type Participant = {
  id: string;
  name: string;
  score: number;
  lastAnsweredQuestionIndex?: number;
};

export async function createGame(hostId: string) {
  const ref = await addDoc(collection(db, "games"), {
    hostId,
    status: "waiting",
    createdAt: serverTimestamp()
  });
  return ref.id;
}

export async function updateGame(gameId: string, patch: Partial<Game>) {
  const ref = doc(db, "games", gameId);
  await updateDoc(ref, patch);
}

export function listenGame(gameId: string, callback: (game: Game | null) => void) {
  return onSnapshot(doc(db, "games", gameId), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback({ id: snap.id, ...(snap.data() as Game) });
  });
}

export async function joinGame(gameId: string, participant: Participant) {
  const ref = doc(db, "games", gameId, "participants", participant.id);
  await setDoc(ref, participant, { merge: true });
}

export async function resetScores(gameId: string) {
  const snap = await getDocs(collection(db, "games", gameId, "participants"));
  await Promise.all(
    snap.docs.map((docItem) =>
      updateDoc(docItem.ref, {
        score: 0,
        lastAnsweredQuestionIndex: -1
      })
    )
  );
}

export async function submitAnswer(
  gameId: string,
  questionIndex: number,
  optionIndex: number
) {
  const callable = httpsCallable(functions, "submitGameAnswer");
  const result = await callable({ gameId, questionIndex, optionIndex });
  return result.data as { correct: boolean; alreadyAnswered: boolean };
}

export async function recordAnswer(
  gameId: string,
  participantId: string,
  questionIndex: number
) {
  const ref = doc(db, "games", gameId, "participants", participantId);
  await updateDoc(ref, { lastAnsweredQuestionIndex: questionIndex });
}

export function listenParticipants(
  gameId: string,
  callback: (participants: Participant[]) => void
) {
  return onSnapshot(collection(db, "games", gameId, "participants"), (snap) => {
    callback(
      snap.docs.map((docItem) => {
        const data = docItem.data() as Participant;
        return { ...data, id: docItem.id };
      })
    );
  });
}
