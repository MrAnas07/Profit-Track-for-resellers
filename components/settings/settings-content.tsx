"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
  AlertTriangle,
  DatabaseBackup,
  Download,
  FileJson,
  HardDrive,
  Moon,
  Sheet as SheetIcon,
  Smartphone,
  Sun,
  Monitor,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { PageHeader } from "@/components/shared/shared";
import { db } from "@/lib/db";
import {
  exportBackup,
  exportProductsCsv,
  normalizeBackup,
  parseBackup,
} from "@/lib/export";
import { useData } from "@/components/providers/data-provider";

export function SettingsContent() {
  const { theme, setTheme } = useTheme();
  // next-themes returns the stored theme only on the client; gate the active
  // state behind mount so server HTML and the first client render match.
  const [themeMounted, setThemeMounted] = useState(false);
  useEffect(() => setThemeMounted(true), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [migrateOpen, setMigrateOpen] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const {
    products,
    supplierGroups,
    categories,
    restoreBackup,
    clearAllData,
  } = useData();

  const productCount = products.length;
  const supplierCount = supplierGroups.length;
  const categoryCount = categories.length;

  const pickFile = () => fileRef.current?.click();

  const onFileSelected = (file: File | null) => {
    if (!file) return;
    setPendingFile(file);
  };

  const confirmRestore = async () => {
    if (!pendingFile) return;
    setRestoring(true);
    try {
      const normalized = parseBackup(await pendingFile.text());
      const result = await restoreBackup(normalized);
      toast.success("Backup restored", {
        description: `${result.products} products · ${result.suppliers} suppliers · ${result.categories} categories`,
      });
      setPendingFile(null);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Restore failed");
    } finally {
      setRestoring(false);
    }
  };

  const runMigrate = async () => {
    setMigrating(true);
    try {
      const [localGroups, localCategories, localProducts] = await Promise.all([
        db.supplierGroups.toArray(),
        db.categories.toArray(),
        db.products.toArray(),
      ]);
      if (
        localGroups.length === 0 &&
        localCategories.length === 0 &&
        localProducts.length === 0
      ) {
        toast.info("No local data found on this device");
        setMigrateOpen(false);
        return;
      }
      const normalized = normalizeBackup({
        app: "profittrack",
        version: 1,
        exportedAt: Date.now(),
        supplierGroups: localGroups,
        categories: localCategories,
        products: localProducts,
      });
      const result = await restoreBackup(normalized);
      toast.success("Local data moved to your cloud account", {
        description: `${result.products} products · ${result.suppliers} suppliers · ${result.categories} categories`,
      });
      setMigrateOpen(false);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Migration failed",
      );
    } finally {
      setMigrating(false);
    }
  };

  const runClear = async () => {
    setClearing(true);
    try {
      await clearAllData();
      toast.success("All data deleted");
      setClearOpen(false);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Could not delete data",
      );
    } finally {
      setClearing(false);
    }
  };

  const themes = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ] as const;

  return (
    <>
      <PageHeader
        title="Settings & Backup"
        description="Appearance, exports and full data backup — synced to your account."
      />

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              Appearance
            </CardTitle>
            <CardDescription>
              Switch between light and dark mode — ProfitTrack remembers your choice.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2">
            {themes.map((option) => {
              const Icon = option.icon;
              const active = themeMounted && theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-sm font-medium transition ${
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              Storage
            </CardTitle>
            <CardDescription>
              Everything is saved in your ProfitTrack cloud account — sign in on any
              device to see it.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Products", value: productCount },
              { label: "Suppliers", value: supplierCount },
              { label: "Categories", value: categoryCount },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-muted/60 px-2 py-4">
                <p className="text-xl font-bold text-foreground">{item.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <SheetIcon className="h-4 w-4 text-muted-foreground" />
              Export
            </CardTitle>
            <CardDescription>
              Download your stock as a spreadsheet or a shareable file.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5 sm:flex-row">
            <Button
              variant="outline"
              className="sm:flex-1"
              onClick={() => {
                try {
                  exportProductsCsv(products, supplierGroups, categories);
                  toast.success("CSV downloaded");
                } catch {
                  toast.error("Export failed");
                }
              }}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              className="sm:flex-1"
              onClick={() => {
                try {
                  exportBackup(supplierGroups, categories, products);
                  toast.success("JSON backup downloaded");
                } catch {
                  toast.error("Backup failed");
                }
              }}
            >
              <FileJson className="h-4 w-4" />
              Download JSON backup
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <DatabaseBackup className="h-4 w-4 text-muted-foreground" />
              Restore
            </CardTitle>
            <CardDescription>
              Restoring replaces everything currently stored in your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={pickFile}>
              <Upload className="h-4 w-4" />
              Restore from backup file
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => onFileSelected(event.target.files?.[0] ?? null)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              Migrate local data
            </CardTitle>
            <CardDescription>
              Used the old offline version? Move everything from this browser&apos;s
              IndexedDB into your cloud account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setMigrateOpen(true)}
            >
              <Upload className="h-4 w-4" />
              Migrate local data to cloud
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Danger zone
            </CardTitle>
            <CardDescription>
              Permanently delete every product, supplier group and category in your
              account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => setClearOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete all my data
            </Button>
          </CardContent>
        </Card>
      </div>

      <AlertDialog
        open={Boolean(pendingFile)}
        onOpenChange={(open) => !open && setPendingFile(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this backup?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingFile?.name}” will replace all current products, supplier
              groups and categories in your account. This cannot be undone —
              download a JSON backup first if unsure.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={restoring} onClick={() => void confirmRestore()}>
              {restoring ? "Restoring…" : "Replace my data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={migrateOpen} onOpenChange={setMigrateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move local data to the cloud?</AlertDialogTitle>
            <AlertDialogDescription>
              Data found in this browser&apos;s IndexedDB will replace what is
              currently in your account. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={migrating} onClick={() => void runMigrate()}>
              {migrating ? "Moving…" : "Move my data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all your data?</AlertDialogTitle>
            <AlertDialogDescription>
              Every product, supplier group and category in your account will be
              permanently removed. This cannot be undone — download a JSON backup
              first if unsure.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={clearing} onClick={() => void runClear()}>
              {clearing ? "Deleting…" : "Delete everything"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
