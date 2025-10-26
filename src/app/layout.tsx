import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { Playfair_Display, Lato, Cormorant_Garamond, Nunito_Sans, Abril_Fatface, Source_Sans_3, Pacifico, Quicksand, Cinzel, Raleway } from "next/font/google";
import { getCompanySettings } from "./(app)/settings/actions";

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair-display',
});

const lato = Lato({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-lato',
});

const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-cormorant-garamond',
});

const nunitoSans = Nunito_Sans({
  subsets: ['latin'],
  variable: '--font-nunito-sans',
});

const abrilFatface = Abril_Fatface({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-abril-fatface',
});

const sourceSansPro = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-source-sans-pro',
});

const pacifico = Pacifico({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-pacifico',
});

const quicksand = Quicksand({
  subsets: ['latin'],
  variable: '--font-quicksand',
});

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
});

const raleway = Raleway({
  subsets: ['latin'],
  variable: '--font-raleway',
});

export async function generateMetadata(): Promise<Metadata> {
  const companySettings = await getCompanySettings();
  return {
    title: companySettings.companyName || "Toko Kilat",
    description: "Aplikasi kasir penjualan dan akuntansi.",
    manifest: "/manifest.json",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#000000" />
      </head>
      <body className={cn(
          "font-body antialiased",
          "min-h-screen bg-background",
          playfairDisplay.variable,
          lato.variable,
          cormorantGaramond.variable,
          nunitoSans.variable,
          abrilFatface.variable,
          sourceSansPro.variable,
          pacifico.variable,
          quicksand.variable,
          cinzel.variable,
          raleway.variable
        )}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
