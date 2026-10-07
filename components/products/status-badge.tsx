import { STATUS_META, type ProductStatus } from "@/types";

export function StatusBadge({ status }: { status: ProductStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${meta.badge}`}
    >
      {meta.label}
    </span>
  );
}
