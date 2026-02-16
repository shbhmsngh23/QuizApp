import "./globals.css";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Atkinson_Hyperlegible } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-dyslexic",
  display: "swap"
});

export const metadata: Metadata = {
  title: "QuizMaster AI",
  description: "AI-powered quiz and flashcard generator for educators"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${jakarta.variable} ${atkinson.variable} font-sans`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
