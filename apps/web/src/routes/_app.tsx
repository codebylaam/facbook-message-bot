import { AppShell } from "@astryxdesign/core/AppShell";
import { Banner } from "@astryxdesign/core/Banner";
import { Icon, type IconType } from "@astryxdesign/core/Icon";
import { NavIcon } from "@astryxdesign/core/NavIcon";
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import {
  BeakerIcon,
  BookOpenIcon,
  ChatBubbleLeftIcon,
  Cog6ToothIcon,
  CreditCardIcon,
  CubeIcon,
  FlagIcon,
  HomeIcon,
  InboxIcon,
  RocketLaunchIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import {
  BeakerIcon as BeakerIconSolid,
  BookOpenIcon as BookOpenIconSolid,
  ChatBubbleLeftIcon as ChatBubbleLeftIconSolid,
  Cog6ToothIcon as Cog6ToothIconSolid,
  CreditCardIcon as CreditCardIconSolid,
  CubeIcon as CubeIconSolid,
  FlagIcon as FlagIconSolid,
  HomeIcon as HomeIconSolid,
  InboxIcon as InboxIconSolid,
  RocketLaunchIcon as RocketLaunchIconSolid,
} from "@heroicons/react/24/solid";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { loadSession } from "../features/auth/api.ts";
import { SignOutButton } from "../features/auth/sign-out-button.tsx";
import { billingQueryOptions } from "../features/billing/api.ts";
import { loadPages, pagesQueryOptions } from "../features/pages/api.ts";
import { needsConnectedPage } from "../lib/route-guards.ts";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    const session = await loadSession(context.queryClient);

    if (!session) {
      throw redirect({ to: "/sign-in" });
    }

    if (needsConnectedPage(location.pathname)) {
      const pages = await loadPages(context.queryClient);

      if (pages.length === 0) {
        throw redirect({ to: "/pages" });
      }
    }

    return { session };
  },
  component: AppLayout,
});

type NavItem = {
  label: string;
  href: string;
  icon: IconType;
  selectedIcon: IconType;
};

/**
 * Grouped so the rail stays scannable as destinations are added. The selected
 * state pairs an outline icon with its filled variant, which is how the rail
 * marks the current page without leaning on colour alone.
 */
const NAV_GROUPS: Array<{ title: string; isHeaderHidden?: boolean; items: NavItem[] }> = [
  {
    title: "Main",
    isHeaderHidden: true,
    items: [
      { label: "Overview", href: "/", icon: HomeIcon, selectedIcon: HomeIconSolid },
      { label: "Inbox", href: "/inbox", icon: InboxIcon, selectedIcon: InboxIconSolid },
      {
        label: "Comments",
        href: "/comments",
        icon: ChatBubbleLeftIcon,
        selectedIcon: ChatBubbleLeftIconSolid,
      },
    ],
  },
  {
    title: "Catalogue",
    items: [
      { label: "Pages", href: "/pages", icon: FlagIcon, selectedIcon: FlagIconSolid },
      { label: "Products", href: "/products", icon: CubeIcon, selectedIcon: CubeIconSolid },
      {
        label: "Knowledge",
        href: "/knowledge",
        icon: BookOpenIcon,
        selectedIcon: BookOpenIconSolid,
      },
    ],
  },
  {
    title: "Tools",
    items: [
      { label: "Playground", href: "/playground", icon: BeakerIcon, selectedIcon: BeakerIconSolid },
      {
        label: "Get live",
        href: "/onboarding",
        icon: RocketLaunchIcon,
        selectedIcon: RocketLaunchIconSolid,
      },
    ],
  },
  {
    title: "Account",
    items: [
      {
        label: "Billing",
        href: "/billing",
        icon: CreditCardIcon,
        selectedIcon: CreditCardIconSolid,
      },
      { label: "Admin", href: "/admin", icon: Cog6ToothIcon, selectedIcon: Cog6ToothIconSolid },
    ],
  },
];

function AppLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { session } = Route.useRouteContext();
  const billing = useQuery(billingQueryOptions);
  const pages = useQuery(pagesQueryOptions);

  const isAdmin = session.user.role === "admin";
  const hasPage = (pages.data?.length ?? 0) > 0;

  // A destination that needs a connected Page is noise while there is none, and
  // Admin is noise for everyone else. A group left without items disappears with it.
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.href === "/admin" && !isAdmin) {
        return false;
      }

      return hasPage || !needsConnectedPage(item.href);
    }),
  })).filter((group) => group.items.length > 0);

  return (
    <AppShell
      height="fill"
      contentPadding={0}
      variant="section"
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
      sideNav={
        <SideNav
          aria-label="Main"
          collapsible
          header={
            <SideNavHeading
              heading="FB Bot"
              icon={<NavIcon icon={<Icon icon={SparklesIcon} size="sm" />} />}
              headingHref="/"
            />
          }
          footer={<SignOutButton />}
        >
          {groups.map((group) => (
            <SideNavSection
              key={group.title}
              title={group.title}
              isHeaderHidden={group.isHeaderHidden}
            >
              {group.items.map((item) => (
                <SideNavItem
                  key={item.href}
                  label={item.label}
                  href={item.href}
                  icon={item.icon}
                  selectedIcon={item.selectedIcon}
                  isSelected={pathname === item.href}
                />
              ))}
            </SideNavSection>
          ))}
        </SideNav>
      }
    >
      <Outlet />
    </AppShell>
  );
}
