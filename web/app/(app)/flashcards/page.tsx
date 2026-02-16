"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/components/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRecentQuizzes } from "@/lib/quizzes";
import type { Flashcard, QuizSet } from "@shared/types";

export default function FlashcardsPage() {
  const { user } = useAuth();
  const [quiz, setQuiz] = React.useState<QuizSet | null>(null);
  const [index, setIndex] = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);
  const [isSpeaking, setIsSpeaking] = React.useState(false);

  const speechSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  React.useEffect(() => {
    if (!user) return;
    getRecentQuizzes(user.uid).then((items) => {
      setQuiz(items[0] ?? null);
      setIndex(0);
      setFlipped(false);
    });
  }, [user]);

  const cards: Flashcard[] = quiz?.flashcards ?? [];
  const card = cards[index];

  const nextCard = () => {
    setIndex((prev) => (prev + 1) % cards.length);
    setFlipped(false);
  };

  const stopSpeech = React.useCallback(() => {
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [speechSupported]);

  const speakCard = React.useCallback(
    (text: string) => {
      if (!speechSupported) return;
      stopSpeech();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [speechSupported, stopSpeech]
  );

  React.useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, [stopSpeech]);

  if (!quiz || cards.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-slate-500">
          Generate a quiz first to view flashcards.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{quiz.title} · Flashcards</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          <motion.div
            className="relative h-56 w-full max-w-xl cursor-pointer"
            onClick={() => setFlipped(!flipped)}
            initial={false}
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ duration: 0.6 }}
            style={{ transformStyle: "preserve-3d" }}
          >
            <div
              className="absolute inset-0 flex items-center justify-center rounded-2xl border border-border bg-white text-lg font-semibold"
              style={{ backfaceVisibility: "hidden" }}
            >
              {card.term}
            </div>
            <div
              className="absolute inset-0 flex items-center justify-center rounded-2xl border border-border bg-indigo-50 text-sm text-slate-700"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              {card.definition}
            </div>
          </motion.div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setFlipped(!flipped)}>
              Flip
            </Button>
            <Button
              variant="outline"
              disabled={!speechSupported}
              onClick={() => {
                if (isSpeaking) {
                  stopSpeech();
                  return;
                }
                speakCard(flipped ? card.definition : card.term);
              }}
            >
              {isSpeaking ? "Stop audio" : "Listen"}
            </Button>
            <Button onClick={nextCard}>Next card</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
