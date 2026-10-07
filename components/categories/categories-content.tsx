"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, CardSkeleton, EmptyState } from "@/components/shared/shared";
import type { Category } from "@/types";
import { useData } from "@/components/providers/data-provider";

export function CategoriesContent() {
  const {
    categories,
    products,
    loading,
    createCategory,
    updateCategory,
    deleteCategory,
  } = useData();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);

  const usage = useMemo(() => {
    const counts = new Map<number, number>();
    for (const product of products ?? []) {
      if (product.categoryId) {
        counts.set(
          product.categoryId,
          (counts.get(product.categoryId) ?? 0) + 1,
        );
      }
    }
    return counts;
  }, [products]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setName(category.name);
    setError(null);
    setDialogOpen(true);
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Category name is required.");
      return;
    }
    const duplicate = categories?.some(
      (category) =>
        category.name.toLowerCase() === trimmed.toLowerCase() &&
        category.id !== editing?.id,
    );
    if (duplicate) {
      setError("A category with this name already exists.");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await updateCategory(editing.id!, trimmed);
        toast.success(`${trimmed} updated`);
      } else {
        await createCategory(trimmed);
        toast.success(`${trimmed} added`);
      }
      setDialogOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete?.id) return;
    const categoryId = pendingDelete.id;
    const affected = (products ?? []).filter(
      (product) => product.categoryId === categoryId,
    );
    try {
      // Products referencing this category get categoryId = NULL server-side.
      await deleteCategory(categoryId);
      toast.success(
        affected.length > 0
          ? `${pendingDelete.name} removed from ${affected.length} product${affected.length > 1 ? "s" : ""}`
          : `${pendingDelete.name} deleted`,
      );
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Could not delete category.",
      );
    }
    setPendingDelete(null);
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Categories" description="Organise your products." />
        <CardSkeleton rows={3} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Categories"
        description="Six categories are pre-seeded — add your own any time."
      >
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add category
        </Button>
      </PageHeader>

      {categories.length === 0 ? (
        <EmptyState
          icon={<Tags className="h-6 w-6" />}
          title="No categories"
          description="Create categories like Electronics, Fashion or Watches to organise your stock."
          actionLabel="Add category"
          onAction={openCreate}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const count = usage.get(category.id!) ?? 0;
            return (
              <Card key={category.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                      <Tags className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Rename ${category.name}`}
                        onClick={() => openEdit(category)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${category.name}`}
                        className="text-destructive hover:text-destructive"
                        onClick={() => setPendingDelete(category)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                    {category.name}
                    <Badge variant="secondary" className="font-normal">
                      {count} product{count === 1 ? "" : "s"}
                    </Badge>
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Rename category" : "Add category"}</DialogTitle>
            <DialogDescription>
              Categories are optional when adding products, but they keep stock
              organised.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="category-name">Category name</Label>
            <Input
              id="category-name"
              autoFocus
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") void save();
              }}
              placeholder='e.g. "Watches"'
            />
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.name}” will be removed from any products using it.
              Product details stay untouched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
