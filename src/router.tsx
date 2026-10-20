import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,      // 5 menit — data dianggap fresh
        gcTime: 1000 * 60 * 10,        // 10 menit — cache disimpan
        refetchOnWindowFocus: false,   // gak refetch tiap balik tab
        refetchOnMount: false,         // gak refetch tiap mount
        retry: 1,                      // retry 1x aja kalau gagal
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",            // ← KUNCI: preload pas hover
    defaultPreloadStaleTime: 1000 * 60,  // ← preload valid 1 menit
    defaultPreloadDelay: 50,             // ← delay 50ms (biar gak spam)
  });

  return router;
};
