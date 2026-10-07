"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/products/status-badge";
import { ShareButton } from "@/components/products/share-button";
import type { Category, Product, SupplierGroup } from "@/types";
import { money, relativeTime } from "@/lib/format";
import {
  costPriceLabel,
  isMultiOption,
  profitFromLabel,
  sellPriceLabel,
} from "@/lib/price";

export interface ProductListProps {
  products: Product[];
  supplierById: Map<number, SupplierGroup>;
  categoryById: Map<number, Category>;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

function Profit({ value, suffix = "" }: { value: number; suffix?: string }) {
  return (
    <span
      className={`font-semibold ${
        value >= 0
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400"
      }`}
    >
      {value >= 0 ? "+" : ""}
      {money(value)}
      {suffix}
    </span>
  );
}

/** Mobile cards show "Rs. 43,000" instead of "From Rs. 43,000" (the "+N more" hint covers it). */
function compactPrice(label: string) {
  return label.replace(/^From\s+/, "");
}

export function ProductList({
  products,
  supplierById,
  categoryById,
  onEdit,
  onDelete,
}: ProductListProps) {
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const name = pendingDelete.name;
    onDelete(pendingDelete);
    setPendingDelete(null);
    toast.success(`${name} deleted`);
  };

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-xs md:block">
        <Table>
          <TableHeader className="[&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Product</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Sell</TableHead>
              <TableHead className="text-right">Profit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Qty</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => {
              const supplier = supplierById.get(product.supplierGroupId);
              const category = product.categoryId
                ? categoryById.get(product.categoryId)
                : undefined;
              const multi = isMultiOption(product);
              const extraOptions = Math.max(
                0,
                (product.priceOptions?.length ?? 1) - 1,
              );
              const profit = profitFromLabel(product);
              return (
                <TableRow
                  key={product.id}
                  className="cursor-pointer"
                  onClick={() => onEdit(product)}
                >
                  <TableCell className="max-w-64">
                    <p className="truncate font-semibold text-foreground">
                      {product.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {product.details || "No details"} · {relativeTime(product.updatedAt)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium text-foreground">
                      {supplier?.name ?? "Unknown"}
                    </p>
                    {category ? (
                      <span className="mt-0.5 inline-block rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {category.name}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {costPriceLabel(product)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold text-foreground">
                    {sellPriceLabel(product)}
                    {multi ? (
                      <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">
                        +{extraOptions} more
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    <Profit value={profit} />
                    <span className="ml-1 text-xs text-muted-foreground">
                      {multi ? "/ unit from" : "/ unit"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={product.status} />
                  </TableCell>
                  <TableCell className="text-center text-sm font-medium">
                    {product.quantity}
                  </TableCell>
                  <TableCell className="text-right">
                    <div
                      className="flex items-center justify-end gap-1.5"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <ShareButton
                        product={product}
                        supplier={supplier}
                        category={category ?? null}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Actions for ${product.name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(product)}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setPendingDelete(product)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="grid gap-3 md:hidden">
        {products.map((product) => {
          const supplier = supplierById.get(product.supplierGroupId);
          const category = product.categoryId
            ? categoryById.get(product.categoryId)
            : undefined;
          const multi = isMultiOption(product);
          const extraOptions = Math.max(
            0,
            (product.priceOptions?.length ?? 1) - 1,
          );
          const profit = profitFromLabel(product);
          return (
            <article
              key={product.id}
              onClick={() => onEdit(product)}
              className="cursor-pointer rounded-2xl border border-border bg-card p-4 shadow-xs transition hover:shadow-md active:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-foreground">
                    {product.name}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {supplier?.name ?? "Unknown supplier"}
                    {category ? ` · ${category.name}` : ""}
                  </p>
                </div>
                <StatusBadge status={product.status} />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-muted/60 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Cost
                  </p>
                  <p className="mt-0.5 truncate text-[13px] font-medium tabular-nums text-muted-foreground">
                    {compactPrice(costPriceLabel(product))}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Sell
                  </p>
                  <p className="mt-0.5 truncate text-[13px] font-semibold tabular-nums text-foreground">
                    {compactPrice(sellPriceLabel(product))}
                  </p>
                  {multi ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      +{extraOptions} more
                    </p>
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Profit
                  </p>
                  <p className="mt-0.5 truncate text-[13px] tabular-nums">
                    <Profit value={profit} />
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  Qty <span className="font-semibold text-foreground">{product.quantity}</span>
                </span>
                <div className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${product.name}`}
                    onClick={() => onEdit(product)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    aria-label={`Delete ${product.name}`}
                    onClick={() => setPendingDelete(product)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <ShareButton
                    variant="share"
                    product={product}
                    supplier={supplier}
                    category={category ?? null}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.name}” and its price history will be permanently
              removed from your ProfitTrack account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
