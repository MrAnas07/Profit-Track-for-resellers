import Dexie, { type Table } from "dexie";
import type { Category, PriceOption, Product, SupplierGroup } from "@/types";

class ProfitTrackDB extends Dexie {
  supplierGroups!: Table<SupplierGroup, number>;
  categories!: Table<Category, number>;
  products!: Table<Product, number>;

  constructor() {
    super("profittrack");
    this.version(1).stores({
      supplierGroups: "++id, name, createdAt",
      categories: "++id, name, createdAt",
      products:
        "++id, name, status, supplierGroupId, categoryId, createdAt, updatedAt",
    });
    this.version(2)
      .stores({
        supplierGroups: "++id, name, createdAt",
        categories: "++id, name, createdAt",
        products:
          "++id, name, status, supplierGroupId, categoryId, createdAt, updatedAt",
      })
      .upgrade((tx) =>
        tx
          .table("products")
          .toCollection()
          .modify((product) => {
            const legacy = product as unknown as {
              costPrice?: number;
              sellPrice?: number;
              priceOptions?: PriceOption[];
              priceHistory?: Array<{
                at: number;
                optionId?: string;
                optionName?: string;
                costPrice: number;
                sellPrice: number;
              }>;
            };
            if (
              !Array.isArray(legacy.priceOptions) ||
              legacy.priceOptions.length === 0
            ) {
              const costPrice = Number(legacy.costPrice) || 0;
              const sellPrice = Number(legacy.sellPrice) || 0;
              product.priceOptions = [
                { id: "opt-migrated", name: "", costPrice, sellPrice },
              ];
              delete legacy.costPrice;
              delete legacy.sellPrice;
            }
            if (Array.isArray(legacy.priceHistory)) {
              product.priceHistory = legacy.priceHistory.map((entry) => ({
                at: entry.at,
                optionId: entry.optionId ?? "opt-migrated",
                optionName: entry.optionName ?? "",
                costPrice: entry.costPrice,
                sellPrice: entry.sellPrice,
              }));
            } else {
              product.priceHistory = [];
            }
          }),
      );
  }
}

export const db = new ProfitTrackDB();
