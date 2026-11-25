import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const PublicQRPage = React.lazy(() =>
  import("./pages/public/PublicQRPage").then((m) => ({ default: m.PublicQRPage }))
);
const PublicOrderTrackerPage = React.lazy(() =>
  import("./pages/public/PublicOrderTrackerPage").then((m) => ({
    default: m.PublicOrderTrackerPage,
  }))
);
const PublicTokenTVPage = React.lazy(() =>
  import("./pages/public/PublicTokenTVPage").then((m) => ({
    default: m.PublicTokenTVPage,
  }))
);
const StaffApp = React.lazy(() => import("./StaffApp"));

export const App: React.FC = () => {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <React.Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="w-8 h-8 border-4 border-[#FF6A00] border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <Routes>
          <Route path="/q/:token" element={<PublicQRPage />} />
          <Route path="/q/:token/o/:trackingToken" element={<PublicOrderTrackerPage />} />
          <Route path="/tv/:token" element={<PublicTokenTVPage />} />
          <Route path="*" element={<StaffApp />} />
        </Routes>
      </React.Suspense>
    </BrowserRouter>
  );
};

export default App;
