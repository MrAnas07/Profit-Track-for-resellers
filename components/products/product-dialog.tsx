"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ClipboardPaste, History, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useProductDialog } from "@/components/providers/app-providers";
import { useData } from "@/components/providers/data-provider";
import { extractFromWhatsApp } from "@/lib/extract";
import { dateTime, money, parseAmount } from "@/lib/format";
import { newOptionId } from "@/lib/price";
import {
  STATUS_META,
  type PriceChange,
  type PriceOption,
  type ProductDraft,
  type ProductInput,
  type ProductStatus,
} from "@/types";

const STATUSES: ProductStatus[] = ["available", "pending", "sold"];

interface OptionForm {
  key: string;
  id: string;
  name: string;
  costPrice: string;
  sellPrice: string;
}

interface FormState {
  name: string;
  details: string;
  options: OptionForm[];
  status: ProductStatus;
  quantity: string;
  supplierGroupId: string;
  categoryId: string;
  originalMessage: string | null;
}

interface OptionErrors {
  costPrice?: string;
  sellPrice?: string;
}

interface Errors {
  name?: string;
  supplierGroupId?: string;
  options?: Record<string, OptionErrors>;
}

function emptyOption(): OptionForm {
  return { key: newOptionId(), id: newOptionId(), name: "", costPrice: "", sellPrice: "" };
}

function toForm(draft: ProductDraft | null): FormState {
  const options: OptionForm[] =
    draft?.priceOptions && draft.priceOptions.length > 0
      ? draft.priceOptions.map((option) => ({
          key: option.id,
          id: option.id,
          name: option.name,
          costPrice: String(option.costPrice),
          sellPrice: String(option.sellPrice),
        }))
      : [emptyOption()];

  return {
    name: draft?.name ?? "",
    details: draft?.details ?? "",
    options,
    status: draft?.status ?? "available",
    quantity: draft ? String(draft.quantity) : "1",
    supplierGroupId: draft?.supplierGroupId ? String(draft.supplierGroupId) : "",
    categoryId: draft?.categoryId ? String(draft.categoryId) : "",
    originalMessage: draft?.originalMessage ?? null,
  };
}

