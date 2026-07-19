import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import RightSection from "@/components/layout/RightSection";

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
    default: "CoCo",
    template: "%s | CoCo",
  },
  description: "こころの悩みや日々の体験を安心して共有できるコミュニティ",
  applicationName: "CoCo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fontSizeScript = `
    (function () {
      try {
        var value = localStorage.getItem('app-font-size');
        if (!value) return;
        document.documentElement.style.setProperty('--app-font-size', value + 'pt');
      } catch (e) {}
    })();
  `;

  return (
    <html lang="ja">
      <head>
        <Script id="font-size-init" strategy="beforeInteractive">
          {fontSizeScript}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-black`}
      >
        <div className="flex flex-col lg:flex-row justify-center min-h-screen max-w-[1265px] mx-auto">
          <Sidebar />
          <main className="flex-1 min-w-0 w-full border-b border-border lg:border-b-0 lg:border-r-0 lg:border-x min-h-screen">
            {children}
          </main>
          <RightSection />
        </div>
      </body>
    </html>
  );
}
