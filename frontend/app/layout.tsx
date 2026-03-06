import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import Footer from "@/components/Footer";
import FeedbackWidget from "@/components/FeedbackWidget";

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
        <FeedbackWidget />
        {process.env.NEXT_PUBLIC_CLARITY_ID && (
          <Script id="clarity-init" strategy="afterInteractive">
            {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${process.env.NEXT_PUBLIC_CLARITY_ID}");`}
          </Script>
        )}
      </body>
    </html>
  );
}
