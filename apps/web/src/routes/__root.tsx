import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { RouterContext } from "../lib/router-context.ts";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return <Outlet />;
}
