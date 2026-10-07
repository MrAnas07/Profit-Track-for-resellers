export interface ExtractedOption {
  name: string;
  price: number | null;
}

export interface ExtractedProduct {
  name: string;
  details: string;
  options: ExtractedOption[];
}

const PRICE_PATTERN =
  /(rs\.?|price|only)\s*[=:\-]?\s*(?:rs\.?)?\s*([\d][\d,]*(?:\.\d+)?)/i;

const EMOJI_PATTERN =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}]/gu;

const SYMBOL_PATTERN = /[*~=–—•·…|_/\\[\]{}<>#!?]+/g;

function stripDecorations(text: string): string {
  return text
    .replace(EMOJI_PATTERN, " ")
    .replace(SYMBOL_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isDecorationOnly(text: string): boolean {
  return stripDecorations(text) === "";
}

function cleanName(text: string): string {
  return stripDecorations(text)
    .replace(/^[,:\-"'“”‘’.\s]+/, "")
    .replace(/[,:\-"'“”‘’.\s]+$/, "")
    .trim();
}

function cleanOptionName(raw: string): string {
  let name = stripDecorations(raw);
  if (/^price\b/i.test(name)) {
    name = name.replace(/^price\s*/i, "").replace(/^(?:with|of|for)\s+/i, "");
  }
  name = name
    .replace(/\b(?:same|jewellery|jewelry)\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,:\-]+/, "")
    .replace(/[\s,:\-]+$/, "")
    .trim();
  return name;
}

function pickNameLine(lines: Array<{ text: string; index: number }>): number {
  const candidates = lines
    .filter((line) => line.text.trim() !== "" && !isDecorationOnly(line.text))
    .slice(0, 6);
  if (candidates.length === 0) return -1;
  const bold = candidates.find((line) => /^\*[^*].*[^*]\*$/.test(line.text.trim()));
  return (bold ?? candidates[0]).index;
}

export function extractFromWhatsApp(text: string): ExtractedProduct {
  const rawLines = text.split(/\r?\n/);
  const lines = rawLines.map((value, index) => ({ text: value, index }));

  const nameIndex = pickNameLine(lines);
  const name = nameIndex >= 0 ? cleanName(rawLines[nameIndex]) : "";

  const options: ExtractedOption[] = [];
  const detailLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.text.trim();
    if (trimmed === "" || isDecorationOnly(trimmed)) continue;
    if (line.index === nameIndex) continue;

    const match = trimmed.match(PRICE_PATTERN);
    if (match && match[2]) {
      const price = Number(match[2].replace(/,/g, ""));
      if (Number.isFinite(price)) {
        options.push({
          name: cleanOptionName(trimmed.slice(0, match.index ?? 0)),
          price,
        });
        continue;
      }
    }

    detailLines.push(
      trimmed.replace(/^\*{1,3}/, "").replace(/\*{1,3}$/, "").trim(),
    );
  }

  return {
    name,
    details: detailLines.join("\n"),
    options,
  };
}

