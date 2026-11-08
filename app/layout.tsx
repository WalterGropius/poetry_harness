import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "@fontsource-variable/inter-tight";
import "@fontsource-variable/newsreader";
import "@fontsource-variable/newsreader/wght-italic.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import { Rail, StationKeys, ThemeSync } from "@/components/shell/Rail";

export const metadata: Metadata = {
  title: "VERSO — a poetry harness",
  description: "Make any poem, read any poem, move any rhythm — English, French, Czech. Scansion, rhyme families, form, lineage; authorship by curation.",
};

export const viewport: Viewport = {
  themeColor: "#0b0c0e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="night" suppressHydrationWarning>
      <body className="hull min-h-dvh">
        {/* apply the saved hull before first paint */}
        <Script id="verso-hull" strategy="beforeInteractive">{`try{var s=JSON.parse(localStorage.getItem("verso:v1")||"{}");if(s.ui&&s.ui.theme)document.documentElement.dataset.theme=s.ui.theme;if(s.ui&&s.ui.lang)document.documentElement.lang=s.ui.lang}catch(e){}`}</Script>
        <ThemeSync />
        <StationKeys />
        <Rail />
        <main className="min-h-dvh pb-20 md:pb-0 md:pl-[76px]">{children}</main>
      </body>
    </html>
  );
}
