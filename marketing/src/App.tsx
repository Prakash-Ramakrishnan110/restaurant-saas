import React, { useEffect, useState } from "react";
import "./index.css";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { VenuePage } from "./pages/VenuePage";
import { HardwarePage } from "./pages/HardwarePage";
import { BookDemoPage } from "./pages/BookDemoPage";
import { LegalPage } from "./pages/LegalPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { getRouteMeta, parseRoute } from "./routes";

interface AppProps {
  initialPath?: string;
}

export const App: React.FC<AppProps> = ({ initialPath }) => {
  const [pathname, setPathname] = useState<string>(() => {
    if (initialPath) return initialPath;
    if (typeof window !== "undefined") return window.location.pathname;
    return "/";
  });

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const { lang, page } = parseRoute(pathname);
  const meta = getRouteMeta(page);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = lang === "ta" ? meta.titleTa : meta.titleEn;
  }, [lang, meta]);

  const navigate = (nextPath: string) => {
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", nextPath);
      setPathname(nextPath);
      window.scrollTo(0, 0);
    }
  };

  return (
    <Layout lang={lang} page={page} onNavigate={navigate}>
      {page === "home" && <HomePage lang={lang} onNavigate={navigate} />}
      {(page === "tea-shops" || page === "restaurants" || page === "hotels") && (
        <VenuePage venue={page} lang={lang} onNavigate={navigate} />
      )}
      {page === "hardware" && <HardwarePage lang={lang} onNavigate={navigate} />}
      {page === "book-demo" && <BookDemoPage lang={lang} onNavigate={navigate} />}
      {(page === "privacy" || page === "terms") && <LegalPage kind={page} lang={lang} />}
      {page === "404" && <NotFoundPage lang={lang} onNavigate={navigate} />}
    </Layout>
  );
};
