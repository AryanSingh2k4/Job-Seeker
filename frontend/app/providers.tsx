"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 2, refetchOnWindowFocus: false, staleTime: 15_000 },
        },
      }),
  );

  // Dev-only MSW fixtures (D14). Gate rendering until the worker is active so
  // the first queries are intercepted instead of racing the worker startup.
  const [mocksReady, setMocksReady] = useState(process.env.NEXT_PUBLIC_MSW !== "1");
  useEffect(() => {
    if (mocksReady) return;
    void import("@/mocks/browser")
      .then((m) => m.enableMocking())
      .finally(() => setMocksReady(true));
  }, [mocksReady]);

  if (!mocksReady) return null;
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
