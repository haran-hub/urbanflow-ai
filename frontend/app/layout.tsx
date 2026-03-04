import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UrbanFlow AI — Smart City Navigation",
  description: "AI-powered predictions for parking, EV charging, transit, and local services. Reduce urban friction and save time.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
