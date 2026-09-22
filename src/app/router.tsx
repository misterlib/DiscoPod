import { Suspense, lazy } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { RootApp } from "./RootApp";

const HomeRoute = lazy(async () =>
  import("../routes/HomeRoute").then((module) => ({
    default: module.HomeRoute,
  })),
);

const AdminRoute = lazy(async () =>
  import("../routes/AdminRoute").then((module) => ({
    default: module.AdminRoute,
  })),
);

function RouteErrorFallback() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-disco-dark text-disco-cream p-6 text-center">
      <div className="max-w-md rounded-2xl border border-white/10 bg-disco-panel/80 p-8 shadow-2xl backdrop-blur-md">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/20 text-rose-400">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-xl font-black text-disco-rose mb-2">Something went wrong</h1>
        <p className="text-xs text-slate-300 mb-6">
          An unexpected error occurred while rendering this page.
        </p>
        <div className="flex justify-center gap-3">
          <a
            href="/"
            className="rounded-full bg-disco-caramel px-5 py-2 text-xs font-bold uppercase tracking-wider text-disco-dark hover:brightness-110 transition shadow-lg"
          >
            Return Home
          </a>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full border border-white/20 bg-white/5 px-5 py-2 text-xs font-bold uppercase tracking-wider text-disco-cream hover:bg-white/10 transition"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootApp />,
    errorElement: <RouteErrorFallback />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<div className="text-sm text-slate-300">Loading route...</div>}>
            <HomeRoute />
          </Suspense>
        ),
      },
      {
        path: "reel/:showId",
        element: (
          <Suspense fallback={<div className="text-sm text-slate-300">Loading route...</div>}>
            <HomeRoute />
          </Suspense>
        ),
      },
      {
        path: "show/:showId",
        element: (
          <Suspense fallback={<div className="text-sm text-slate-300">Loading route...</div>}>
            <HomeRoute />
          </Suspense>
        ),
      },
      {
        path: "admin",
        element: (
          <Suspense fallback={<div className="min-h-screen bg-disco-dark text-disco-cream p-8">Loading Admin...</div>}>
            <AdminRoute />
          </Suspense>
        ),
      },
      {
        path: "*",
        element: (
          <Suspense fallback={<div className="text-sm text-slate-300">Loading route...</div>}>
            <HomeRoute />
          </Suspense>
        ),
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
