import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { Product } from "@fb-bot/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import {
  approveAllProducts,
  createProduct,
  deleteProduct,
  productsQueryOptions,
  updateProduct,
} from "../../features/knowledge/api.ts";
import { getApiErrorMessage } from "../../lib/api/errors.ts";
import { useAppForm } from "../../lib/form/index.ts";

export const Route = createFileRoute("/_app/products")({
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQueryOptions()),
  component: ProductsPage,
});

const STOCK_OPTIONS = [
  { value: "in_stock", label: "In stock" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "preorder", label: "Pre-order" },
  { value: "unknown", label: "Unknown" },
];

const priceField = z
  .number()
  .nullable()
  .refine((value) => value === null || Number.isFinite(value), "Enter a valid number")
  .refine((value) => value === null || value >= 0, "A price cannot be negative");

const productFormSchema = z.object({
  name: z.string().min(1, "A product needs a name"),
  description: z.string(),
  price: priceField,
  salePrice: priceField,
  stockStatus: z.string(),
  sizes: z.string(),
  colors: z.string(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function formatPrice(price: string | null, currency: string): string | null {
  if (price === null) {
    return null;
  }

  const amount = Number(price);

  return Number.isFinite(amount)
    ? `${amount.toLocaleString()} ${currency}`
    : `${price} ${currency}`;
}

function toDefaults(product: Product | null): ProductFormValues {
  return {
    name: product?.name ?? "",
    description: product?.description ?? "",
    price: product?.price ? Number(product.price) : null,
    salePrice: product?.salePrice ? Number(product.salePrice) : null,
    stockStatus: product?.stockStatus ?? "unknown",
    sizes: product?.variants.sizes.join(", ") ?? "",
    colors: product?.variants.colors.join(", ") ?? "",
  };
}

function ProductForm({
  product,
  pageId,
  onDone,
}: {
  product: Product | null;
  pageId: string | undefined;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      const payload = {
        name: values.name,
        description: values.description.length > 0 ? values.description : null,
        price: values.price,
        salePrice: values.salePrice,
        stockStatus: values.stockStatus as Product["stockStatus"],
        variants: { sizes: splitList(values.sizes), colors: splitList(values.colors) },
      };

      if (product) {
        return updateProduct(pageId, product.id, payload);
      }

      return createProduct(pageId, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      onDone();
    },
  });

  const form = useAppForm({
    defaultValues: toDefaults(product),
    validators: { onChange: productFormSchema, onSubmit: productFormSchema },
    onSubmit: async ({ value }) => {
      setError(null);

      try {
        await mutation.mutateAsync(value);
      } catch (thrown: unknown) {
        setError(getApiErrorMessage(thrown));
      }
    },
  });

  return (
    <Card>
      <VStack gap={4}>
        <Heading level={2}>{product ? "Edit product" : "Add a product"}</Heading>

        {error ? <Banner container="card" status="error" title={error} /> : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <VStack gap={4}>
            <form.AppField name="name">
              {(field) => <field.TextField label="Name" size="lg" />}
            </form.AppField>

            <form.AppField name="description">
              {(field) => (
                <field.TextAreaField
                  label="Description"
                  rows={3}
                  placeholder="Full sleeve cotton shirt"
                />
              )}
            </form.AppField>

            <form.AppField name="price">
              {(field) => (
                <field.NumberField label="Price (BDT)" min={0} step={10} placeholder="1200" />
              )}
            </form.AppField>

            <form.AppField name="salePrice">
              {(field) => (
                <field.NumberField label="Sale price (BDT)" min={0} step={10} placeholder="999" />
              )}
            </form.AppField>

            <form.AppField name="stockStatus">
              {(field) => <field.SelectField label="Stock" options={STOCK_OPTIONS} />}
            </form.AppField>

            <form.AppField name="sizes">
              {(field) => (
                <field.TextField
                  label="Sizes"
                  description="Comma separated, for example M, L, XL"
                />
              )}
            </form.AppField>

            <form.AppField name="colors">
              {(field) => (
                <field.TextField
                  label="Colours"
                  description="Comma separated, for example blue, black"
                />
              )}
            </form.AppField>

            <HStack align="center" gap={2}>
              <form.AppForm>
                <form.SubmitButton label={product ? "Save changes" : "Add product"} />
              </form.AppForm>
              <Button label="Cancel" size="lg" variant="secondary" onClick={onDone} />
            </HStack>
          </VStack>
        </form>
      </VStack>
    </Card>
  );
}

function ProductsPage() {
  const queryClient = useQueryClient();
  const products = useQuery(productsQueryOptions());
  const [filter, setFilter] = useState<"all" | "draft" | "active">("all");
  const [editing, setEditing] = useState<Product | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["products"] });

  const approve = useMutation({
    mutationFn: () => approveAllProducts(undefined),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (productId: string) => deleteProduct(undefined, productId),
    onSuccess: invalidate,
  });

  const all = products.data?.products ?? [];
  const drafts = all.filter((product) => product.status === "draft");
  const visible = filter === "all" ? all : all.filter((product) => product.status === filter);

  return (
    <VStack gap={6}>
      <HStack align="center" gap={3} justify="between">
        <VStack gap={1}>
          <Heading level={1}>Products</Heading>
          <Text type="supporting">The catalog the bot answers price and stock questions from.</Text>
        </VStack>
        <Button
          label="Add product"
          isDisabled={isAdding || editing !== null}
          onClick={() => setIsAdding(true)}
        />
      </HStack>

      {error ? <Banner container="card" status="error" title={error} /> : null}

      {drafts.length > 0 ? (
        <Banner
          container="card"
          status="warning"
          title={`${drafts.length} product${drafts.length === 1 ? "" : "s"} extracted from posts need a review`}
          description="Extracted products start as drafts so the bot does not quote a price the model guessed."
          endContent={
            <Button
              label="Approve all"
              size="sm"
              isLoading={approve.isPending}
              onClick={() =>
                approve.mutate(undefined, {
                  onError: (thrown: unknown) => setError(getApiErrorMessage(thrown)),
                })
              }
            />
          }
        />
      ) : null}

      {isAdding || editing ? (
        <ProductForm
          key={editing?.id ?? "new"}
          product={editing}
          pageId={undefined}
          onDone={() => {
            setIsAdding(false);
            setEditing(null);
          }}
        />
      ) : null}

      <HStack align="center" gap={2}>
        {(["all", "draft", "active"] as const).map((option) => (
          <Button
            key={option}
            label={option === "all" ? "All" : option === "draft" ? "Drafts" : "Active"}
            size="sm"
            variant={filter === option ? "primary" : "secondary"}
            onClick={() => setFilter(option)}
          />
        ))}
      </HStack>

      {visible.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="Add products by hand, or connect a Page and let the bot extract them from your posts."
          actions={<Button label="Add product" onClick={() => setIsAdding(true)} />}
        />
      ) : (
        <VStack gap={2}>
          {visible.map((product) => {
            const price = formatPrice(product.price, product.currency);
            const salePrice = formatPrice(product.salePrice, product.currency);

            return (
              <Card key={product.id}>
                <HStack align="center" gap={3} justify="between">
                  <VStack gap={1}>
                    <Text type="label">{product.name}</Text>
                    <Text type="supporting">
                      {price ?? "No price"}
                      {salePrice ? ` · sale ${salePrice}` : ""}
                    </Text>
                    <HStack align="center" gap={2}>
                      <Badge
                        label={product.status === "draft" ? "Draft" : "Active"}
                        variant={product.status === "draft" ? "warning" : "success"}
                      />
                      <Badge
                        label={product.source === "extracted" ? "From post" : "Manual"}
                        variant={product.source === "extracted" ? "info" : "neutral"}
                      />
                    </HStack>
                  </VStack>

                  <HStack align="center" gap={2}>
                    <Button
                      label="Edit"
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditing(product)}
                    />
                    <Button
                      label="Delete"
                      size="sm"
                      variant="secondary"
                      isLoading={remove.isPending}
                      onClick={() =>
                        remove.mutate(product.id, {
                          onError: (thrown: unknown) => setError(getApiErrorMessage(thrown)),
                        })
                      }
                    />
                  </HStack>
                </HStack>
              </Card>
            );
          })}
        </VStack>
      )}
    </VStack>
  );
}
