"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Category, Product, SupplierGroup } from "@/types";
import { buildShareText, copyText, whatsappLink } from "@/lib/share";

export function ShareButton({
  product,
  supplier,
  category,
  variant = "ghost",
  className = "",
}: {
  product: Product;
  supplier?: SupplierGroup;
  category?: Category | null;
  variant?: "ghost" | "outline" | "default" | "share";
  className?: string;
}) {
  const handleShare = async () => {
    const text = buildShareText(product, { supplier, category });
    const copied = await copyText(text);

    if (copied) {
      toast.success("Copied for WhatsApp", {
        action: {
          label: "Open WhatsApp",
          onClick: () => window.open(whatsappLink(text), "_blank", "noopener"),
        },
      });
    } else {
      toast.info("Opening WhatsApp instead", {
        action: {
          label: "Open",
          onClick: () => window.open(whatsappLink(text), "_blank", "noopener"),
        },
      });
    }
  };

  if (variant === "share") {
    return (
      <button
        type="button"
        onClick={() => void handleShare()}
        aria-label={`Copy WhatsApp share text for ${product.name}`}
        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20 ${className}`}
      >
        <Share2 className="h-3.5 w-3.5" />
        Share
      </button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Copy WhatsApp share text for ${product.name}`}
      onClick={() => void handleShare()}
      className={className}
    >
      <Share2 className="h-4 w-4" />
    </Button>
  );
}
