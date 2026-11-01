import { AppShell } from "@astryxdesign/core/AppShell";
import { Badge } from "@astryxdesign/core/Badge";
import { TopNav, TopNavHeading, TopNavItem } from "@astryxdesign/core/TopNav";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet, useRouterState } from "@tanstack/react-router";
import { RouterLink } from "../lib/router-link.tsx";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
});

const NAV_ITEMS = [{ label: "Overview", href: "/" }] as const;

function RootLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <AppShell
      height="auto"
      contentPadding={4}
      topNav={
        <TopNav
          heading={<TopNavHeading as={RouterLink} heading="FB Bot" headingHref="/" />}
          startContent={NAV_ITEMS.map((item) => (
            <TopNavItem
              key={item.href}
              as={RouterLink}
              href={item.href}
              isSelected={pathname === item.href}
              label={item.label}
            />
          ))}
          endContent={<Badge label="Foundation" variant="neutral" />}
        />
      }
    >
      <Outlet />
    </AppShell>
  );
}
