import type { Metadata, Viewport } from "next";
// Self-hosted font files from the `geist` package: the build never fetches Google Fonts.
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Squad Six: fitness accountability for squads of up to six",
    template: "%s · Squad Six",
  },
  description:
    "Join a squad of up to six, record live workouts on your iPhone and earn points the server calculates from real evidence. Coming to iPhone.",
  applicationName: "Squad Six",
  openGraph: {
    type: "website",
    siteName: "Squad Six",
    title: "Squad Six: fitness accountability for squads of up to six",
    description:
      "Join a squad of up to six, record live workouts and earn points the server calculates from real evidence. Coming to iPhone.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#111412" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#content"
          className="sr-only z-50 rounded-full bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <SiteHeader />
        <div id="content" className="flex flex-1 flex-col">
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
