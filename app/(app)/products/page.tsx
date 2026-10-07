"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PackagePlus, PackageSearch, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, CardSkeleton, EmptyState } from "@/components/shared/shared";
import { ProductFilters, ALL_VALUE } from "@/components/products/product-filters";
import { ProductList } from "@/components/products/product-list";
import { Button } from "@/components/ui/button";
import type { Product } from "@/types";
import { useProductDialog } from "@/components/providers/app-providers";
import { useData } from "@/components/providers/data-provider";

export default function ProductsPage() {
  return (
    <Suspense fallback={<CardSkeleton rows={5} />}>
      <ProductsContent />
    </Suspense>
  );
}

function ProductsContent() {
  const router = useRouter();
  const { openDialog } = useProductDialog();
  const searchParams = useSearchParams();
  const [supplierFilter, setSupplierFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const {
    supplierGroups: suppliers,
    categories,
    products,
    loading,
    deleteProduct,
  } = useData();

  const supplierById = useMemo(
    () => new Map((suppliers ?? []).map((supplier) => [supplier.id!, supplier])),
    [suppliers],
  );
  const categoryById = useMemo(
    () => new Map((categories ?? []).map((category) => [category.id!, category])),
    [categories],
  );

  const query = (searchParams.get("q") ?? "").trim().toLowerCase();
  const status = searchParams.get("status") ?? "all";

  const filtered = useMemo(() => {
    return (products ?? []).filter((product: Product) => {
      if (status !== "all" && product.status !== status) return false;
      if (supplierFilter && product.supplierGroupId !== Number(supplierFilter))
        return false;
      if (categoryFilter && product.categoryId !== Number(categoryFilter))
        return false;
      if (!query) return true;
      const supplierName =
        supplierById.get(product.supplierGroupId)?.name.toLowerCase() ?? "";
      return (
        product.name.toLowerCase().includes(query) ||
        product.details.toLowerCase().includes(query) ||
        supplierName.includes(query)
      );
    });
  }, [products, status, supplierFilter, categoryFilter, query, supplierById]);

  const removeProduct = async (product: Product) => {
    if (product.id == null) return;
    try {
      await deleteProduct(product.id);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Could not delete product.",
      );
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader
          title="Products"
          description="Everything you have bought from supplier groups."
        />
        <CardSkeleton rows={5} />
      </>
    );
  }

  if ((products ?? []).length === 0) {
    return (
      <>
        <PageHeader
          title="Products"
          description="Everything you have bought from supplier groups."
        />
        <EmptyState
          icon={<PackagePlus className="h-6 w-6" />}
          title="No products yet"
          description={
            (suppliers ?? []).length === 0
              ? "Add your WhatsApp supplier groups first, then start logging products with their cost prices."
              : "Log your first product with cost price, sell price and supplier group — ProfitTrack remembers the profit for you."
          }
          actionLabel={
            (suppliers ?? []).length === 0 ? "Add supplier groups" : "Add product"
          }
          onAction={() =>
            (suppliers ?? []).length === 0 ? router.push("/suppliers") : openDialog()
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Products"
        description="Search, filter and share your stock — synced to your account."
      >
        <Button onClick={() => openDialog()}>
          <PackagePlus className="h-4 w-4" />
          Add product
        </Button>
      </PageHeader>

      <div className="space-y-4">
        <ProductFilters
          suppliers={suppliers ?? []}
          categories={categories ?? []}
          supplierFilter={supplierFilter === ALL_VALUE ? "" : supplierFilter}
          categoryFilter={categoryFilter === ALL_VALUE ? "" : categoryFilter}
          onSupplierChange={(value) =>
            setSupplierFilter(value === ALL_VALUE ? "" : value)
          }
          onCategoryChange={(value) =>
            setCategoryFilter(value === ALL_VALUE ? "" : value)
          }
          resultCount={filtered.length}
        />

        {filtered.length === 0 ? (
          <EmptyState
            icon={<PackageSearch className="h-6 w-6" />}
            title="No matching products"
            description="Try a different search term or clear the filters to see your full stock list."
          />
        ) : (
          <ProductList
            products={filtered}
            supplierById={supplierById}
            categoryById={categoryById}
            onEdit={(product) => openDialog(product)}
            onDelete={(product) => void removeProduct(product)}
          />
        )}
      </div>

      {(suppliers ?? []).length === 0 ? (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
          <Users className="h-4 w-4 shrink-0" />
          <span>
            Products need a supplier group.{" "}
            <a href="/suppliers" className="font-semibold underline underline-offset-2">
              Add your groups
            </a>
          </span>
        </div>
      ) : null}
    </>
  );
}
