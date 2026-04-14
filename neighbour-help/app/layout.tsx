import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import { AuthProvider } from "./lib/context/AuthContext";
import { ChatWidgetProvider } from "./lib/context/ChatWidgetContext";
import { ThemeProvider } from "./lib/context/ThemeContext";
import ChatWidget from "./components/ui/ChatWidget";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NeighbourHelp – Smart maintenance for every home",
  description:
    "NeighbourHelp connects homeowners with trusted local handymen for all your home repair needs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} antialiased min-h-screen flex flex-col`}>
        <ThemeProvider>
          <AuthProvider>
            <ChatWidgetProvider>
              <Navbar />
              <main className="flex-1">{children}</main>
              <Footer />
              <ChatWidget />
            </ChatWidgetProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
