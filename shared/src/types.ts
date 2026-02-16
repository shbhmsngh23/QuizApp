export type QuizDifficulty = "easy" | "medium" | "hard";

export type Flashcard = {
  id: string;
  term: string;
  definition: string;
};

export type MCQOption = {
  id: string;
  text: string;
  isCorrect: boolean;
  explanation?: string;
};

export type MCQQuestion = {
  id: string;
  prompt: string;
  options: MCQOption[];
  hint?: string;
  topic?: string;
  difficulty?: QuizDifficulty;
};

export type QuizSet = {
  id: string;
  title: string;
  createdAt: string;
  sourceText: string;
  difficulty: QuizDifficulty;
  shareEnabled?: boolean;
  sharePassword?: string;
  shareToken?: string;
  questions: MCQQuestion[];
  flashcards: Flashcard[];
};
