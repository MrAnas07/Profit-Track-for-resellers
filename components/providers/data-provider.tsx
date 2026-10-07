"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as server from "@/lib/actions";
import type {
  ActionResult,
  Category,
  NormalizedBackup,
  Product,
  ProductInput,
  RestoreResult,
  SupplierGroup,
} from "@/types";

interface DataState {
  supplierGroups: SupplierGroup[];
  categories: Category[];
  products: Product[];
  loading: boolean;
  error: string | null;
}

interface DataValue extends DataState {
  refresh: () => Promise<void>;
  createProduct: (input: ProductInput) => Promise<Product>;
  updateProduct: (id: number, input: ProductInput) => Promise<Product>;
  deleteProduct: (id: number) => Promise<void>;
  createSupplierGroup: (name: string) => Promise<SupplierGroup>;
  updateSupplierGroup: (id: number, name: string) => Promise<SupplierGroup>;
  deleteSupplierGroup: (id: number) => Promise<void>;
  createCategory: (name: string) => Promise<Category>;
  updateCategory: (id: number, name: string) => Promise<Category>;
  deleteCategory: (id: number) => Promise<void>;
  restoreBackup: (backup: NormalizedBackup) => Promise<RestoreResult>;
  clearAllData: () => Promise<void>;
}

const DataContext = createContext<DataValue | null>(null);

const EMPTY_STATE: DataState = {
  supplierGroups: [],
  categories: [],
  products: [],
  loading: true,
  error: null,
};

/**
 * Cloud data layer: loads all tenant-scoped data in one round trip and exposes
 * mutations that re-sync after every successful write. When the network is
 * down the UI falls back to empty data so the shell keeps rendering (the
 * service worker still serves the app shell offline).
 */
export function DataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DataState>(EMPTY_STATE);

  const load = useCallback(async () => {
    try {
      const data = await server.getBootstrapData();
      setState({ ...data, loading: false, error: null });
    } catch (cause) {
      // Offline / session issues: keep previous data (or show an empty state)
      // instead of blocking the whole app behind an infinite skeleton.
      setState((prev) => ({
        ...prev,
        loading: false,
        error:
          cause instanceof Error && cause.message
            ? cause.message
            : "Could not load your data.",
      }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(
    async <T,>(pending: Promise<ActionResult<T>>): Promise<T> => {
      let result: ActionResult<T>;
      try {
        result = await pending;
      } catch (cause) {
        throw new Error(
          cause instanceof Error && cause.message
            ? cause.message
            : "Something went wrong. Please try again.",
        );
      }
      if (!result.ok) throw new Error(result.error);
      await load();
      return result.data;
    },
    [load],
  );

  const value = useMemo<DataValue>(
    () => ({
      ...state,
      refresh: load,
      createProduct: (input) => run(server.createProduct(input)),
      updateProduct: (id, input) => run(server.updateProduct(id, input)),
      deleteProduct: async (id) => {
        await run(server.deleteProduct(id));
      },
      createSupplierGroup: (name) => run(server.createSupplierGroup(name)),
      updateSupplierGroup: (id, name) =>
        run(server.updateSupplierGroup(id, name)),
      deleteSupplierGroup: async (id) => {
        await run(server.deleteSupplierGroup(id));
      },
      createCategory: (name) => run(server.createCategory(name)),
      updateCategory: (id, name) => run(server.updateCategory(id, name)),
      deleteCategory: async (id) => {
        await run(server.deleteCategory(id));
      },
      restoreBackup: (backup) => run(server.restoreBackupData(backup)),
      clearAllData: async () => {
        await run(server.clearAllData());
      },
    }),
    [state, load, run],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside a DataProvider");
  return ctx;
}
