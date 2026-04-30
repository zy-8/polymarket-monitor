import type { Metadata } from "next"
import "./globals.css"
import DashboardShell from "@/components/dashboard/shell"
import { ThemeProvider } from "@/components/theme-provider"

export const metadata: Metadata = {
  title: "Polymarket Monitor",
  description: "Public Polymarket order flow dashboard for whale prints, wallet monitoring, and market-level trading activity.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <DashboardShell>{children}</DashboardShell>
        </ThemeProvider>
      </body>
    </html>
  )
}
