"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRight,
  Boxes,
  PackageCheck,
  PackagePlus,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, EmptyState, MetricSkeleton, CardSkeleton } from "@/components/shared/shared";
import { StatusBadge } from "@/components/products/status-badge";
import { ShareButton } from "@/components/products/share-button";
import { money, relativeTime } from "@/lib/format";
import {
  isMultiOption,
  profitFromLabel,
  sellPriceLabel,
} from "@/lib/price";
import type { Product } from "@/types";
import { useProductDialog } from "@/components/providers/app-providers";
import { useData } from "@/components/providers/data-provider";

interface Metrics {
  investment: number;
  expectedProfit: number;
  availableUnits: number;
  soldUnits: number;
  realizedProfit: number;
}

function computeMetrics(products: Product[]): Metrics {
  const metrics: Metrics = {
    investment: 0,
    expectedProfit: 0,
    availableUnits: 0,
    soldUnits: 0,
    realizedProfit: 0,
  };

  for (const product of products) {
    const options = product.priceOptions ?? [];
    if (product.status === "available") {
      for (const option of options) {
        metrics.investment += option.costPrice * product.quantity;
        metrics.expectedProfit +=
          (option.sellPrice - option.costPrice) * product.quantity;
      }
      metrics.availableUnits += product.quantity;
    } else if (product.status === "sold") {
      metrics.soldUnits += product.quantity;
      for (const option of options) {
        metrics.realizedProfit +=
          (option.sellPrice - option.costPrice) * product.quantity;
      }
    }
  }

  return metrics;
}

const CARDS = (metrics: Metrics) => [
  {
    key: "investment",
    label: "Total Investment",
    value: money(metrics.investment),
    sublabel: "Cost of available stock in hand",
    icon: Wallet,
    tone: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400",
  },
  {
    key: "profit",
    label: "Expected Profit",
    value: money(metrics.expectedProfit),
    sublabel: "From all available items",
    icon: TrendingUp,
    tone: "text-violet-600 bg-violet-500/10 dark:text-violet-400",
  },
  {
    key: "available",
    label: "Available Items",
    value: String(metrics.availableUnits),
    sublabel: "Units ready to sell",
    icon: Boxes,
    tone: "text-blue-600 bg-blue-500/10 dark:text-blue-400",
  },
  {
    key: "sold",
    label: "Sold Items",
    value: String(metrics.soldUnits),
    sublabel: `Realised profit ${money(metrics.realizedProfit)}`,
    icon: PackageCheck,
    tone: "text-amber-600 bg-amber-500/10 dark:text-amber-400",
  },
];

export function Dashboard() {
  const { openDialog } = useProductDialog();

  const {
    products,
    supplierGroups: suppliers,
    categories,
    loading,
  } = useData();

  const ready = !loading;

  const supplierById = useMemo(
    () => new Map((suppliers ?? []).map((supplier) => [supplier.id!, supplier])),
    [suppliers],
  );
  const categoryById = useMemo(
    () => new Map((categories ?? []).map((category) => [category.id!, category])),
    [categories],
  );

  const metrics = useMemo(() => computeMetrics(products ?? []), [products]);
  const recent = useMemo(
    () =>
      [...(products ?? [])]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 6),
    [products],
  );

  if (!ready) {
    return (
      <>
        <PageHeader title="Dashboard" description="Your reselling business at a glance." />
        <MetricSkeleton />
        <div className="mt-6">
          <CardSkeleton rows={3} />
        </div>
      </>
    );
  }

  const totalProducts = products?.length ?? 0;
  const noSuppliers = (suppliers ?? []).length === 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your reselling business at a glance — synced to your ProfitTrack account."
      >
        <Button onClick={() => openDialog()}>
          <PackagePlus className="h-4 w-4" />
          Add product
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {CARDS(metrics).map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06, duration: 0.35, ease: "easeOut" }}
            >
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {card.label}
                    </p>
                    <span className={`shrink-0 rounded-lg p-1.5 sm:p-2 ${card.tone}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-2.5 text-[17px] font-bold tracking-tight tabular-nums text-foreground sm:mt-3 sm:text-2xl">
                    {card.value}
                  </p>
                  <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                    {card.sublabel}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {noSuppliers ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-500/20 dark:bg-emerald-500/10"
        >
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                Add your WhatsApp supplier groups first
              </p>
              <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                Every product must be linked to the group you bought it from.
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link href="/suppliers">
              Add groups
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
      ) : null}

      <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Recent products</CardTitle>
              {totalProducts > 0 ? (
                <CardAction>
                  <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                    <Link href="/products">
                      View all
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardAction>
              ) : null}
            </CardHeader>
          <CardContent className="pb-5">
            {totalProducts === 0 ? (
              <EmptyState
                icon={<PackagePlus className="h-6 w-6" />}
                title="No products yet"
                description="Add your first product with cost and sell price — profit is calculated automatically."
                actionLabel="Add product"
                onAction={() => openDialog()}
              />
            ) : (
              <ul className="divide-y divide-border">
                {recent.map((product) => {
                  const supplier = supplierById.get(product.supplierGroupId);
                  const category = product.categoryId
                    ? categoryById.get(product.categoryId)
                    : undefined;
                  const multi = isMultiOption(product);
                  const profit = profitFromLabel(product);
                  return (
                    <li
                      key={product.id}
                      className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors first:pt-1 last:pb-1 hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {product.name}
                          </p>
                          <StatusBadge status={product.status} />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {supplier?.name ?? "Unknown supplier"}
                          {category ? ` · ${category.name}` : ""} ·{" "}
                          {relativeTime(product.updatedAt)}
                        </p>
                        <p className="mt-1 text-xs font-semibold sm:hidden">
                          <span className="text-foreground tabular-nums">
                            {sellPriceLabel(product)}
                          </span>
                          <span
                            className={
                              profit >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                            }
                          >
                            {" · "}
                            {profit >= 0 ? "+" : ""}
                            {money(profit)}
                          </span>
                        </p>
                      </div>
                      <div className="hidden text-right sm:block">
                        <p className="text-sm font-semibold text-foreground tabular-nums">
                          {sellPriceLabel(product)}
                        </p>
                        <p
                          className={`text-xs font-semibold ${
                            profit >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {profit >= 0 ? "+" : ""}
                          {money(profit)} {multi ? "/ unit from" : "/ unit"}
                        </p>
                      </div>
                      <ShareButton
                        variant="share"
                        product={product}
                        supplier={supplier}
                        category={category ?? null}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
