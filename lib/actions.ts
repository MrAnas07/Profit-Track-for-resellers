"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CATEGORIES } from "@/types";
import type {
  ActionResult,
  BootstrapData,
  Category,
  NormalizedBackup,
  Product,
  ProductInput,
  RestoreResult,
  SupplierGroup,
} from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function prismaCode(cause: unknown): string | null {
  if (typeof cause === "object" && cause !== null && "code" in cause) {
    const code = (cause as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return null;
}

/** Map any failure to a user-safe message (server actions run in prod). */
function toErrorMessage(cause: unknown): string {
  const code = prismaCode(cause);
  if (code === "P2002") return "That name is already in use.";
  if (code === "P2003") return "This item is still linked to products.";
  if (code === "P2025") return "This item no longer exists.";
  if (code?.startsWith("P1")) {
    return "Could not reach the database. Check your connection and try again.";
  }
  if (
    cause instanceof Error &&
    cause.message &&
    !cause.message.startsWith("Invalid")
  ) {
    return cause.message;
  }
  return "Something went wrong. Please try again.";
}

function fail<T>(cause: unknown): ActionResult<T> {
  return { ok: false, error: toErrorMessage(cause) };
}

async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("You must be signed in.");
  return userId;
}

/**
 * Make sure a Prisma User row exists for this Clerk user (auto-created on
 * first sign-in). Returns true when the row was just created.
 */
async function ensureUserRow(userId: string): Promise<boolean> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (existing) return false;

  const { sessionClaims } = await auth();
  const claims = (sessionClaims ?? {}) as {
    email?: string;
    name?: string;
    image?: string;
  };
  try {
    await prisma.user.create({
      data: {
        id: userId,
        email: claims.email ?? null,
        name: claims.name ?? null,
        imageUrl: claims.image ?? null,
      },
    });
    return true;
  } catch (cause) {
    // Parallel requests may race the insert — unique violation is fine.
    if (prismaCode(cause) === "P2002") return false;
    throw cause;
  }
}

/** Cross-tenant safety: the referenced group/category must belong to userId. */
async function resolveReferences(
  userId: string,
  input: Pick<ProductInput, "supplierGroupId" | "categoryId">,
): Promise<{ supplierGroupId: number; categoryId: number | null }> {
  const group = await prisma.supplierGroup.findFirst({
    where: { id: input.supplierGroupId, userId },
    select: { id: true },
  });
  if (!group) throw new Error("Supplier group not found.");

  let categoryId: number | null = null;
  if (input.categoryId != null) {
    const category = await prisma.category.findFirst({
      where: { id: input.categoryId, userId },
      select: { id: true },
    });
    if (!category) throw new Error("Category not found.");
    categoryId = category.id;
  }
  return { supplierGroupId: group.id, categoryId };
}

const PRODUCT_INCLUDE = {
  priceOptions: { orderBy: { sortOrder: "asc" as const } },
  priceHistory: { orderBy: { at: "asc" as const } },
} as const;

async function findProductRecord(id: number, userId: string) {
  return prisma.product.findFirst({
    where: { id, userId },
    include: PRODUCT_INCLUDE,
  });
}

type ProductWithRelations = NonNullable<Awaited<ReturnType<typeof findProductRecord>>>;

function mapProduct(product: ProductWithRelations): Product {
  return {
    id: product.id,
    name: product.name,
    details: product.details,
    status: product.status,
    quantity: product.quantity,
    supplierGroupId: product.supplierGroupId,
    categoryId: product.categoryId,
    createdAt: product.createdAt.getTime(),
    updatedAt: product.updatedAt.getTime(),
    originalMessage: product.originalMessage,
    priceOptions: product.priceOptions.map((option) => ({
      id: option.id,
      name: option.name,
      costPrice: option.costPrice,
      sellPrice: option.sellPrice,
    })),
    priceHistory: product.priceHistory.map((entry) => ({
      at: entry.at.getTime(),
      optionId: entry.optionId ?? "",
      optionName: entry.optionName,
      costPrice: entry.costPrice,
      sellPrice: entry.sellPrice,
    })),
  };
}

function mapGroup(group: {
  id: number;
  name: string;
  createdAt: Date;
}): SupplierGroup {
  return { id: group.id, name: group.name, createdAt: group.createdAt.getTime() };
}

