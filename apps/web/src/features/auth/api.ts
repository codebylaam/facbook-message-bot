import type { SignInInput, SignUpInput } from "@fb-bot/shared";
import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { api } from "../../lib/api/client.ts";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type Session = {
  session: {
    id: string;
    expiresAt: string;
  };
  user: SessionUser;
};

export const sessionQueryOptions = queryOptions({
  queryKey: ["session"] as const,
  staleTime: 0,
  queryFn: async (): Promise<Session | null> => {
    const response = await api.get<Session | null>("/api/auth/get-session");
    return response.data;
  },
});

export async function loadSession(queryClient: QueryClient): Promise<Session | null> {
  try {
    return await queryClient.fetchQuery(sessionQueryOptions);
  } catch (error) {
    console.error("[web] could not load the session", error);
    return null;
  }
}

export async function signIn(input: SignInInput): Promise<Session> {
  const response = await api.post<Session>("/api/auth/sign-in/email", input);
  return response.data;
}

export async function signUp(input: SignUpInput): Promise<Session> {
  const response = await api.post<Session>("/api/auth/sign-up/email", input);
  return response.data;
}

export async function signOut(): Promise<void> {
  await api.post("/api/auth/sign-out");
}
