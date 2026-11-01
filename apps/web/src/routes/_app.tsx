import { AppShell } from "@astryxdesign/core/AppShell";
import { TopNav, TopNavHeading, TopNavItem } from "@astryxdesign/core/TopNav";
import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { loadSession } from "../features/auth/api.ts";
import { SignOutButton } from "../features/auth/sign-out-button.tsx";
import { RouterLink } from "../lib/router-link.tsx";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context }) => {
    const session = await loadSession(context.queryClient);

    if (!session) {
      throw redirect({ to: "/sign-in" });
    }

    return { session };
  },
  component: AppLayout,
});

const NAV_ITEMS = [{ label: "Overview", href: "/" }] as const;

function AppLayout() {
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
          endContent={<SignOutButton />}
        />
      }
    >
      <Outlet />
    </AppShell>
  );
}
