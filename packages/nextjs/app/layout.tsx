import { IBM_Plex_Mono, Inter, Newsreader } from "next/font/google";
import "@rainbow-me/rainbowkit/styles.css";
import "@scaffold-ui/components/styles.css";
import { ScaffoldEthAppWithProviders } from "~~/components/ScaffoldEthAppWithProviders";
import { ThemeProvider } from "~~/components/ThemeProvider";
import "~~/styles/globals.css";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "Obec — neighborhood commons on ENS",
  description:
    "ENS-native protocol for neighborhood commons. Neighbors pool USDC for shared physical resources via threshold-commit smart contracts with auto-refund. Built on Base + ENS for ETHPrague 2026.",
});

const newsreader = Newsreader({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

const ScaffoldEthApp = ({ children }: { children: React.ReactNode }) => {
  return (
    <html
      suppressHydrationWarning
      lang="en"
      className={`${newsreader.variable} ${inter.variable} ${plexMono.variable}`}
    >
      <body className="obec">
        <ThemeProvider forcedTheme="light" attribute="data-theme">
          <ScaffoldEthAppWithProviders>{children}</ScaffoldEthAppWithProviders>
        </ThemeProvider>
      </body>
    </html>
  );
};

export default ScaffoldEthApp;