export function ProductDialog() {
  const { isOpen, editing, closeDialog } = useProductDialog();
  const {
    supplierGroups: suppliers,
    categories,
    createSupplierGroup,
    createCategory: addCategory,
    createProduct,
    updateProduct,
  } = useData();

  const [form, setForm] = useState<FormState>(() => toForm(editing));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(toForm(editing));
      setErrors({});
      setSaving(false);
      setAddingSupplier(false);
      setAddingCategory(false);
      setNewSupplierName("");
      setNewCategoryName("");
      setPasteOpen(false);
      setPasteText("");
      setExtracting(false);
    }
  }, [isOpen, editing]);

  const quantity = Math.max(1, Math.floor(parseAmount(form.quantity) || 1));

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const setOption = (key: string, patch: Partial<OptionForm>) => {
    setForm((current) => ({
      ...current,
      options: current.options.map((option) =>
        option.key === key ? { ...option, ...patch } : option,
      ),
    }));
    setErrors((current) => {
      if (!current.options?.[key]) return current;
      const next = { ...current.options };
      delete next[key];
      return { ...current, options: next };
    });
  };

  const addOption = () => {
    setForm((current) => ({ ...current, options: [...current.options, emptyOption()] }));
  };

  const removeOption = (key: string) => {
    setForm((current) =>
      current.options.length > 1
        ? { ...current, options: current.options.filter((option) => option.key !== key) }
        : current,
    );
  };

  const validate = (): boolean => {
    const next: Errors = {};
    const optionErrors: Record<string, OptionErrors> = {};

    if (!form.name.trim()) next.name = "Product name is required.";
    if (!form.supplierGroupId)
      next.supplierGroupId = "Select the supplier group you bought it from.";

    for (const option of form.options) {
      const cost = parseAmount(option.costPrice);
      const sell = parseAmount(option.sellPrice);
      const perOption: OptionErrors = {};
      if (option.costPrice.trim() === "" || cost < 0)
        perOption.costPrice = "Enter the cost price.";
      if (option.sellPrice.trim() === "" || sell < 0)
        perOption.sellPrice = "Enter the sell price.";
      if (Object.keys(perOption).length > 0) optionErrors[option.key] = perOption;
    }
    if (Object.keys(optionErrors).length > 0) next.options = optionErrors;

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const createSupplier = async (): Promise<number | null> => {
    const name = newSupplierName.trim();
    if (!name) return null;
    const exists = suppliers?.some(
      (supplier) => supplier.name.toLowerCase() === name.toLowerCase(),
    );
    if (exists) {
      const match = suppliers?.find(
        (supplier) => supplier.name.toLowerCase() === name.toLowerCase(),
      );
      setNewSupplierName("");
      setAddingSupplier(false);
      set("supplierGroupId", String(match?.id ?? ""));
      return match?.id ?? null;
    }
    try {
      const group = await createSupplierGroup(name);
      const id = group.id ?? null;
      setNewSupplierName("");
      setAddingSupplier(false);
      if (id != null) set("supplierGroupId", String(id));
      return id;
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Could not add supplier group",
      );
      return null;
    }
  };

  const createCategory = async (): Promise<number | null> => {
    const name = newCategoryName.trim();
    if (!name) return null;
    const exists = categories?.some(
      (category) => category.name.toLowerCase() === name.toLowerCase(),
    );
    if (exists) {
      const match = categories?.find(
        (category) => category.name.toLowerCase() === name.toLowerCase(),
      );
      setNewCategoryName("");
      setAddingCategory(false);
      set("categoryId", String(match?.id ?? ""));
      return match?.id ?? null;
    }
    try {
      const category = await addCategory(name);
      const id = category.id ?? null;
      setNewCategoryName("");
      setAddingCategory(false);
      if (id != null) set("categoryId", String(id));
      return id;
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Could not add category",
      );
      return null;
    }
  };

  const runExtract = async () => {
    const text = pasteText;
    if (!text.trim() || extracting) return;
    setExtracting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 450));
      const extracted = extractFromWhatsApp(text);
      setForm((current) => ({
        ...current,
        name: extracted.name || current.name,
        details: extracted.details || current.details,
        originalMessage: text,
        options:
          extracted.options.length > 0
            ? extracted.options.map((option) => ({
                key: newOptionId(),
                id: newOptionId(),
                name: option.name,
                costPrice: option.price === null ? "" : String(option.price),
                sellPrice: "",
              }))
            : [emptyOption()],
      }));
      setErrors((current) => ({ ...current, options: undefined }));
      setPasteOpen(false);
      setPasteText("");
      toast.success("Product details extracted successfully");
    } catch {
      toast.error("Could not extract product details");
    } finally {
      setExtracting(false);
    }
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      let supplierId = form.supplierGroupId ? Number(form.supplierGroupId) : null;
      if (addingSupplier && newSupplierName.trim()) {
        const createdId = await createSupplier();
        if (createdId) supplierId = createdId;
      }
      if (!supplierId) {
        setErrors({ supplierGroupId: "Select or add a supplier group." });
        setSaving(false);
        return;
      }

      let categoryId = form.categoryId ? Number(form.categoryId) : null;
      if (addingCategory && newCategoryName.trim()) {
        const createdCategoryId = await createCategory();
        if (createdCategoryId) categoryId = createdCategoryId;
      }

      const now = Date.now();
      const priceOptions: PriceOption[] = form.options.map((option) => ({
        id: option.id,
        name: option.name.trim(),
        costPrice: parseAmount(option.costPrice),
        sellPrice: parseAmount(option.sellPrice),
      }));

      let historyEntries: PriceChange[] = [];
      const input: Omit<ProductInput, "priceHistory"> = {
        name: form.name.trim(),
        details: form.details.trim(),
        priceOptions,
        status: form.status,
        quantity,
        supplierGroupId: supplierId,
        categoryId,
        originalMessage: form.originalMessage,
      };

      if (editing) {
        if (editing.id == null) throw new Error("Product not found.");
        const previousById = new Map(
          (editing.priceOptions ?? []).map((option) => [option.id, option]),
        );
        historyEntries = priceOptions
          .filter((option) => {
            const previous = previousById.get(option.id);
            return (
              !previous ||
              previous.costPrice !== option.costPrice ||
              previous.sellPrice !== option.sellPrice
            );
          })
          .map((option) => ({
            at: now,
            optionId: option.id,
            optionName: option.name,
            costPrice: option.costPrice,
            sellPrice: option.sellPrice,
          }));

        await updateProduct(editing.id, {
          ...input,
          priceHistory: [...(editing.priceHistory ?? []), ...historyEntries],
        });
        toast.success(`${form.name.trim()} updated`, {
          description:
            historyEntries.length > 0 ? "New price saved to history" : undefined,
        });
      } else {
        historyEntries = priceOptions.map((option) => ({
          at: now,
          optionId: option.id,
          optionName: option.name,
          costPrice: option.costPrice,
          sellPrice: option.sellPrice,
        }));
        await createProduct({
          ...input,
          createdAt: now,
          priceHistory: historyEntries,
        });
        toast.success(`${form.name.trim()} added to your list`);
      }
      closeDialog();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not save product");
    } finally {
      setSaving(false);
    }
  };

  const history = useMemo(() => {
    if (!editing) return [];
    return [...(editing.priceHistory ?? [])].sort((a, b) => b.at - a.at);
  }, [editing]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border py-5 pl-5 pr-12 text-left sm:pl-6">
          <DialogTitle>{editing ? "Edit product" : "Add product"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Changing an option's cost or sell price records a price history entry."
              : "Add at least one price option and a supplier group."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="space-y-2">
            <Label htmlFor="product-name">
              Product name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="product-name"
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="e.g. Samsung A15 128GB"
              autoFocus
            />
            {errors.name ? (
              <p className="text-xs text-destructive">{errors.name}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-details">Details</Label>
            <Textarea
              id="product-details"
              value={form.details}
              onChange={(event) => set("details", event.target.value)}
              placeholder="Color, size, condition, warranty, delivery note…"
              className="min-h-20 resize-y"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label>
                Price options <span className="text-destructive">*</span>
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOption}
              >
                <Plus className="h-4 w-4" />
                Add Option
              </Button>
            </div>

            <div className="space-y-3">
              {form.options.map((option, index) => {
                const cost = parseAmount(option.costPrice);
                const sell = parseAmount(option.sellPrice);
                const profit = sell - cost;
                const perOption = errors.options?.[option.key];
                const showProfit = option.sellPrice.trim() !== "";
                return (
                  <div
                    key={option.key}
                    className="space-y-3 rounded-xl border border-border bg-muted/30 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Option {index + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        {showProfit ? (
                          <span
                            className={`text-sm font-bold ${
                              profit > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : profit < 0
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {profit >= 0 ? "+" : ""}
                            {money(profit)}
                          </span>
                        ) : null}
                        {form.options.length > 1 ? (
                          <button
                            type="button"
                            aria-label={`Remove option ${index + 1}`}
                            onClick={() => removeOption(option.key)}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-destructive transition hover:bg-destructive/10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Input
                        aria-label={`Option ${index + 1} name`}
                        value={option.name}
                        onChange={(event) =>
                          setOption(option.key, { name: event.target.value })
                        }
                        placeholder="Option name (e.g. With Organizer Box)"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Input
                          aria-label={`Option ${index + 1} cost price`}
                          inputMode="decimal"
                          value={option.costPrice}
                          onChange={(event) =>
                            setOption(option.key, { costPrice: event.target.value })
                          }
                          placeholder="Cost price"
                        />
                        {perOption?.costPrice ? (
                          <p className="text-xs text-destructive">{perOption.costPrice}</p>
                        ) : null}
                      </div>
                      <div className="space-y-1.5">
                        <Input
                          aria-label={`Option ${index + 1} sell price`}
                          inputMode="decimal"
                          value={option.sellPrice}
                          onChange={(event) =>
                            setOption(option.key, { sellPrice: event.target.value })
                          }
                          placeholder="Sell price"
                        />
                        {perOption?.sellPrice ? (
                          <p className="text-xs text-destructive">{perOption.sellPrice}</p>
                        ) : null}
                      </div>
                    </div>

                    {showProfit ? (
                      <div
                        className={`flex items-center justify-between rounded-lg px-3 py-2 ring-1 transition ${
                          profit > 0
                            ? "bg-emerald-50 ring-emerald-200 dark:bg-emerald-500/10 dark:ring-emerald-500/20"
                            : profit < 0
                              ? "bg-red-50 ring-red-200 dark:bg-red-500/10 dark:ring-red-500/20"
                              : "bg-background ring-border"
                        }`}
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Live profit
                        </p>
                        <p
                          className={`text-sm font-bold ${
                            profit > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : profit < 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-muted-foreground"
                          }`}
                        >
                          {profit >= 0 ? "+" : ""}
                          {money(profit)}
                        </p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Status <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
              {STATUSES.map((status) => {
                const active = form.status === status;
                const meta = STATUS_META[status];
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => set("status", status)}
                    aria-pressed={active}
                    className={`cursor-pointer rounded-md px-2 py-2.5 text-xs font-semibold transition ${
                      active
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-qty">Quantity</Label>
            <Input
              id="product-qty"
              inputMode="numeric"
              value={form.quantity}
              onChange={(event) => set("quantity", event.target.value)}
              placeholder="1"
            />
          </div>

          <div className="space-y-2">
            <Label>
              Supplier group <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.supplierGroupId}
              onValueChange={(value) => set("supplierGroupId", value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    suppliers?.length
                      ? "Select supplier group"
                      : "No groups yet — add one below"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {suppliers?.map((supplier) => (
                  <SelectItem key={supplier.id} value={String(supplier.id)}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.supplierGroupId ? (
              <p className="text-xs text-destructive">{errors.supplierGroupId}</p>
            ) : null}

            {addingSupplier ? (
              <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-2 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <Input
                  autoFocus
                  value={newSupplierName}
                  onChange={(event) => setNewSupplierName(event.target.value)}
                  placeholder='e.g. "Karachi Wholesale Hub"'
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void createSupplier();
                    }
                  }}
                  className="h-9"
                />
                <Button
                  size="sm"
                  onClick={() => void createSupplier()}
                  disabled={!newSupplierName.trim()}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAddingSupplier(false);
                    setNewSupplierName("");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingSupplier(true)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-500/10 hover:text-emerald-700 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:text-emerald-400"
              >
                <Plus className="h-3.5 w-3.5" />
                New supplier group
              </button>
            )}
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={form.categoryId}
              onValueChange={(value) => set("categoryId", value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="No category" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((category) => (
                  <SelectItem key={category.id} value={String(category.id)}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {addingCategory ? (
              <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-2 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <Input
                  autoFocus
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  placeholder='e.g. "Watches"'
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void createCategory();
                    }
                  }}
                  className="h-9"
                />
                <Button
                  size="sm"
                  onClick={() => void createCategory()}
                  disabled={!newCategoryName.trim()}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAddingCategory(false);
                    setNewCategoryName("");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingCategory(true)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-500/10 hover:text-emerald-700 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:text-emerald-400"
              >
                <Plus className="h-3.5 w-3.5" />
                New category
              </button>
            )}
          </div>

          {editing && history.length > 0 ? (
            <div className="rounded-xl border border-border p-4">
              <p className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <History className="h-4 w-4 text-muted-foreground" />
                Price history
              </p>
              <ol className="space-y-2">
                {history.map((entry, index) => (
                  <li
                    key={`${entry.at}-${index}`}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 truncate text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {entry.optionName?.trim() || "Standard"}
                      </span>
                      {" · Cost "}
                      {money(entry.costPrice)} · Sell {money(entry.sellPrice)}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground/70">
                      {dateTime(entry.at)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>

        <DialogFooter className="mx-0 mb-0 border-t border-border px-5 py-4 sm:px-6">
          <Button
            variant="outline"
            onClick={() => setPasteOpen(true)}
            disabled={saving}
          >
            <ClipboardPaste className="h-4 w-4" />
            Paste from WhatsApp
          </Button>
          <Button variant="ghost" onClick={closeDialog} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving
              ? "Saving…"
              : editing
                ? "Save changes"
                : "Add product"}
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>

      <Dialog
        open={pasteOpen}
        onOpenChange={(open) => {
          if (extracting) return;
          setPasteOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Paste from WhatsApp</DialogTitle>
            <DialogDescription>
              WhatsApp message paste karo — naam, details aur price options auto
              extract ho jayenge. Cost price tum baad mein daal sakte ho.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            aria-label="WhatsApp message"
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            placeholder="Yahan WhatsApp se poora message paste karo..."
            className="min-h-56 resize-y font-mono text-sm"
            autoFocus
          />

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => setPasteOpen(false)}
              disabled={extracting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void runExtract()}
              disabled={!pasteText.trim() || extracting}
            >
              {extracting ? "Extracting..." : "Extract & Fill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
