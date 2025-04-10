/**
 * src/app/layout.tsx
 *
 * Root layout for the application.
 * Sets up global styles, fonts, providers (RainbowKit, Wagmi, SessionProvider).
 */
import "@/app/globals.css";
import { Inter } from "next/font/google";
import { Providers } from "@/providers/Providers";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Auth Test App",
  description: "Example app showcasing Web3 auth with SIWE and Supabase",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          inter.className
        )}
      >
        <Navbar />
        <main className="flex-grow">
          <Providers>{children}</Providers>
        </main>
      </body>
    </html>
  );
}
