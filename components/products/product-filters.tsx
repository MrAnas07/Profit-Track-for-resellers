"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebouncedCallback } from "@/hooks/use-debounce";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category, ProductStatus, SupplierGroup } from "@/types";

export const ALL_VALUE = "__all__";

const STATUS_FILTERS: { value: ProductStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "available", label: "Available" },
  { value: "pending", label: "Pending" },
  { value: "sold", label: "Sold" },
];

export function ProductFilters({
  suppliers,
  categories,
  supplierFilter,
  categoryFilter,
  onSupplierChange,
  onCategoryChange,
  resultCount,
}: {
  suppliers: SupplierGroup[];
  categories: Category[];
  supplierFilter: string;
  categoryFilter: string;
  onSupplierChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  resultCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = searchParams.get("q") ?? "";
  const status = (searchParams.get("status") ?? "all") as ProductStatus | "all";
  const [localQuery, setLocalQuery] = useState(query);

  useEffect(() => {
    setLocalQuery(query);
  }, [query]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, {
      scroll: false,
    });
  };

  const applyQuery = useDebouncedCallback((value: string) => setParam("q", value), 300);

  const hasFilters =
    query !== "" ||
    status !== "all" ||
    supplierFilter !== "" ||
    categoryFilter !== "";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={localQuery}
            onChange={(event) => {
              setLocalQuery(event.target.value);
              applyQuery(event.target.value);
            }}
            placeholder="Search name, details or supplier…"
            aria-label="Search products"
            className="pl-9"
          />
          {localQuery ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setLocalQuery("");
                setParam("q", "");
              }}
              className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:flex">
          <Select value={supplierFilter || ALL_VALUE} onValueChange={onSupplierChange}>
            <SelectTrigger className="sm:w-48" aria-label="Filter by supplier group">
              <SelectValue placeholder="Supplier group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All supplier groups</SelectItem>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={String(supplier.id)}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryFilter || ALL_VALUE} onValueChange={onCategoryChange}>
            <SelectTrigger className="sm:w-40" aria-label="Filter by category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((option) => {
          const active = status === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                setParam("status", option.value === "all" ? "" : option.value)
              }
              aria-pressed={active}
              className={`cursor-pointer rounded-full px-4 py-2.5 text-xs font-semibold ring-1 ring-inset transition ${
                active
                  ? "bg-foreground text-background ring-foreground"
                  : "bg-card text-muted-foreground ring-border hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          );
        })}

        <span className="ml-auto text-xs font-medium text-muted-foreground">
          {resultCount} {resultCount === 1 ? "product" : "products"}
        </span>

        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1 px-3 text-xs"
            onClick={() => {
              router.replace(pathname, { scroll: false });
              onSupplierChange("");
              onCategoryChange("");
            }}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}
