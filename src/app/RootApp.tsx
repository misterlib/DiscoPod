import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider, type ConvexAuthApi } from "@convex-dev/auth/react";
import { Outlet } from "react-router-dom";
import { api } from "../convexApi";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function RootApp() {
  const content = (
    <div className="relative min-h-screen min-h-[100dvh] h-full w-full bg-disco-dark text-disco-cream antialiased selection:bg-disco-rose selection:text-white">
      {!convexClient ? (
        <div className="pointer-events-none fixed top-3 right-3 z-50">
          <div className="pointer-events-auto rounded-full border border-disco-caramel/40 bg-disco-dark/80 px-3 py-1 text-xs text-disco-cream/80 backdrop-blur-md shadow-lg">
            Offline Demo Mode (No Convex URL)
          </div>
        </div>
      ) : null}
      <Outlet />
    </div>
  );

  if (!convexClient) {
    return content;
  }

  return (
    <ConvexAuthProvider
      client={convexClient}
      api={{
        refreshSession: api.auth.refreshSession as ConvexAuthApi["refreshSession"],
        signOut: api.auth.signOut,
      }}
    >
      {content}
    </ConvexAuthProvider>
  );
}

