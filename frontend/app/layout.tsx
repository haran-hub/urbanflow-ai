import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "UrbanFlow AI — Smart City Navigation",
  description: "AI-powered predictions for parking, EV charging, transit, and local services. Reduce urban friction and save time.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  themeColor: "#3b82f6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        {children}
        <Footer />
      </body>
    </html>
  );
}
