"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import type { Product } from "@/types";

interface ProductDialogContextValue {
  isOpen: boolean;
  editing: Product | null;
  openDialog: (product?: Product | null) => void;
  closeDialog: () => void;
}

const ProductDialogContext = createContext<ProductDialogContextValue | null>(null);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const openDialog = useCallback((product?: Product | null) => {
    setEditing(product ?? null);
    setIsOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    setEditing(null);
  }, []);

  const value = useMemo(
    () => ({ isOpen, editing, openDialog, closeDialog }),
    [isOpen, editing, openDialog, closeDialog],
  );

  return (
    <ProductDialogContext.Provider value={value}>
      {children}
      <Toaster position="bottom-right" richColors closeButton />
    </ProductDialogContext.Provider>
  );
}

export function useProductDialog(): ProductDialogContextValue {
  const context = useContext(ProductDialogContext);
  if (!context) {
    throw new Error("useProductDialog must be used within AppProviders");
  }
  return context;
}
