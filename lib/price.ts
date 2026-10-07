import type { PriceOption, Product } from "@/types";
import { money } from "./format";

export function newOptionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `opt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createOption(
  overrides: Partial<PriceOption> = {},
): PriceOption {
  return {
    id: newOptionId(),
    name: "",
    costPrice: 0,
    sellPrice: 0,
    ...overrides,
  };
}

export function optionLabel(name: string): string {
  return name.trim() || "Standard";
}

export function optionProfit(option: PriceOption): number {
  return option.sellPrice - option.costPrice;
}

export function sortedOptions(product: Product): PriceOption[] {
  return product.priceOptions ?? [];
}

export function minBy(
  options: PriceOption[],
  pick: (option: PriceOption) => number,
): number {
  if (options.length === 0) return 0;
  return Math.min(...options.map(pick));
}

export function maxBy(
  options: PriceOption[],
  pick: (option: PriceOption) => number,
): number {
  if (options.length === 0) return 0;
  return Math.max(...options.map(pick));
}

export function isMultiOption(product: Product): boolean {
  return (product.priceOptions?.length ?? 0) > 1;
}

/** Single option -> "Rs. X", multiple -> "From Rs. X" */
export function sellPriceLabel(product: Product): string {
  const options = product.priceOptions ?? [];
  if (options.length <= 1) return money(options[0]?.sellPrice ?? 0);
  return `From ${money(minBy(options, (o) => o.sellPrice))}`;
}

/** Single option -> "Rs. X", multiple -> "From Rs. X" */
export function costPriceLabel(product: Product): string {
  const options = product.priceOptions ?? [];
  if (options.length <= 1) return money(options[0]?.costPrice ?? 0);
  return `From ${money(minBy(options, (o) => o.costPrice))}`;
}

/** Smallest per-unit profit across options (for "From" display). */
export function profitFromLabel(product: Product): number {
  const options = product.priceOptions ?? [];
  if (options.length === 0) return 0;
  if (options.length === 1) return optionProfit(options[0]);
  return minBy(options, optionProfit);
}
