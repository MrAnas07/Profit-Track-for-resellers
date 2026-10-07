import { newOptionId } from "./price";
import type {
  BackupFile,
  Category,
  NormalizedBackup,
  PriceOption,
  Product,
  ProductStatus,
  SupplierGroup,
} from "@/types";

const STATUSES: ProductStatus[] = ["available", "pending", "sold"];

const CSV_HEADERS = [
  "Name",
  "Details",
  "Option",
  "Cost Price",
  "Sell Price",
  "Profit",
  "Status",
  "Quantity",
  "Supplier Group",
  "Category",
  "Created At",
  "Updated At",
];

function escapeCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportProductsCsv(
  products: Product[],
  suppliers: SupplierGroup[],
  categories: Category[],
): void {
  const supplierById = new Map(suppliers.map((s) => [s.id, s.name]));
  const categoryById = new Map(categories.map((c) => [c.id, c.name]));

  const rows = products.flatMap((product) =>
    (product.priceOptions ?? []).map((option) =>
      [
        product.name,
        product.details,
        option.name,
        option.costPrice,
        option.sellPrice,
        option.sellPrice - option.costPrice,
        product.status,
        product.quantity,
        product.supplierGroupId ? (supplierById.get(product.supplierGroupId) ?? "") : "",
        product.categoryId ? (categoryById.get(product.categoryId) ?? "") : "",
        new Date(product.createdAt).toISOString(),
        new Date(product.updatedAt).toISOString(),
      ]
        .map(escapeCell)
        .join(","),
    ),
  );

  const csv = [CSV_HEADERS.join(","), ...rows].join("\r\n");
  downloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    `profittrack-products-${Date.now()}.csv`,
  );
}

export function buildBackup(
  supplierGroups: SupplierGroup[],
  categories: Category[],
  products: Product[],
): BackupFile {
  return {
    app: "profittrack",
    version: 1,
    exportedAt: Date.now(),
    supplierGroups,
    categories,
    products,
  };
}

export function exportBackup(
  supplierGroups: SupplierGroup[],
  categories: Category[],
  products: Product[],
): void {
  const backup = buildBackup(supplierGroups, categories, products);
  downloadBlob(
    new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
    `profittrack-backup-${new Date().toISOString().slice(0, 10)}.json`,
  );
}

/**
 * Parse + validate a backup file (JSON text) into the normalized shape the
 * `restoreBackupData` server action accepts. Legacy single-price products are
 * upgraded to price options here, exactly like the old local restore.
 */
export function parseBackup(text: string): NormalizedBackup {
  const parsed = JSON.parse(text) as Partial<BackupFile>;
  if (parsed.app !== "profittrack" || !Array.isArray(parsed.products)) {
    throw new Error("This file is not a valid ProfitTrack backup.");
  }
  return normalizeBackup(parsed);
}

export function normalizeBackup(parsed: Partial<BackupFile>): NormalizedBackup {
  const seenSuppliers = new Set<string>();
  const supplierGroups: NormalizedBackup["supplierGroups"] = [];
  for (const raw of parsed.supplierGroups ?? []) {
    const name = String(raw.name ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seenSuppliers.has(key)) continue;
    seenSuppliers.add(key);
    supplierGroups.push({
      oldId: raw.id == null ? null : Number(raw.id),
      name,
      createdAt: Number(raw.createdAt) || Date.now(),
    });
  }

  const seenCategories = new Set<string>();
  const categories: NormalizedBackup["categories"] = [];
  for (const raw of parsed.categories ?? []) {
    const name = String(raw.name ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seenCategories.has(key)) continue;
    seenCategories.add(key);
    categories.push({
      oldId: raw.id == null ? null : Number(raw.id),
      name,
      createdAt: Number(raw.createdAt) || Date.now(),
    });
  }

  const products: NormalizedBackup["products"] = (parsed.products ?? []).map(
    (rawProduct) => {
      const product = rawProduct as unknown as {
        name?: unknown;
        details?: unknown;
        costPrice?: number;
        sellPrice?: number;
        priceOptions?: Array<{
          id?: string;
          name?: string;
          costPrice?: number;
          sellPrice?: number;
        }>;
        priceHistory?: Array<{
          at?: number;
          optionId?: string;
          optionName?: string;
          costPrice?: number;
          sellPrice?: number;
        }>;
        status?: ProductStatus;
        quantity?: number;
        supplierGroupId?: number;
        categoryId?: number | null;
        createdAt?: number;
        updatedAt?: number;
        originalMessage?: unknown;
      };
      const legacyCost = Number(product.costPrice) || 0;
      const legacySell = Number(product.sellPrice) || 0;
      const priceOptions: PriceOption[] = Array.isArray(product.priceOptions)
        ? product.priceOptions
            .filter((option) => option && typeof option === "object")
            .map((option) => ({
              id: String(option.id ?? newOptionId()),
              name: String(option.name ?? ""),
              costPrice: Number(option.costPrice) || 0,
              sellPrice: Number(option.sellPrice) || 0,
            }))
        : [];
      const effectiveOptions =
        priceOptions.length > 0
          ? priceOptions
          : [
              {
                id: "opt-restored",
                name: "",
                costPrice: legacyCost,
                sellPrice: legacySell,
              },
            ];
      const primary = effectiveOptions[0];

      const priceHistory = Array.isArray(product.priceHistory)
        ? product.priceHistory
            .filter((entry) => entry && typeof entry === "object")
            .map((entry) => ({
              at: Number(entry.at) || Date.now(),
              optionId: String(entry.optionId ?? primary.id),
              optionName: String(entry.optionName ?? ""),
              costPrice: Number(entry.costPrice) || 0,
              sellPrice: Number(entry.sellPrice) || 0,
            }))
        : [
            {
              at: Number(product.createdAt) || Date.now(),
              optionId: primary.id,
              optionName: primary.name,
              costPrice: primary.costPrice,
              sellPrice: primary.sellPrice,
            },
          ];

      return {
        name: String(product.name ?? "Untitled"),
        details: String(product.details ?? ""),
        priceOptions: effectiveOptions,
        status:
          product.status && STATUSES.includes(product.status)
            ? product.status
            : "available",
        quantity: Math.max(1, Math.floor(Number(product.quantity) || 1)),
        oldSupplierId: product.supplierGroupId
          ? Number(product.supplierGroupId)
          : null,
        oldCategoryId: product.categoryId ? Number(product.categoryId) : null,
        createdAt: Number(product.createdAt) || Date.now(),
        updatedAt: Number(product.updatedAt) || Date.now(),
        originalMessage:
          typeof product.originalMessage === "string" &&
          product.originalMessage.trim() !== ""
            ? product.originalMessage
            : null,
        priceHistory,
      };
    },
  );

  return { supplierGroups, categories, products };
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
