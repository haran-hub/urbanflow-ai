"use client";
import { usePathname } from "next/navigation";
import Footer from "./Footer";
import FeedbackWidget from "./FeedbackWidget";
import EmailSubscribeWidget from "./EmailSubscribeWidget";

// Pages that are embedded in iframes — no chrome at all
const IFRAME_ROUTES = ["/embed", "/widget"];

export default function GlobalWidgets() {
  const pathname = usePathname();
  if (IFRAME_ROUTES.includes(pathname)) return null;
  return (
    <>
      <Footer />
      <FeedbackWidget />
      <EmailSubscribeWidget />
    </>
  );
}
