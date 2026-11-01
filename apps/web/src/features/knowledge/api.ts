import type {
  CreateFaqInput,
  CreatePolicyInput,
  CreateProductInput,
  Faq,
  KnowledgeSummary,
  Policy,
  Post,
  Product,
  UpdateProductInput,
} from "@fb-bot/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "../../lib/api/client.ts";

function params(pageId?: string) {
  return pageId ? { pageId } : undefined;
}

function scope(pageId?: string) {
  return pageId ?? null;
}

export const productsQueryOptions = (pageId?: string) =>
  queryOptions({
    queryKey: ["products", scope(pageId)] as const,
    queryFn: async (): Promise<{ pageId: string; products: Product[] }> => {
      const response = await api.get<{ pageId: string; products: Product[] }>("/api/products", {
        params: params(pageId),
      });
      return response.data;
    },
  });

export const faqsQueryOptions = (pageId?: string) =>
  queryOptions({
    queryKey: ["faqs", scope(pageId)] as const,
    queryFn: async (): Promise<{ pageId: string; faqs: Faq[] }> => {
      const response = await api.get<{ pageId: string; faqs: Faq[] }>("/api/faqs", {
        params: params(pageId),
      });
      return response.data;
    },
  });

export const policiesQueryOptions = (pageId?: string) =>
  queryOptions({
    queryKey: ["policies", scope(pageId)] as const,
    queryFn: async (): Promise<{ pageId: string; policies: Policy[] }> => {
      const response = await api.get<{ pageId: string; policies: Policy[] }>("/api/policies", {
        params: params(pageId),
      });
      return response.data;
    },
  });

export const postsQueryOptions = (pageId?: string) =>
  queryOptions({
    queryKey: ["posts", scope(pageId)] as const,
    queryFn: async (): Promise<{ pageId: string; posts: Post[] }> => {
      const response = await api.get<{ pageId: string; posts: Post[] }>("/api/posts", {
        params: params(pageId),
      });
      return response.data;
    },
  });

export const knowledgeSummaryQueryOptions = (pageId?: string) =>
  queryOptions({
    queryKey: ["knowledge-summary", scope(pageId)] as const,
    queryFn: async (): Promise<KnowledgeSummary> => {
      const response = await api.get<KnowledgeSummary>("/api/knowledge", {
        params: params(pageId),
      });
      return response.data;
    },
  });

export async function createProduct(pageId: string | undefined, input: CreateProductInput) {
  const response = await api.post<{ product: Product }>("/api/products", input, {
    params: params(pageId),
  });
  return response.data.product;
}

export async function updateProduct(
  pageId: string | undefined,
  productId: string,
  input: UpdateProductInput,
) {
  const response = await api.patch<{ product: Product }>(`/api/products/${productId}`, input, {
    params: params(pageId),
  });
  return response.data.product;
}

export async function deleteProduct(pageId: string | undefined, productId: string) {
  await api.delete(`/api/products/${productId}`, { params: params(pageId) });
}

export async function approveAllProducts(pageId: string | undefined) {
  const response = await api.post<{ approved: number }>("/api/products/approve-all", undefined, {
    params: params(pageId),
  });
  return response.data.approved;
}

export async function createFaq(pageId: string | undefined, input: CreateFaqInput) {
  const response = await api.post<{ faq: Faq }>("/api/faqs", input, { params: params(pageId) });
  return response.data.faq;
}

export async function deleteFaq(pageId: string | undefined, faqId: string) {
  await api.delete(`/api/faqs/${faqId}`, { params: params(pageId) });
}

export async function createPolicy(pageId: string | undefined, input: CreatePolicyInput) {
  const response = await api.post<{ policy: Policy }>("/api/policies", input, {
    params: params(pageId),
  });
  return response.data.policy;
}

export async function deletePolicy(pageId: string | undefined, policyId: string) {
  await api.delete(`/api/policies/${policyId}`, { params: params(pageId) });
}

export async function setPostIncluded(
  pageId: string | undefined,
  postId: string,
  included: boolean,
) {
  const response = await api.patch<{ post: Post }>(
    `/api/posts/${postId}`,
    { included },
    { params: params(pageId) },
  );
  return response.data.post;
}

export async function resyncPage(pageId: string) {
  await api.post(`/api/pages/${pageId}/resync`);
}
