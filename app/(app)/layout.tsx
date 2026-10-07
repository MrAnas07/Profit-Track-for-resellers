import { AppShell } from "@/components/layout/app-shell";
import { DataProvider } from "@/components/providers/data-provider";
import { ProductDialog } from "@/components/products/product-dialog";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <DataProvider>
      <AppShell>{children}</AppShell>
      {/* Mounted inside DataProvider so the dialog can read groups/categories. */}
      <ProductDialog />
    </DataProvider>
  );
}
