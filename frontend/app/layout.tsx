import type { Metadata } from "next";
import { Source_Serif_4, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/app-shell";

/*
 * Anthropic-style system: Copernicus ≈ Source Serif 4 (display serif),
 * Styrene ≈ Space Grotesk (geometric grotesque UI), Berkeley ≈ JetBrains Mono.
 */
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-jb", display: "swap" });

export const metadata: Metadata = {
  title: "JobSeeker",
  description: "Apply with proof — truthful, tailored, human-checked job applications.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("js-theme")||"dark";document.documentElement.setAttribute("data-theme",t);}catch(e){}`,
          }}
        />
      </head>
      <body className={`${grotesk.variable} ${serif.variable} ${mono.variable} antialiased`}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
