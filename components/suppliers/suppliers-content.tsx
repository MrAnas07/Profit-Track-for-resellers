"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, CardSkeleton, EmptyState } from "@/components/shared/shared";
import { relativeTime } from "@/lib/format";
import type { SupplierGroup } from "@/types";
import { useData } from "@/components/providers/data-provider";

export function SuppliersContent() {
  const {
    supplierGroups: suppliers,
    products,
    loading,
    createSupplierGroup,
    updateSupplierGroup,
    deleteSupplierGroup,
  } = useData();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierGroup | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SupplierGroup | null>(null);

  const usage = useMemo(() => {
    const counts = new Map<number, number>();
    for (const product of products ?? []) {
      counts.set(
        product.supplierGroupId,
        (counts.get(product.supplierGroupId) ?? 0) + 1,
      );
    }
    return counts;
  }, [products]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (supplier: SupplierGroup) => {
    setEditing(supplier);
    setName(supplier.name);
    setError(null);
    setDialogOpen(true);
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Supplier group name is required.");
      return;
    }
    const duplicate = suppliers?.some(
      (supplier) =>
        supplier.name.toLowerCase() === trimmed.toLowerCase() &&
        supplier.id !== editing?.id,
    );
    if (duplicate) {
      setError("A supplier group with this name already exists.");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await updateSupplierGroup(editing.id!, trimmed);
        toast.success(`${trimmed} updated`);
      } else {
        await createSupplierGroup(trimmed);
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
    const used = usage.get(pendingDelete.id) ?? 0;
    if (used > 0) {
      toast.error(`Cannot delete — ${used} product${used > 1 ? "s" : ""} use this group`);
      setPendingDelete(null);
      return;
    }
    try {
      await deleteSupplierGroup(pendingDelete.id);
      toast.success(`${pendingDelete.name} deleted`);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Could not delete group.",
      );
    }
    setPendingDelete(null);
  };

  if (loading) {
    return (
      <>
        <PageHeader
          title="Supplier Groups"
          description="The WhatsApp groups you buy stock from."
        />
        <CardSkeleton rows={3} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Supplier Groups"
        description="Pre-add every WhatsApp group you buy from, then select them while adding products."
      >
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add supplier group
        </Button>
      </PageHeader>

      {suppliers.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No supplier groups yet"
          description="Add the WhatsApp groups you purchase from — e.g. “Karachi Wholesale Hub” — so every product can be linked to its source."
          actionLabel="Add supplier group"
          onAction={openCreate}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {suppliers.map((supplier) => {
            const count = usage.get(supplier.id!) ?? 0;
            return (
              <Card key={supplier.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Users className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Rename ${supplier.name}`}
                        onClick={() => openEdit(supplier)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${supplier.name}`}
                        className="text-destructive hover:text-destructive"
                        onClick={() => setPendingDelete(supplier)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="mt-3 truncate text-sm font-semibold text-foreground">
                    {supplier.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {count} product{count === 1 ? "" : "s"} · added{" "}
                    {relativeTime(supplier.createdAt)}
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
            <DialogTitle>
              {editing ? "Rename supplier group" : "Add supplier group"}
            </DialogTitle>
            <DialogDescription>
              Use the exact group name so you can recognise it in the product form.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="supplier-name">Group name</Label>
            <Input
              id="supplier-name"
              autoFocus
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") void save();
              }}
              placeholder='e.g. "Karachi Wholesale Hub"'
            />
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add group"}
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
            <AlertDialogTitle>Delete supplier group?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.name}” can only be deleted when no products use it.
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
