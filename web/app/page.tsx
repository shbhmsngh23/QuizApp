import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    title: "AI quiz generation",
    description: "Turn PDFs, docs, or text into multi-choice quizzes in seconds."
  },
  {
    title: "Flashcards & game modes",
    description: "Keep learners engaged with flip cards and timed challenges."
  },
  {
    title: "Share & export",
    description: "Export to CSV, PDF, or share with password-protected links."
  }
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden bg-grid">
        <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-white/90 to-indigo-100/40" />
        <div className="relative mx-auto flex max-w-6xl flex-col px-6 py-20">
          <div className="flex flex-col gap-6">
            <span className="w-fit rounded-full bg-indigo-100 px-4 py-2 text-xs font-semibold text-indigo-700">
              Built for educators & trainers
            </span>
            <h1 className="text-4xl font-semibold text-slate-900 md:text-5xl">
              QuizMaster AI turns learning content into polished assessments.
            </h1>
            <p className="max-w-2xl text-base text-slate-600 md:text-lg">
              Upload course material, auto-generate quizzes and flashcards, and
              share instantly with your students. Minimal setup, maximum impact.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button asChild size="lg">
                <Link href="/signin">Get started</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/dashboard">Open dashboard</Link>
              </Button>
            </div>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="border border-white/60">
                <CardHeader>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
