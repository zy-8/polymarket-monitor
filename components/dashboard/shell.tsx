"use client"

// All current routes (`/`, `/crypto/*`, `/event/*`) supply their own chrome,
// so the shell is now just a min-h-screen wrapper.
export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen">{children}</div>
}
