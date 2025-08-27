import type { Metadata } from "next";
import { Inter } from "next/font/google";
import ClientHeader from "@/components/ClientHeader";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RecallAI",
  description: "The Intelligent Collaborative Learning Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ClientHeader />
        {children}
      </body>
    </html>
  );
}
