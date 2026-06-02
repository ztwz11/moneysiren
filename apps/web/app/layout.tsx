import type { ReactNode } from "react";

export const metadata = {
  title: "StackSpend Local Dashboard",
  description: "Local-first cloud and SaaS usage, health, and expected billing dashboard.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f7f8fb", color: "#171923", fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
