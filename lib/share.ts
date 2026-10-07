import type { Category, Product, SupplierGroup } from "@/types";
import { plainNumber } from "./format";
import { optionLabel } from "./price";

const PRICE_PATTERN =
  /(rs\.?|price|only)\s*[=:\-]?\s*(?:rs\.?)?\s*([\d][\d,]*(?:\.\d+)?)/i;

/**
 * Rebuild the original WhatsApp message with current sell prices:
 * every detected price occurrence (Rs=950, Rs. 950, Rs 950, 950 Only …)
 * is swapped in option order. Formatting/emojis stay untouched.
 */
export function replacePrices(
  originalMessage: string,
  sellPrices: number[],
): string {
  if (sellPrices.length === 0) return originalMessage;
  let optionIndex = 0;
  return originalMessage
    .split(/\r?\n/)
    .map((line) => {
      if (optionIndex >= sellPrices.length) return line;
      const match = line.match(PRICE_PATTERN);
      if (!match || !match[2] || match.index === undefined) return line;
      const numberOffset = match[0].indexOf(match[2]);
      if (numberOffset < 0) return line;
      const sellPrice = sellPrices[optionIndex];
      optionIndex += 1;
      if (!Number.isFinite(sellPrice)) return line;
      const start = match.index + numberOffset;
      const newNumber = match[2].includes(",")
        ? plainNumber(sellPrice)
        : String(Math.round(sellPrice * 100) / 100);
      return (
        line.slice(0, start) +
        newNumber +
        line.slice(start + match[2].length)
      );
    })
    .join("\n");
}

/**
 * WhatsApp share format.
 * Supports {{path.to.value}} placeholders and
 * {{#each arrayPath}}...{{/each}} blocks rendered once per item.
 */
export const SHARE_TEMPLATE = `✨ *{{product.name}}*

{{#each priceOptions}}
💎 {{name}} → *Rs. {{sellPrice}}*
{{/each}}

📝 {{product.details}}`;

export interface ShareContext {
  supplier?: SupplierGroup;
  category?: Category | null;
}

type Item = Record<string, string>;
type Ctx = Record<string, unknown>;

function readPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
}

function renderPlaceholders(text: string, ctx: Ctx): string {
  return text.replace(/\{\{([\w.]+)\}\}/g, (match, path: string) => {
    const value = readPath(ctx, path);
    return typeof value === "string" ? value : match;
  });
}

function renderEachBlocks(template: string, ctx: Ctx): string {
  return template.replace(
    /\{\{#each ([\w.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (_match, path: string, body: string) => {
      const items = readPath(ctx, path);
      if (!Array.isArray(items)) return "";
      const inner = body.replace(/^\n+|\n+$/g, "");
      return items
        .map((item) =>
          renderPlaceholders(inner, { ...ctx, ...(item as Item) }),
        )
        .join("\n");
    },
  );
}

function renderTemplate(template: string, ctx: Ctx): string {
  return renderPlaceholders(renderEachBlocks(template, ctx), ctx);
}

export function buildShareText(
  product: Product,
  context: ShareContext = {},
): string {
  const options = product.priceOptions ?? [];

  // Original WhatsApp message: keep it exactly as pasted, only swap in
  // the current sell prices (in option order).
  if (product.originalMessage) {
    return replacePrices(
      product.originalMessage,
      options.map((option) => option.sellPrice),
    );
  }

  const ctx: Ctx = {
    product: {
      name: product.name,
      details: product.details,
      status: product.status,
      quantity: String(product.quantity),
      supplier: context.supplier?.name ?? "",
      category: context.category?.name ?? "",
    },
    priceOptions: options.map((option) => ({
      name: optionLabel(option.name),
      costPrice: plainNumber(option.costPrice),
      sellPrice: plainNumber(option.sellPrice),
      profit: plainNumber(option.sellPrice - option.costPrice),
    })),
  };

  return renderTemplate(SHARE_TEMPLATE, ctx)
    .split("\n")
    .filter((line, index, lines) =>
      line.trim() === "" && (index === 0 || index === lines.length - 1)
        ? false
        : true,
    )
    .join("\n")
    .trim();
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }

  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function whatsappLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
