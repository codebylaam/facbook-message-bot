import type { AdminUser, BillingSummary, Plan } from "@fb-bot/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "../../lib/api/client.ts";

export const billingQueryOptions = queryOptions({
  queryKey: ["billing"] as const,
  queryFn: async (): Promise<BillingSummary> => {
    const response = await api.get<BillingSummary>("/api/billing");
    return response.data;
  },
});

export const adminUsersQueryOptions = queryOptions({
  queryKey: ["admin", "users"] as const,
  queryFn: async (): Promise<AdminUser[]> => {
    const response = await api.get<{ users: AdminUser[] }>("/api/admin/users");
    return response.data.users;
  },
});

export const adminPlansQueryOptions = queryOptions({
  queryKey: ["admin", "plans"] as const,
  queryFn: async (): Promise<Plan[]> => {
    const response = await api.get<{ plans: Plan[] }>("/api/admin/plans");
    return response.data.plans;
  },
});

export async function assignPlan(userId: string, planName: string, months = 1) {
  await api.post(`/api/admin/users/${userId}/subscription`, { planName, months });
}

export async function setUserRole(userId: string, role: "seller" | "admin") {
  await api.patch(`/api/admin/users/${userId}/role`, { role });
}

export async function deleteAccount() {
  await api.delete("/api/account");
}
