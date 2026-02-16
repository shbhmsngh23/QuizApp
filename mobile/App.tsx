import "./global.css";
import { StatusBar } from "expo-status-bar";
import React from "react";
import {
  Animated,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  type User
} from "firebase/auth";
import { auth } from "./src/firebase";
import { generateQuiz, extractText } from "./src/ai";
import { saveQuiz, getLatestQuiz, getRecentQuizzes, updateQuiz, deleteQuiz } from "./src/quizzes";
import { getUserEvents } from "./src/analytics";
import { useGoogleAuth, maybeCompleteAuthSession, signInWithApple } from "./src/oauth";
import { createFlipAnimation } from "./src/flip";
import { submitFeedback } from "./src/feedback";
import * as Speech from "expo-speech";

maybeCompleteAuthSession();

type TabKey = "home" | "upload" | "flashcards" | "history" | "analytics";

export default function App() {
  const [tab, setTab] = React.useState<TabKey>("home");
  const [user, setUser] = React.useState<User | null>(null);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [content, setContent] = React.useState("");
  const [latestQuiz, setLatestQuiz] = React.useState<any>(null);
  const [uploadStatus, setUploadStatus] = React.useState<string | null>(null);
  const [flashIndex, setFlashIndex] = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);
  const flip = React.useRef(createFlipAnimation()).current;
  const [history, setHistory] = React.useState<any[]>([]);
  const [selectedQuiz, setSelectedQuiz] = React.useState<any | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [eventCounts, setEventCounts] = React.useState<Record<string, number>>({});
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const [feedbackText, setFeedbackText] = React.useState("");
  const [feedbackStatus, setFeedbackStatus] = React.useState<string | null>(null);
  const [feedbackCooldownUntil, setFeedbackCooldownUntil] = React.useState<number | null>(
    null
  );
  const feedbackCooldownMs = 5 * 60 * 1000;
  const feedbackCooldownPath = `${FileSystem.documentDirectory}feedbackCooldown.json`;

  const googleAuth = useGoogleAuth();

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
    });
    return () => unsub();
  }, []);

  const persistFeedbackCooldown = async (until: number) => {
    try {
      await FileSystem.writeAsStringAsync(
        feedbackCooldownPath,
        JSON.stringify({ until })
      );
    } catch (error) {
      // Ignore persistence errors for feedback cooldown.
    }
  };

  React.useEffect(() => {
    let mounted = true;
    const loadCooldown = async () => {
      try {
        const info = await FileSystem.getInfoAsync(feedbackCooldownPath);
        if (!info.exists) return;
        const raw = await FileSystem.readAsStringAsync(feedbackCooldownPath);
        const parsed = JSON.parse(raw) as { until?: number };
        if (parsed.until && Date.now() < parsed.until && mounted) {
          setFeedbackCooldownUntil(parsed.until);
        }
      } catch (error) {
        // Ignore malformed cooldown files.
      }
    };
    loadCooldown();
    return () => {
      mounted = false;
    };
  }, [feedbackCooldownPath]);

  React.useEffect(() => {
    if (!feedbackCooldownUntil) return;
    const timer = setInterval(() => {
      if (Date.now() >= feedbackCooldownUntil) {
        setFeedbackCooldownUntil(null);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [feedbackCooldownUntil]);

  React.useEffect(() => {
    if (!user) return;
    getLatestQuiz(user.uid).then(setLatestQuiz);
    getRecentQuizzes(user.uid).then(setHistory);
    getUserEvents(user.uid).then((events) => {
      const counts = events.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      setEventCounts(counts);
    });
  }, [user, tab]);

  React.useEffect(() => {
    setFlashIndex(0);
    setFlipped(false);
    flip.flipToFront();
  }, [latestQuiz]);

  React.useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  React.useEffect(() => {
    googleAuth.handleResponse();
  }, [googleAuth.response]);

  const analyticsSeries = [
    { key: "quiz_generated", label: "Quizzes generated", value: eventCounts.quiz_generated ?? 0 },
    { key: "share_link_created", label: "Share links created", value: eventCounts.share_link_created ?? 0 },
    { key: "game_started", label: "Games started", value: eventCounts.game_started ?? 0 }
  ];
  const maxMetric = Math.max(1, ...analyticsSeries.map((metric) => metric.value));
  const feedbackRemainingSeconds = feedbackCooldownUntil
    ? Math.max(0, Math.ceil((feedbackCooldownUntil - Date.now()) / 1000))
    : 0;

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setAuthError("Sign in failed.");
    }
  };

  const handleSignUp = async () => {
    setAuthError(null);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setAuthError("Sign up failed.");
    }
  };

  const handleGenerate = async () => {
    if (!user || !content.trim()) return;
    const result = await generateQuiz({
      title: "Mobile Quiz",
      content,
      difficulty: "medium",
      count: 10
    });
    const quiz = {
      title: "Mobile Quiz",
      createdAt: new Date().toISOString(),
      sourceText: content,
      difficulty: "medium",
      questions: result.questions,
      flashcards: result.flashcards
    };
    await saveQuiz(user.uid, quiz);
    setLatestQuiz(quiz);
    setTab("flashcards");
  };

  const handlePickFile = async () => {
    setUploadStatus(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      copyToCacheDirectory: true
    });

    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setUploadStatus("Reading file...");
    const file = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64
    });

    setUploadStatus("Extracting text...");
    try {
      const data = await extractText(file, asset.mimeType ?? "text/plain");
      setContent(data.text.trim());
      setUploadStatus("Text extracted.");
    } catch (error) {
      setUploadStatus("Extraction failed. Paste text manually.");
    }
  };

  const speakFlashcard = (text: string) => {
    Speech.stop();
    setIsSpeaking(true);
    Speech.speak(text, {
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false)
    });
  };

  if (!user) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
        <StatusBar style="dark" />
        <View className="w-full rounded-2xl border border-slate-200 bg-white p-6">
          <Text className="text-xl font-semibold text-foreground">
            Sign in to QuizMaster AI
          </Text>
          <TextInput
            placeholder="Email"
            autoCapitalize="none"
            className="mt-4 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            placeholder="Password"
            secureTextEntry
            className="mt-3 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={password}
            onChangeText={setPassword}
          />
          {authError ? (
            <Text className="mt-2 text-xs text-red-500">{authError}</Text>
          ) : null}
          <TouchableOpacity
            className="mt-4 rounded-xl bg-primary px-4 py-3"
            onPress={handleSignIn}
          >
            <Text className="text-center text-sm font-semibold text-white">
              Sign in
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="mt-2 rounded-xl border border-slate-200 px-4 py-3"
            onPress={handleSignUp}
          >
            <Text className="text-center text-sm font-semibold text-slate-700">
              Create account
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="mt-2 rounded-xl border border-slate-200 px-4 py-3"
            onPress={() => googleAuth.promptAsync()}
            disabled={!googleAuth.request}
          >
            <Text className="text-center text-sm font-semibold text-slate-700">
              Continue with Google
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="mt-2 rounded-xl border border-slate-200 px-4 py-3"
            onPress={() => signInWithApple().catch(() => setAuthError(\"Apple sign-in failed.\"))}
          >
            <Text className="text-center text-sm font-semibold text-slate-700">
              Continue with Apple
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar style="dark" />
      <View className="flex-row justify-between px-6 pt-6">
        {[
          { key: "home", label: "Home" },
          { key: "upload", label: "Upload" },
          { key: "flashcards", label: "Flashcards" },
          { key: "history", label: "History" },
          { key: "analytics", label: "Analytics" }
        ].map((item) => (
          <TouchableOpacity
            key={item.key}
            onPress={() => setTab(item.key as TabKey)}
            className={`rounded-full px-4 py-2 ${\n              tab === item.key ? \"bg-primary\" : \"bg-white\"\n            }`}
          >
            <Text className={tab === item.key ? "text-white" : "text-slate-600"}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerClassName="px-6 pb-10">
        {tab === "home" ? (
          <>
            <View className="mt-6">
              <Text className="text-2xl font-semibold text-foreground">
                QuizMaster AI
              </Text>
              <Text className="mt-2 text-sm text-slate-500">
                Generate quizzes and flashcards on the go.
              </Text>
            </View>

            <View className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
              <Text className="text-sm text-slate-500">Quick actions</Text>
              <View className="mt-4 gap-3">
                {[
                  "Upload content",
                  "Generate quiz",
                  "Review flashcards"
                ].map((label) => (
                  <TouchableOpacity
                    key={label}
                    className="rounded-xl bg-primary px-4 py-3"
                  >
                    <Text className="text-sm font-semibold text-white">
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
              <Text className="text-sm text-slate-500">Stats</Text>
              <View className="mt-4 flex-row justify-between">
                <View>
                  <Text className="text-xl font-semibold text-foreground">12</Text>
                  <Text className="text-xs text-slate-500">Quizzes</Text>
                </View>
                <View>
                  <Text className="text-xl font-semibold text-foreground">148</Text>
                  <Text className="text-xs text-slate-500">Learners</Text>
                </View>
                <View>
                  <Text className="text-xl font-semibold text-foreground">82%</Text>
                  <Text className="text-xs text-slate-500">Avg score</Text>
                </View>
              </View>
            </View>
          </>
        ) : null}

        {tab === "upload" ? (
          <>
            <View className="mt-6">
              <Text className="text-lg font-semibold text-foreground">
                Upload content
              </Text>
              <Text className="mt-2 text-sm text-slate-500">
                Paste text or import files (mobile upload coming next).
              </Text>
            </View>
            <View className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
              <Text className="text-xs text-slate-500">Content</Text>
              <TouchableOpacity
                className="mt-3 rounded-xl border border-slate-200 px-4 py-3"
                onPress={handlePickFile}
              >
                <Text className="text-center text-sm font-semibold text-slate-700">
                  Upload PDF/DOCX/TXT
                </Text>
              </TouchableOpacity>
              {uploadStatus ? (
                <Text className="mt-2 text-xs text-slate-500">{uploadStatus}</Text>
              ) : null}
              <TextInput
                placeholder="Paste lesson content..."
                multiline
                className="mt-3 min-h-[140px] rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={content}
                onChangeText={setContent}
              />
              <TouchableOpacity
                className="mt-4 rounded-xl bg-primary px-4 py-3"
                onPress={handleGenerate}
              >
                <Text className="text-center text-sm font-semibold text-white">
                  Generate quiz
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        {tab === "flashcards" ? (
          <>
            <View className="mt-6">
              <Text className="text-lg font-semibold text-foreground">
                Flashcards
              </Text>
              <Text className="mt-2 text-sm text-slate-500">
                Review key terms from your latest quiz set.
              </Text>
            </View>
            <View className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
              {latestQuiz?.flashcards?.length ? (
                <View className="gap-4">
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => {
                      const next = !flipped;
                      setFlipped(next);
                      next ? flip.flipToBack() : flip.flipToFront();
                    }}
                  >
                    <View>
                      <Animated.View
                        style={{
                          transform: [{ rotateY: flip.frontInterpolate }],
                          backfaceVisibility: "hidden"
                        }}
                        className="rounded-2xl border border-slate-200 bg-white p-6"
                      >
                        <Text className="text-xs uppercase tracking-widest text-slate-400">
                          Card {flashIndex + 1} of {latestQuiz.flashcards.length}
                        </Text>
                        <Text className="mt-4 text-lg font-semibold text-foreground">
                          {latestQuiz.flashcards[flashIndex].term}
                        </Text>
                        <Text className="mt-2 text-xs text-slate-500">
                          Tap to flip
                        </Text>
                      </Animated.View>
                      <Animated.View
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          transform: [{ rotateY: flip.backInterpolate }],
                          backfaceVisibility: "hidden"
                        }}
                        className="rounded-2xl border border-slate-200 bg-white p-6"
                      >
                        <Text className="text-xs uppercase tracking-widest text-slate-400">
                          Definition
                        </Text>
                        <Text className="mt-4 text-lg font-semibold text-foreground">
                          {latestQuiz.flashcards[flashIndex].definition}
                        </Text>
                        <Text className="mt-2 text-xs text-slate-500">
                          Tap to flip back
                        </Text>
                      </Animated.View>
                    </View>
                  </TouchableOpacity>
                  <View className="flex-row flex-wrap justify-between gap-3">
                    <TouchableOpacity
                      className="rounded-xl border border-slate-200 px-4 py-2"
                      onPress={() => {
                        setFlashIndex((prev) =>
                          prev === 0
                            ? latestQuiz.flashcards.length - 1
                            : prev - 1
                        );
                        setFlipped(false);
                        flip.flipToFront();
                      }}
                    >
                      <Text className="text-sm text-slate-700">Previous</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className={`rounded-xl px-4 py-2 ${
                        isSpeaking ? "bg-amber-100" : "bg-white"
                      }`}
                      onPress={() => {
                        if (isSpeaking) {
                          Speech.stop();
                          setIsSpeaking(false);
                          return;
                        }
                        const text = flipped
                          ? latestQuiz.flashcards[flashIndex].definition
                          : latestQuiz.flashcards[flashIndex].term;
                        speakFlashcard(text);
                      }}
                    >
                      <Text className="text-sm text-slate-700">
                        {isSpeaking ? "Stop audio" : "Listen"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="rounded-xl bg-primary px-4 py-2"
                      onPress={() => {
                        setFlashIndex(
                          (prev) => (prev + 1) % latestQuiz.flashcards.length
                        );
                        setFlipped(false);
                        flip.flipToFront();
                      }}
                    >
                      <Text className="text-sm font-semibold text-white">
                        Next
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text className="text-center text-sm text-slate-500">
                  No flashcards yet. Generate a quiz to see them here.
                </Text>
              )}
            </View>
          </>
        ) : null}

        {tab === "history" ? (
          <>
            <View className="mt-6">
              <Text className="text-lg font-semibold text-foreground">
                Quiz history
              </Text>
              <Text className="mt-2 text-sm text-slate-500">
                Review and edit recent quizzes.
              </Text>
            </View>
            <View className="mt-6 gap-3">
              {history.map((quiz) => (
                <TouchableOpacity
                  key={quiz.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                  onPress={() => setSelectedQuiz(quiz)}
                  onLongPress={() => {
                    setSelectedIds((prev) =>
                      prev.includes(quiz.id)
                        ? prev.filter((id) => id !== quiz.id)
                        : [...prev, quiz.id]
                    );
                  }}
                >
                  <Text className="text-sm font-semibold text-foreground">
                    {quiz.title}
                  </Text>
                  <Text className="mt-1 text-xs text-slate-500">
                    {quiz.questions?.length ?? 0} questions ·{" "}
                    {quiz.flashcards?.length ?? 0} flashcards
                  </Text>
                  {selectedIds.includes(quiz.id) ? (
                    <Text className="mt-2 text-xs text-emerald-600">
                      Selected for deletion
                    </Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
            {selectedIds.length > 0 ? (
              <TouchableOpacity
                className="mt-4 rounded-xl bg-red-500 px-4 py-3"
                onPress={async () => {
                  if (!user) return;
                  const remaining = history.filter(
                    (quiz) => !selectedIds.includes(quiz.id)
                  );
                  await Promise.all(
                    selectedIds.map((id) => deleteQuiz(user.uid, id))
                  );
                  setHistory(remaining);
                  setSelectedIds([]);
                }}
              >
                <Text className="text-center text-sm font-semibold text-white">
                  Delete selected
                </Text>
              </TouchableOpacity>
            ) : null}
            {selectedQuiz ? (
              <View className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
                <Text className="text-sm font-semibold text-foreground">
                  Edit quiz
                </Text>
                <TextInput
                  className="mt-3 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={selectedQuiz.title}
                  onChangeText={(value) =>
                    setSelectedQuiz({ ...selectedQuiz, title: value })
                  }
                />
                {selectedQuiz.flashcards?.slice(0, 2).map((card: any, idx: number) => (
                  <View key={card.id ?? idx} className="mt-3">
                    <TextInput
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      value={card.term}
                      onChangeText={(value) => {
                        const next = [...selectedQuiz.flashcards];
                        next[idx] = { ...card, term: value };
                        setSelectedQuiz({ ...selectedQuiz, flashcards: next });
                      }}
                    />
                    <TextInput
                      className="mt-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      value={card.definition}
                      onChangeText={(value) => {
                        const next = [...selectedQuiz.flashcards];
                        next[idx] = { ...card, definition: value };
                        setSelectedQuiz({ ...selectedQuiz, flashcards: next });
                      }}
                    />
                  </View>
                ))}
                <TouchableOpacity
                  className="mt-4 rounded-xl bg-primary px-4 py-3"
                  onPress={async () => {
                    if (!user || !selectedQuiz) return;
                    await updateQuiz(user.uid, selectedQuiz.id, selectedQuiz);
                    setHistory((prev) =>
                      prev.map((item) =>
                        item.id === selectedQuiz.id ? selectedQuiz : item
                      )
                    );
                  }}
                >
                  <Text className="text-center text-sm font-semibold text-white">
                    Save changes
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        ) : null}

        {tab === "analytics" ? (
          <>
            <View className="mt-6">
              <Text className="text-lg font-semibold text-foreground">
                Analytics
              </Text>
              <Text className="mt-2 text-sm text-slate-500">
                Recent activity across your quizzes.
              </Text>
            </View>
            <View className="mt-6 gap-4">
              {analyticsSeries.map((metric) => (
                <View
                  key={metric.key}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <Text className="text-xs text-slate-500">{metric.label}</Text>
                  <Text className="mt-2 text-2xl font-semibold text-foreground">
                    {metric.value}
                  </Text>
                </View>
              ))}
              <View className="rounded-2xl border border-slate-200 bg-white p-5">
                <Text className="text-xs text-slate-500">Activity chart</Text>
                <View className="mt-4 gap-3">
                  {analyticsSeries.map((metric) => (
                    <View key={metric.key}>
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs text-slate-500">
                          {metric.label}
                        </Text>
                        <Text className="text-xs font-semibold text-slate-700">
                          {metric.value}
                        </Text>
                      </View>
                      <View className="mt-2 h-2 w-full rounded-full bg-slate-100">
                        <View
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${(metric.value / maxMetric) * 100}%` }}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
              <View className="rounded-2xl border border-slate-200 bg-white p-5">
                <Text className="text-xs text-slate-500">Feedback</Text>
                <TextInput
                  placeholder="Share ideas or report an issue..."
                  multiline
                  className="mt-3 min-h-[120px] rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={feedbackText}
                  onChangeText={setFeedbackText}
                />
                {feedbackStatus ? (
                  <Text className="mt-2 text-xs text-slate-500">
                    {feedbackStatus}
                  </Text>
                ) : null}
                {feedbackCooldownUntil ? (
                  <Text className="mt-2 text-xs text-amber-600">
                    Please wait {feedbackRemainingSeconds}s before sending more feedback.
                  </Text>
                ) : null}
                <TouchableOpacity
                  className={`mt-3 rounded-xl px-4 py-3 ${
                    feedbackCooldownUntil || !feedbackText.trim()
                      ? "bg-slate-200"
                      : "bg-primary"
                  }`}
                  disabled={!!feedbackCooldownUntil || !feedbackText.trim()}
                  onPress={async () => {
                    if (feedbackCooldownUntil) return;
                    setFeedbackStatus("Sending feedback...");
                    try {
                      const result = await submitFeedback({
                        message: feedbackText.trim(),
                        platform: "mobile"
                      });
                      const nextCooldown =
                        Date.now() +
                        (result.cooldownSeconds ?? feedbackCooldownMs / 1000) * 1000;
                      setFeedbackCooldownUntil(nextCooldown);
                      await persistFeedbackCooldown(nextCooldown);
                      setFeedbackText("");
                      setFeedbackStatus(
                        "Thanks for the feedback! We'll review it shortly."
                      );
                    } catch (error: any) {
                      const retryAfter =
                        error?.details?.retryAfterSeconds ??
                        error?.data?.retryAfterSeconds;
                      if (
                        error?.code === "functions/resource-exhausted" &&
                        retryAfter
                      ) {
                        const nextCooldown = Date.now() + retryAfter * 1000;
                        setFeedbackCooldownUntil(nextCooldown);
                        await persistFeedbackCooldown(nextCooldown);
                        setFeedbackStatus(
                          "You're sending feedback too fast. Please wait."
                        );
                        return;
                      }
                      setFeedbackStatus("Could not send feedback. Please try again.");
                    }
                  }}
                >
                  <Text
                    className={`text-center text-sm font-semibold ${
                      feedbackCooldownUntil || !feedbackText.trim()
                        ? "text-slate-500"
                        : "text-white"
                    }`}
                  >
                    Send feedback
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
