import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "TalentGraph - AI Resume Analyzer",
    template: "%s | TalentGraph",
  },
  description:
    "Intelligent resume analysis powered by hybrid scoring, semantic vector search, and LLM-generated feedback.",
  keywords: ["resume", "AI", "job search", "career", "interview prep"],
  authors: [{ name: "TalentGraph" }],
  openGraph: {
    type: "website",
    title: "TalentGraph - AI Resume Analyzer",
    description:
      "Get actionable feedback on your resume with STAR-method recommendations and AI-generated interview questions.",
    siteName: "TalentGraph",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
