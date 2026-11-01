import { LinkProvider } from "@astryxdesign/core/Link";
import { Theme } from "@astryxdesign/core/theme";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { defaultThemeSlug, themes } from "./astryx-themes.ts";
import { queryClient } from "./lib/query/client.ts";
import { RouterLink } from "./lib/router-link.tsx";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <Theme theme={themes[defaultThemeSlug]} mode="system">
      <LinkProvider component={RouterLink}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </LinkProvider>
    </Theme>
  );
}
