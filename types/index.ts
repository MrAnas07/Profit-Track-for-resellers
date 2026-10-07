export type ProductStatus = "available" | "pending" | "sold";

export interface SupplierGroup {
  id?: number;
  name: string;
  createdAt: number;
}

export interface Category {
  id?: number;
  name: string;
  createdAt: number;
}

export interface PriceOption {
  id: string;
  name: string;
  costPrice: number;
  sellPrice: number;
}

export interface PriceChange {
  at: number;
  optionId: string;
  optionName: string;
  costPrice: number;
  sellPrice: number;
}

export interface Product {
  id?: number;
  name: string;
  details: string;
  priceOptions: PriceOption[];
  status: ProductStatus;
  quantity: number;
  supplierGroupId: number;
  categoryId?: number | null;
  createdAt: number;
  updatedAt: number;
  priceHistory: PriceChange[];
  /** Raw WhatsApp message the product was extracted from (if any). */
  originalMessage?: string | null;
}

export interface ProductDraft {
  name: string;
  details: string;
  priceOptions: PriceOption[];
  status: ProductStatus;
  quantity: number;
  supplierGroupId: number;
  categoryId?: number | null;
  originalMessage?: string | null;
}

export interface BackupFile {
  app: "profittrack";
  version: 1;
  exportedAt: number;
  supplierGroups: SupplierGroup[];
  categories: Category[];
  products: Product[];
}

/**
 * Normalized backup payload that server actions accept for restore/import.
 * `oldId` fields are remapped to fresh IDs inside the import transaction.
 */
export interface NormalizedBackup {
  supplierGroups: Array<{ oldId: number | null; name: string; createdAt: number }>;
  categories: Array<{ oldId: number | null; name: string; createdAt: number }>;
  products: Array<{
    name: string;
    details: string;
    priceOptions: PriceOption[];
    status: ProductStatus;
    quantity: number;
    oldSupplierId: number | null;
    oldCategoryId: number | null;
    createdAt: number;
    updatedAt: number;
    originalMessage: string | null;
    priceHistory: PriceChange[];
  }>;
}

/** Everything the client needs in one round trip. */
export interface BootstrapData {
  supplierGroups: SupplierGroup[];
  categories: Category[];
  products: Product[];
}

/** Payload for creating/updating products (history computed client-side). */
export interface ProductInput {
  name: string;
  details: string;
  priceOptions: PriceOption[];
  status: ProductStatus;
  quantity: number;
  supplierGroupId: number;
  categoryId: number | null;
  originalMessage: string | null;
  priceHistory: PriceChange[];
  createdAt?: number;
}

/** Restore/import counts returned by the restoreBackupData action. */
export interface RestoreResult {
  suppliers: number;
  categories: number;
  products: number;
}

/**
 * Server actions return this instead of throwing so production builds can
 * still show meaningful error messages (Next.js masks thrown errors in prod).
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const DEFAULT_CATEGORIES = [
  "Electronics",
  "Fashion",
  "Home",
  "Beauty",
  "Kids",
  "Other",
] as const;

export const STATUS_META: Record<
  ProductStatus,
  { label: string; badge: string }
> = {
  available: {
    label: "Available",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20",
  },
  pending: {
    label: "Pending",
    badge: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-400/20",
  },
  sold: {
    label: "Sold",
    badge: "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-400/20",
  },
};