function mapCategory(category: {
  id: number;
  name: string;
  createdAt: Date;
}): Category {
  return {
    id: category.id,
    name: category.name,
    createdAt: category.createdAt.getTime(),
  };
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

/**
 * One round trip for the whole client: ensures the User row exists, seeds
 * default categories for fresh accounts, and returns all scoped data.
 */
export async function getBootstrapData(): Promise<BootstrapData> {
  const userId = await requireUserId();
  await ensureUserRow(userId);

  const [groups, categories, products] = await Promise.all([
    prisma.supplierGroup.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: PRODUCT_INCLUDE,
    }),
  ]);

  // Fresh account (or a full reset): seed the six default categories.
  let seededCategories = categories;
  if (categories.length === 0 && products.length === 0 && groups.length === 0) {
    await prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map((name) => ({ userId, name })),
    });
    seededCategories = await prisma.category.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });
  }

  return {
    supplierGroups: groups.map(mapGroup),
    categories: seededCategories.map(mapCategory),
    products: products.map(mapProduct),
  };
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function createProduct(
  input: ProductInput,
): Promise<ActionResult<Product>> {
  try {
    const userId = await requireUserId();
    await ensureUserRow(userId);
    const refs = await resolveReferences(userId, input);

    const now = new Date();
    const created = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          userId,
          name: input.name,
          details: input.details,
          status: input.status,
          quantity: input.quantity,
          supplierGroupId: refs.supplierGroupId,
          categoryId: refs.categoryId,
          originalMessage: input.originalMessage ?? null,
          createdAt: input.createdAt ? new Date(input.createdAt) : now,
          updatedAt: now,
        },
      });
      await tx.priceOption.createMany({
        data: input.priceOptions.map((option, index) => ({
          id: option.id,
          userId,
          productId: product.id,
          name: option.name,
          costPrice: option.costPrice,
          sellPrice: option.sellPrice,
          sortOrder: index,
        })),
      });
      await tx.priceHistory.createMany({
        data: input.priceHistory.map((entry) => ({
          userId,
          productId: product.id,
          optionId: entry.optionId || null,
          optionName: entry.optionName ?? "",
          costPrice: entry.costPrice,
          sellPrice: entry.sellPrice,
          at: new Date(entry.at),
        })),
      });
      return product;
    });

    const full = await findProductRecord(created.id, userId);
    if (!full) throw new Error("Product not found.");
    return { ok: true, data: mapProduct(full) };
  } catch (cause) {
    return fail(cause);
  }
}

export async function updateProduct(
  id: number,
  input: ProductInput,
): Promise<ActionResult<Product>> {
  try {
    const userId = await requireUserId();
    await ensureUserRow(userId);

    const existing = await prisma.product.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) throw new Error("Product not found.");

    const refs = await resolveReferences(userId, input);
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          name: input.name,
          details: input.details,
          status: input.status,
          quantity: input.quantity,
          supplierGroupId: refs.supplierGroupId,
          categoryId: refs.categoryId,
          originalMessage: input.originalMessage ?? null,
          updatedAt: now,
        },
      });
      // Options and history are replaced wholesale (array order = sort order;
      // history references options by plain string id, not FK).
      await tx.priceOption.deleteMany({ where: { productId: id } });
      await tx.priceOption.createMany({
        data: input.priceOptions.map((option, index) => ({
          id: option.id,
          userId,
          productId: id,
          name: option.name,
          costPrice: option.costPrice,
          sellPrice: option.sellPrice,
          sortOrder: index,
        })),
      });
      await tx.priceHistory.deleteMany({ where: { productId: id } });
      await tx.priceHistory.createMany({
        data: input.priceHistory.map((entry) => ({
          userId,
          productId: id,
          optionId: entry.optionId || null,
          optionName: entry.optionName ?? "",
          costPrice: entry.costPrice,
          sellPrice: entry.sellPrice,
          at: new Date(entry.at),
        })),
      });
    });

    const full = await findProductRecord(id, userId);
    if (!full) throw new Error("Product not found.");
    return { ok: true, data: mapProduct(full) };
  } catch (cause) {
    return fail(cause);
  }
}

export async function deleteProduct(id: number): Promise<ActionResult<null>> {
  try {
    const userId = await requireUserId();
    await ensureUserRow(userId);
    await prisma.product.deleteMany({ where: { id, userId } });
    return { ok: true, data: null };
  } catch (cause) {
    return fail(cause);
  }
}

// ---------------------------------------------------------------------------
// Supplier groups
// ---------------------------------------------------------------------------

export async function createSupplierGroup(
  name: string,
): Promise<ActionResult<SupplierGroup>> {
  try {
    const userId = await requireUserId();
    await ensureUserRow(userId);
    const group = await prisma.supplierGroup.create({
      data: { userId, name },
    });
    return { ok: true, data: mapGroup(group) };
  } catch (cause) {
    return fail(cause);
  }
}

export async function updateSupplierGroup(
  id: number,
  name: string,
): Promise<ActionResult<SupplierGroup>> {
  try {
    const userId = await requireUserId();
    await ensureUserRow(userId);
    const group = await prisma.supplierGroup.update({
      where: { id, userId },
      data: { name },
    });
    return { ok: true, data: mapGroup(group) };
  } catch (cause) {
    return fail(cause);
  }
}

