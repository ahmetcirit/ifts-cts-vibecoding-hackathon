import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Agile Manager | IFTS Hackathon",
  description: "AI-Powered Scrum & Kanban Assistant — Sprint planlama, görev kırılımı ve raporlamayı otomatikleştir.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-[#F4F6FA] text-slate-800 antialiased">{children}</body>
    </html>
  );
}
