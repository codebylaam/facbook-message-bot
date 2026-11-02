import { AppShell } from "@astryxdesign/core/AppShell";
import { Banner } from "@astryxdesign/core/Banner";
import { TopNav, TopNavHeading, TopNavItem } from "@astryxdesign/core/TopNav";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { loadSession } from "../features/auth/api.ts";
import { SignOutButton } from "../features/auth/sign-out-button.tsx";
import { billingQueryOptions } from "../features/billing/api.ts";
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

const NAV_ITEMS = [
  { label: "Overview", href: "/" },
  { label: "Pages", href: "/pages" },
  { label: "Products", href: "/products" },
  { label: "Knowledge", href: "/knowledge" },
  { label: "Inbox", href: "/inbox" },
  { label: "Comments", href: "/comments" },
  { label: "Playground", href: "/playground" },
  { label: "Get live", href: "/onboarding" },
  { label: "Billing", href: "/billing" },
  { label: "Admin", href: "/admin" },
] as const;

function AppLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { session } = Route.useRouteContext();
  const billing = useQuery(billingQueryOptions);

  const isAdmin = session.user.role === "admin";
  const items = NAV_ITEMS.filter((item) => item.href !== "/admin" || isAdmin);

  return (
    <AppShell
      height="auto"
      contentPadding={4}
      banner={
        billing.data?.paused ? (
          <Banner
            container="section"
            status="error"
            title={`AI replies are paused: ${billing.data.used} of ${billing.data.aiRepliesPerMonth} used this month`}
            description="The bot hands every new message to you until the plan is raised."
          />
        ) : null
      }
      topNav={
        <TopNav
          heading={<TopNavHeading as={RouterLink} heading="FB Bot" headingHref="/" />}
          startContent={items.map((item) => (
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
