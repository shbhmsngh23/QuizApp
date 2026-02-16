"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth-context";
import {
  createGame,
  joinGame,
  listenGame,
  listenParticipants,
  recordAnswer,
  submitAnswer,
  updateGame
} from "@/lib/games";
import { getRecentQuizzes } from "@/lib/quizzes";
import { logUserEvent } from "@/lib/analytics";

export default function GamePage() {
  const { user } = useAuth();
  const [gameId, setGameId] = React.useState<string | null>(null);
  const [roomCode, setRoomCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [isLive, setIsLive] = React.useState(false);
  const [timeLeft, setTimeLeft] = React.useState(30);
  const participantId = user?.uid ?? "";
  const [game, setGame] = React.useState<any>(null);
  const [availableQuizzes, setAvailableQuizzes] = React.useState<any[]>([]);
  const [selectedQuizId, setSelectedQuizId] = React.useState<string | null>(null);
  const [answerFeedback, setAnswerFeedback] = React.useState<{
    [key: number]: { optionIndex: number; correct: boolean };
  }>({});
  const [answerStatus, setAnswerStatus] = React.useState<string | null>(null);
  const autoCloseRef = React.useRef(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    if (room) {
      setRoomCode(room);
      setGameId(room);
    }
  }, []);
  const [participants, setParticipants] = React.useState<
    Array<{ id: string; name: string; score: number; lastAnsweredQuestionIndex?: number }>
  >([]);
  const currentParticipant = participants.find((p) => p.id === participantId);

  React.useEffect(() => {
    if (!gameId) return;
    const unsub = listenParticipants(gameId, setParticipants);
    return () => unsub();
  }, [gameId]);

  React.useEffect(() => {
    if (!user) return;
    getRecentQuizzes(user.uid).then((items) => {
      setAvailableQuizzes(items);
      setSelectedQuizId(items[0]?.id ?? null);
    });
  }, [user]);

  React.useEffect(() => {
    if (!gameId) return;
    const unsub = listenGame(gameId, (next) => {
      setGame(next);
      if (next?.endsAt) {
        const diff = Math.max(0, Math.floor((next.endsAt - Date.now()) / 1000));
        setTimeLeft(diff);
        setIsLive(next.status === "live");
      }
    });
    return () => unsub();
  }, [gameId]);

  React.useEffect(() => {
    if (!isLive || !game?.endsAt) return;
    const timer = setInterval(() => {
      const diff = Math.max(0, Math.floor((game.endsAt - Date.now()) / 1000));
      setTimeLeft(diff);
      if (diff <= 0) {
        setIsLive(false);
        if (
          !autoCloseRef.current &&
          user?.uid === game?.hostId &&
          gameId &&
          !game?.answersLocked
        ) {
          autoCloseRef.current = true;
          updateGame(gameId, {
            answersLocked: true,
            status: "waiting",
            endsAt: 0,
            showAnswers: game?.autoReveal ? true : game?.showAnswers ?? false
          }).catch(() => undefined);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isLive, game, gameId, user]);

  const handleCreate = async () => {
    if (!user) return;
    const id = await createGame(user.uid);
    setGameId(id);
    await logUserEvent(user.uid, "game_started", { gameId: id });
  };

  const handleJoin = async () => {
    if (!roomCode || !name) return;
    const id = roomCode.trim();
    await joinGame(id, {
      id: participantId || crypto.randomUUID(),
      name,
      score: 0
    });
    setGameId(id);
  };

  const handleStartQuestion = async () => {
    if (!gameId) return;
    if (!game?.questions?.length) return;
    const nextIndex =
      typeof game?.currentQuestionIndex === "number"
        ? (game.currentQuestionIndex + 1) % (game.questions?.length ?? 1)
        : 0;
    const endsAt = Date.now() + 30_000;
    await updateGame(gameId, {
      status: "live",
      currentQuestionIndex: nextIndex,
      endsAt,
      showAnswers: false,
      answersLocked: false
    });
    autoCloseRef.current = false;
    setIsLive(true);
    setTimeLeft(30);
    setAnswerStatus(null);
    setAnswerFeedback((prev) => {
      const next = { ...prev };
      delete next[nextIndex];
      return next;
    });
    if (user) {
      await logUserEvent(user.uid, "game_question_started", {
        gameId,
        questionIndex: nextIndex
      });
    }
  };

  const handleRevealAnswers = async () => {
    if (!gameId || !user || user.uid !== game?.hostId) return;
    await updateGame(gameId, { showAnswers: !game?.showAnswers });
  };

  const handleEndQuestion = async () => {
    if (!gameId || !user || user.uid !== game?.hostId) return;
    await updateGame(gameId, { status: "waiting", endsAt: 0 });
    setIsLive(false);
  };

  const handleLockAnswers = async () => {
    if (!gameId || !user || user.uid !== game?.hostId) return;
    await updateGame(gameId, { answersLocked: !game?.answersLocked });
  };

  const handleToggleAutoReveal = async () => {
    if (!gameId || !user || user.uid !== game?.hostId) return;
    await updateGame(gameId, { autoReveal: !game?.autoReveal });
  };

  const handleLoadQuiz = async () => {
    if (!gameId || !selectedQuizId || !availableQuizzes.length) return;
    const quiz = availableQuizzes.find((item) => item.id === selectedQuizId);
    if (!quiz) return;
    await updateGame(gameId, {
      questions: quiz.questions.map((question: any) => ({
        prompt: question.prompt,
        options: question.options.map((option: any) => ({
          text: option.text,
          isCorrect: option.isCorrect
        }))
      }))
    });
    setAnswerFeedback({});
    setAnswerStatus(null);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Live game mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Launch timed quizzes, share a room code, and track real-time scores.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleCreate}>Start a new game</Button>
            <Button variant="outline" disabled>
              Schedule later
            </Button>
            <Button
              variant="outline"
              onClick={handleStartQuestion}
              disabled={!gameId || !game?.questions?.length || user?.uid !== game?.hostId}
            >
              Start question
            </Button>
            <Button
              variant="outline"
              onClick={handleRevealAnswers}
              disabled={!gameId || user?.uid !== game?.hostId}
            >
              {game?.showAnswers ? "Hide answers" : "Reveal answers"}
            </Button>
            <Button
              variant="outline"
              onClick={handleLockAnswers}
              disabled={!gameId || user?.uid !== game?.hostId}
            >
              {game?.answersLocked ? "Unlock answers" : "Lock answers"}
            </Button>
            <Button
              variant="outline"
              onClick={handleToggleAutoReveal}
              disabled={!gameId || user?.uid !== game?.hostId}
            >
              {game?.autoReveal ? "Auto-reveal: On" : "Auto-reveal: Off"}
            </Button>
            <Button
              variant="outline"
              onClick={handleEndQuestion}
              disabled={!gameId || user?.uid !== game?.hostId}
            >
              End question
            </Button>
          </div>
          {gameId ? (
            <div className="rounded-xl border border-dashed border-border p-4 text-sm text-slate-500">
              Room code: <span className="font-semibold">{gameId}</span>
            </div>
          ) : null}
          {gameId && user?.uid === game?.hostId ? (
            <div className="rounded-xl border border-border p-4 text-sm text-slate-600">
              Invite link:{" "}
              <button
                className="font-semibold text-indigo-600"
                onClick={() =>
                  navigator.clipboard.writeText(
                    `${window.location.origin}/game?room=${gameId}`
                  )
                }
              >
                Copy invite link
              </button>
            </div>
          ) : null}
          {gameId ? (
            <div className="rounded-xl border border-border p-4 text-sm text-slate-600">
              {game?.answersLocked
                ? "Answers closed."
                : isLive
                  ? `Question live · ${timeLeft}s left`
                  : "Waiting to start."}
            </div>
          ) : null}
          {gameId && typeof game?.currentQuestionIndex === "number" ? (
            <div className="rounded-xl border border-border bg-white/70 p-4 text-sm text-slate-700">
              Q{game.currentQuestionIndex + 1}:{" "}
              {game.questions?.[game.currentQuestionIndex]?.prompt ??
                "No questions loaded yet."}
              <div className="mt-3 space-y-1">
                {game.questions?.[game.currentQuestionIndex]?.options?.map(
                  (option: any, idx: number) => (
                    <button
                      key={idx}
                      disabled={
                        !gameId ||
                        !participantId ||
                        game?.answersLocked ||
                        !isLive ||
                        currentParticipant?.lastAnsweredQuestionIndex ===
                          game.currentQuestionIndex
                      }
                      onClick={async () => {
                        if (!gameId || !participantId || game?.answersLocked || !isLive)
                          return;
                        if (
                          currentParticipant?.lastAnsweredQuestionIndex ===
                          game.currentQuestionIndex
                        )
                          return;
                        try {
                          const result = await submitAnswer(
                            gameId,
                            game.currentQuestionIndex,
                            idx
                          );
                          await recordAnswer(
                            gameId,
                            participantId,
                            game.currentQuestionIndex
                          );
                          setAnswerFeedback((prev) => ({
                            ...prev,
                            [game.currentQuestionIndex]: {
                              optionIndex: idx,
                              correct: result.correct
                            }
                          }));
                          setAnswerStatus(
                            result.correct ? "Correct answer!" : "Not quite. Keep trying."
                          );
                        } catch (error) {
                          setAnswerStatus("Answers are closed for this question.");
                        }
                      }}
                      className={`block w-full text-left ${
                        game.showAnswers && option.isCorrect
                          ? "font-semibold text-emerald-600"
                          : answerFeedback[game.currentQuestionIndex]?.optionIndex === idx
                            ? answerFeedback[game.currentQuestionIndex]?.correct
                              ? "font-semibold text-emerald-600"
                              : "font-semibold text-red-500"
                            : "text-slate-700"
                      }`}
                    >
                      • {option.text}
                    </button>
                  )
                )}
              </div>
              {answerStatus ? (
                <p className="mt-3 text-xs text-slate-500">{answerStatus}</p>
              ) : null}
            </div>
          ) : null}
          {gameId && user?.uid === game?.hostId ? (
            <div className="rounded-xl border border-border p-4 text-sm text-slate-600">
              <p className="text-xs text-slate-500">Select quiz</p>
              <select
                className="mt-2 w-full rounded-lg border border-border bg-white p-2 text-sm"
                value={selectedQuizId ?? ""}
                onChange={(event) => setSelectedQuizId(event.target.value)}
              >
                {availableQuizzes.map((quiz) => (
                  <option key={quiz.id} value={quiz.id}>
                    {quiz.title}
                  </option>
                ))}
              </select>
              <Button className="mt-3" variant="outline" onClick={handleLoadQuiz}>
                Load quiz into game
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invite participants</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Enter room code"
            value={roomCode}
            onChange={(event) => setRoomCode(event.target.value)}
          />
          <Input
            placeholder="Your name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button className="w-full" variant="outline" onClick={handleJoin}>
            Join game
          </Button>
          {participants.length > 0 ? (
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-slate-500">Leaderboard</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {participants
                  .slice()
                  .sort((a, b) => b.score - a.score)
                  .slice(0, 3)
                  .map((participant, idx) => (
                    <div
                      key={participant.id}
                      className={`rounded-xl border border-border p-3 text-center ${
                        idx === 0 ? "bg-amber-50" : "bg-white"
                      }`}
                    >
                      <div className="text-xs uppercase text-slate-400">
                        {idx === 0 ? "1st" : idx === 1 ? "2nd" : "3rd"}
                      </div>
                      <div className="mt-2 text-sm font-semibold">
                        {participant.name}
                      </div>
                      <div className="text-lg font-semibold text-slate-900">
                        {participant.score}
                      </div>
                    </div>
                  ))}
              </div>
              <div className="mt-4 space-y-2 text-sm">
                {participants
                  .slice()
                  .sort((a, b) => b.score - a.score)
                  .map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between"
                    >
                      <span>{participant.name}</span>
                      <span className="font-semibold">{participant.score}</span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500">
              Participants will appear here once they join.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
