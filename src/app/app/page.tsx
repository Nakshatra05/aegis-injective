import { Suspense } from "react";
import Dashboard from "@/components/dashboard";
export default function AppPage() {
  return (
    <Suspense
      fallback={
        <main id="main" className="doc-page">
          Loading Aegis…
        </main>
      }
    >
      <Dashboard />
    </Suspense>
  );
}
