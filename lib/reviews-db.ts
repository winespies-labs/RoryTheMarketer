import type { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { getPrisma } from "@/lib/prisma";
import { readReviewsFile } from "@/lib/reviews-file";
import type { Review, ReviewSource, ReviewsData } from "@/lib/reviews";

function rowToReview(row: {
  id: string;
  source: string;
  title: string | null;
  content: string;
  author: string | null;
  rating: number | null;
  createdAt: Date;
  slackMessageTs: string | null;
  starred: boolean;
  topics: string[];
}): Review {
  return {
    id: row.id,
    source: row.source as ReviewSource,
    title: row.title ?? undefined,
    content: row.content,
    author: row.author ?? undefined,
    rating: row.rating ?? undefined,
    createdAt: row.createdAt.toISOString(),
    slackMessageTs: row.slackMessageTs ?? undefined,
    starred: row.starred,
    topics: row.topics?.length ? row.topics : undefined,
  };
}

async function touchMeta(
  brandId: string,
  slackChannelId?: string
): Promise<void> {
  const prisma = getPrisma();
  await prisma.brandReviewMeta.upsert({
    where: { brandId },
    create: {
      brandId,
      updatedAt: new Date(),
      slackChannelId: slackChannelId ?? null,
    },
    update: {
      updatedAt: new Date(),
      ...(slackChannelId !== undefined ? { slackChannelId } : {}),
    },
  });
}

export async function importJsonToDbIfEmpty(brandId: string): Promise<void> {
  const prisma = getPrisma();
  const count = await prisma.customerReview.count({ where: { brandId } });
  if (count > 0) return;

  const file = readReviewsFile(brandId);
  if (file.reviews.length === 0) return;

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.customerReview.createMany({
      skipDuplicates: true,
      data: file.reviews.map((r) => ({
        id: r.id,
        brandId,
        source: r.source,
        title: r.title ?? null,
        content: r.content,
        author: r.author ?? null,
        rating: r.rating ?? null,
        createdAt: new Date(r.createdAt),
        slackMessageTs: r.slackMessageTs ?? null,
        starred: r.starred ?? false,
        topics: r.topics ?? [],
      })),
    });
    await tx.brandReviewMeta.upsert({
      where: { brandId },
      create: {
        brandId,
        updatedAt: now,
        slackChannelId: file.slackChannelId ?? null,
      },
      update: {
        updatedAt: now,
        slackChannelId: file.slackChannelId ?? null,
      },
    });
  });
}

export async function loadReviewsFromDb(brandId: string): Promise<ReviewsData> {
  const prisma = getPrisma();
  const [rows, meta] = await Promise.all([
    prisma.customerReview.findMany({
      where: { brandId },
      orderBy: [{ starred: "desc" }, { createdAt: "desc" }],
    }),
    prisma.brandReviewMeta.findUnique({ where: { brandId } }),
  ]);

  return {
    updatedAt: meta?.updatedAt.toISOString() ?? new Date().toISOString(),
    slackChannelId: meta?.slackChannelId ?? undefined,
    reviews: rows.map(rowToReview),
  };
}

export async function mergeReviewsDb(
  brandId: string,
  incoming: Omit<Review, "id">[],
  options?: { slackChannelId?: string }
): Promise<{ added: number; total: number }> {
  const prisma = getPrisma();
  const existingTs = await prisma.customerReview.findMany({
    where: { brandId, slackMessageTs: { not: null } },
    select: { slackMessageTs: true },
  });
  const tsSet = new Set(
    existingTs.map((e) => e.slackMessageTs).filter(Boolean) as string[]
  );

  const existingIds = await prisma.customerReview.findMany({
    where: { brandId },
    select: { id: true },
  });
  const idSet = new Set(existingIds.map((x) => x.id));

  let added = 0;
  for (const r of incoming) {
    if (r.slackMessageTs && tsSet.has(r.slackMessageTs)) continue;
    let id = nanoid();
    while (idSet.has(id)) id = nanoid();

    try {
      await prisma.customerReview.create({
        data: {
          id,
          brandId,
          source: r.source,
          title: r.title ?? null,
          content: r.content,
          author: r.author ?? null,
          rating: r.rating ?? null,
          createdAt: new Date(r.createdAt),
          slackMessageTs: r.slackMessageTs ?? null,
          starred: false,
          topics: [],
        },
      });
    } catch {
      continue;
    }
    idSet.add(id);
    if (r.slackMessageTs) tsSet.add(r.slackMessageTs);
    added++;
  }

  await touchMeta(brandId, options?.slackChannelId);

  const total = await prisma.customerReview.count({ where: { brandId } });
  return { added, total };
}

export async function updateReviewMetadataDb(
  brandId: string,
  reviewId: string,
  patch: { starred?: boolean; topics?: string[] }
): Promise<Review | null> {
  const prisma = getPrisma();
  const data: Prisma.CustomerReviewUpdateInput = {};
  if (patch.starred !== undefined) data.starred = patch.starred;
  if (patch.topics !== undefined) data.topics = patch.topics;

  const existing = await prisma.customerReview.findFirst({
    where: { id: reviewId, brandId },
  });
  if (!existing) return null;

  const row = await prisma.customerReview.update({
    where: { id: reviewId },
    data,
  });
  await touchMeta(brandId);
  return rowToReview(row);
}

export interface ListReviewsFilters {
  q?: string;
  topic?: string;
  starredOnly?: boolean;
  source?: string;
  minRating?: number;
  limit: number;
  offset: number;
}

export async function listReviewsFromDb(
  brandId: string,
  filters: ListReviewsFilters
): Promise<{
  page: Review[];
  storeTotal: number;
  matchCount: number;
  topicsInUse: string[];
  updatedAt: string;
  slackChannelId?: string;
}> {
  const prisma = getPrisma();
  const meta = await prisma.brandReviewMeta.findUnique({
    where: { brandId },
  });

  const q = filters.q?.trim();
  const topic = filters.topic?.trim();
  const andParts: Prisma.CustomerReviewWhereInput[] = [{ brandId }];
  if (q) {
    andParts.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { content: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (topic) {
    andParts.push({ topics: { has: topic } });
  }
  if (filters.starredOnly) {
    andParts.push({ starred: true });
  }
  if (filters.source) {
    andParts.push({ source: filters.source });
  }
  if (filters.minRating && filters.minRating > 0) {
    andParts.push({ rating: { gte: filters.minRating } });
  }
  const where: Prisma.CustomerReviewWhereInput =
    andParts.length === 1 ? { brandId } : { AND: andParts };

  const [storeTotal, matchCount, pageRows, topicRows] = await Promise.all([
    prisma.customerReview.count({ where: { brandId } }),
    prisma.customerReview.count({ where }),
    prisma.customerReview.findMany({
      where,
      orderBy: [{ starred: "desc" }, { createdAt: "desc" }],
      skip: filters.offset,
      take: filters.limit,
    }),
    prisma.customerReview.findMany({
      where: { brandId },
      select: { topics: true },
    }),
  ]);

  const topicSet = new Map<string, string>();
  for (const tr of topicRows) {
    for (const t of tr.topics) {
      const s = t.trim();
      if (!s) continue;
      const k = s.toLowerCase();
      if (!topicSet.has(k)) topicSet.set(k, s);
    }
  }
  const topicsInUse = Array.from(topicSet.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  return {
    page: pageRows.map(rowToReview),
    storeTotal,
    matchCount,
    topicsInUse,
    updatedAt: meta?.updatedAt.toISOString() ?? new Date().toISOString(),
    slackChannelId: meta?.slackChannelId ?? undefined,
  };
}