export async function deleteSupplierGroup(
  id: number,
): Promise<ActionResult<null>> {
  try {
    const userId = await requireUserId();
    await ensureUserRow(userId);
    await prisma.supplierGroup.delete({ where: { id, userId } });
    return { ok: true, data: null };
  } catch (cause) {
    return fail(cause);
  }
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function createCategory(
  name: string,
): Promise<ActionResult<Category>> {
  try {
    const userId = await requireUserId();
    await ensureUserRow(userId);
    const category = await prisma.category.create({ data: { userId, name } });
    return { ok: true, data: mapCategory(category) };
  } catch (cause) {
    return fail(cause);
  }
}

export async function updateCategory(
  id: number,
  name: string,
): Promise<ActionResult<Category>> {
  try {
    const userId = await requireUserId();
    await ensureUserRow(userId);
    const category = await prisma.category.update({
      where: { id, userId },
      data: { name },
    });
    return { ok: true, data: mapCategory(category) };
  } catch (cause) {
    return fail(cause);
  }
}

export async function deleteCategory(id: number): Promise<ActionResult<null>> {
  try {
    const userId = await requireUserId();
    await ensureUserRow(userId);
    // Products referencing this category get categoryId = NULL (schema SetNull).
    await prisma.category.delete({ where: { id, userId } });
    return { ok: true, data: null };
  } catch (cause) {
    return fail(cause);
  }
}

// ---------------------------------------------------------------------------
// Backup restore / local migration / reset
// ---------------------------------------------------------------------------

/**
 * Replace ALL of the signed-in user's data with a normalized backup.
 * Used by "Restore from backup file" and "Migrate local data".
 */
export async function restoreBackupData(
  backup: NormalizedBackup,
): Promise<ActionResult<RestoreResult>> {
  try {
    const userId = await requireUserId();
    await ensureUserRow(userId);

    let fallbackGroupId: number | null = null;
    const ensureFallbackGroup = async (): Promise<number> => {
      if (fallbackGroupId != null) return fallbackGroupId;
      const created = await prisma.supplierGroup.create({
        data: { userId, name: "Imported Suppliers" },
      });
      fallbackGroupId = created.id;
      return created.id;
    };

    const result = await prisma.$transaction(async (tx) => {
      // Replace everything owned by this user.
      await tx.product.deleteMany({ where: { userId } });
      await tx.supplierGroup.deleteMany({ where: { userId } });
      await tx.category.deleteMany({ where: { userId } });

      const supplierIdMap = new Map<number, number>();
      for (const group of backup.supplierGroups) {
        const created = await tx.supplierGroup.create({
          data: {
            userId,
            name: group.name,
            createdAt: new Date(group.createdAt),
          },
        });
        if (group.oldId != null) supplierIdMap.set(group.oldId, created.id);
      }

      const categoryIdMap = new Map<number, number>();
      for (const category of backup.categories) {
        const created = await tx.category.create({
          data: {
            userId,
            name: category.name,
            createdAt: new Date(category.createdAt),
          },
        });
        if (category.oldId != null) categoryIdMap.set(category.oldId, created.id);
      }

      for (const product of backup.products) {
        let supplierGroupId: number | null = null;
        if (product.oldSupplierId != null) {
          supplierGroupId = supplierIdMap.get(product.oldSupplierId) ?? null;
        }
        if (supplierGroupId == null) {
          supplierGroupId = await ensureFallbackGroup();
        }
        const categoryId =
          product.oldCategoryId != null
            ? (categoryIdMap.get(product.oldCategoryId) ?? null)
            : null;

        const created = await tx.product.create({
          data: {
            userId,
            name: product.name,
            details: product.details,
            status: product.status,
            quantity: product.quantity,
            supplierGroupId,
            categoryId,
            originalMessage: product.originalMessage,
            createdAt: new Date(product.createdAt),
            updatedAt: new Date(product.updatedAt),
          },
        });
        await tx.priceOption.createMany({
          data: product.priceOptions.map((option, index) => ({
            id: option.id,
            userId,
            productId: created.id,
            name: option.name,
            costPrice: option.costPrice,
            sellPrice: option.sellPrice,
            sortOrder: index,
          })),
        });
        await tx.priceHistory.createMany({
          data: product.priceHistory.map((entry) => ({
            userId,
            productId: created.id,
            optionId: entry.optionId || null,
            optionName: entry.optionName ?? "",
            costPrice: entry.costPrice,
            sellPrice: entry.sellPrice,
            at: new Date(entry.at),
          })),
        });
      }

      return {
        suppliers: backup.supplierGroups.length,
        categories: backup.categories.length,
        products: backup.products.length,
      };
    });

    return { ok: true, data: result };
  } catch (cause) {
    return fail(cause);
  }
}

/** Danger zone: wipe everything for the signed-in user. */
export async function clearAllData(): Promise<ActionResult<null>> {
  try {
    const userId = await requireUserId();
    await ensureUserRow(userId);
    await prisma.$transaction([
      prisma.product.deleteMany({ where: { userId } }),
      prisma.supplierGroup.deleteMany({ where: { userId } }),
      prisma.category.deleteMany({ where: { userId } }),
    ]);
    return { ok: true, data: null };
  } catch (cause) {
    return fail(cause);
  }
}
