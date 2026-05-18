import type { Metadata } from "next";
import { Inter, DM_Sans } from "next/font/google";
import { NavBar } from "@/components/NavBar";
import { Providers } from "@/components/Providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-geist-sans" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "Futebol Status — jogos & jogadores",
  description: "Cadastro, sorteio, gols e ranking das suas rachas semanais",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${dmSans.variable}`}>
      <body className="font-sans">
        <Providers>
          <NavBar />
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
