# QuizMaster AI

Cross-platform quiz and flashcard generator for educators and trainers. Upload learning content, generate quizzes with OpenAI, and share instantly.

## Stack
- Web: Next.js + TypeScript + Tailwind + shadcn/ui
- Mobile: Expo + React Native + NativeWind
- Backend: Firebase (Auth, Firestore, Functions, Storage)
- AI: OpenAI (GPT-4)

## Monorepo Structure
- `web` Next.js frontend
- `mobile` Expo app
- `functions` Firebase Functions backend
- `shared` Shared types and schemas

## Setup
1. Install dependencies
```
npm install
```

2. Configure Firebase + OpenAI
- Copy `.env.example` to `.env` and fill in values.
- Run `firebase login` and `firebase use <project-id>`.

3. Start web app
```
cd web
npm run dev
```

4. Start functions emulator (optional)
```
cd functions
npm run serve
```

5. Start mobile app
```
cd mobile
npm run start
```

## Features Implemented
- Email/password + Google auth
- Educator/trainer onboarding
- Upload content (PDF, DOCX, TXT) or paste text
- AI quiz generation (10+ MCQs + flashcards)
- Flashcards mode
- Game mode placeholder
- Quiz editor + export (CSV, JSON, PDF print, Google Forms CSV, Moodle XML)
- Theme + dyslexia-friendly font toggle
- Mobile: email/password + Google/Apple auth shell, upload + flashcards preview

## Notes
- Apple sign-in requires setup in Firebase + Apple Developer portal.
- Public share links require a share token; optional password is enforced via Cloud Function.
- Mobile Google sign-in requires Expo client IDs (`EXPO_PUBLIC_GOOGLE_*`).
- For Expo mobile, set `EXPO_PUBLIC_*` Firebase values in `.env` (see `.env.example`).

## Deployment
- Web: deploy to Vercel
- Mobile: publish with Expo
- Functions: `firebase deploy --only functions`
