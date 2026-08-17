import type { Metadata, Viewport } from "next";
import {
  Bricolage_Grotesque,
  DM_Serif_Display,
  Geist_Mono,
  Instrument_Serif,
  Inter,
} from "next/font/google";
import "./globals.css";
import { auth } from "@/auth";
import { hasCompletedImport } from "@/db/queries/imports";
import { getProfile } from "@/db/queries/users";
import { Sidebar } from "@/components/sidebar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-dm-serif-display",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-bricolage-grotesque",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "loopstat - your Spotify, in numbers",
  description: "Stats Spotify détaillées, gratuites et sans pub.",
  appleWebApp: {
    capable: true,
    title: "loopstat",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  const userId = session?.user?.id;
  const [hasImported, profile] = userId
    ? await Promise.all([hasCompletedImport(userId), getProfile(userId)])
    : ([false, null] as const);

  return (
    <html
      lang="fr"
      className={`dark ${inter.variable} ${geistMono.variable} ${instrumentSerif.variable} ${dmSerifDisplay.variable} ${bricolageGrotesque.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Aller au contenu
        </a>
        <div className="flex min-h-screen">
            {/* Always mounted; the Sidebar self-hides on public paths. For a
                logged-out visitor it therefore renders only on /demo (the
                showcase), with the anonymous defaults computed above. */}
            <Sidebar
              authed={!!userId}
              hasImported={hasImported}
              username={profile?.username ?? undefined}
              isPublic={profile?.isPublic ?? false}
            />
            <div className="flex min-w-0 flex-1 flex-col">{children}</div>
          </div>
      </body>
    </html>
  );
}
