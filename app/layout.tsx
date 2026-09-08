import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/context/AuthContext";
import { GameEngineProvider } from "@/context/GameEngineContext";
import ThemeToggle from "@/components/ui/ThemeToggle";
import GlobalErrorHandler from "@/components/ui/GlobalErrorHandler";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dev Portal",
  description: "Developer portal with role-based access",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <GlobalErrorHandler />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <AuthProvider>
            <GameEngineProvider>
              {children}
              <ThemeToggle />
            </GameEngineProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
