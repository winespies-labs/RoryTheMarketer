import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { graphGetAllPages } from "@/lib/meta-graph";
import { fetchRunningAdsWithStoryIds } from "@/lib/meta-marketing";
import { writeMetaComments } from "@/lib/meta-comments-storage";
import type { MetaStoredComment } from "@/lib/meta-comments";

export const maxDuration = 60;

type GraphComment = {
  id: string;
  message?: string;
  created_time?: string;
  from?: { id?: string; name?: string };
  like_count?: number;
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const brandId = body.brand as string | undefined;
  const campaignIds = body.campaignIds as string[] | undefined;
  const adIds = body.adIds as string[] | undefined;
  const limitAds = typeof body.limitAds === "number" ? body.limitAds : undefined;
  const adIdToPostId = (body.adIdToPostId ?? {}) as Record<string, string>;
  const maxItemsPerPost = typeof body.maxItemsPerPost === "number" ? body.maxItemsPerPost : 500;

  if (!brandId || !getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }

  // Only sync comments from ads: resolve post IDs via running ads (effective_object_story_id).
  // We do not accept raw page post IDs — comments are pulled from the posts your ads promote.
  let resolvedAdIdToPostId: Record<string, string> = { ...(adIdToPostId ?? {}) };
  if (Object.keys(resolvedAdIdToPostId).length === 0) {
    const runningAds = await fetchRunningAdsWithStoryIds({
      brandId,
      campaignIds,
      adIds,
      limitAds,
    });
    for (const ad of runningAds) {
      const postId = ad.effective_object_story_id?.trim();
      if (!postId) continue;
      resolvedAdIdToPostId[ad.id] = postId;
    }
  }

  const uniquePostIds = Array.from(
    new Set(
      Object.values(resolvedAdIdToPostId ?? {}).filter((x) => typeof x === "string" && x.trim().length > 0)
    )
  );

  if (uniquePostIds.length === 0) {
    return NextResponse.json(
      {
        error:
          "No ad-backed posts found. Configure META_AD_ACCOUNT_ID and ensure your active ads have effective_object_story_id (e.g. ads that promote a page post).",
      },
      { status: 400 }
    );
  }

  const postIdToAdIds = new Map<string, string[]>();
  for (const [adId, postId] of Object.entries(resolvedAdIdToPostId ?? {})) {
    if (!postId) continue;
    const arr = postIdToAdIds.get(postId) ?? [];
    arr.push(adId);
    postIdToAdIds.set(postId, arr);
  }

  const comments: MetaStoredComment[] = [];

  for (const postId of uniquePostIds) {
    const graphComments = await graphGetAllPages<GraphComment>(`/${postId}/comments`, {
      fields: "id,message,created_time,from{id,name},like_count",
      limit: 100,
    }, { maxItems: maxItemsPerPost });

    const adIds = postIdToAdIds.get(postId) ?? [];
    for (const c of graphComments) {
      const text = (c.message ?? "").trim();
      if (!text) continue;
      const base = {
        postId,
        commentId: c.id,
        text,
        createdTime: c.created_time,
        from: c.from?.id || c.from?.name ? { id: c.from?.id, name: c.from?.name } : undefined,
        likeCount: typeof c.like_count === "number" ? c.like_count : undefined,
      } satisfies Omit<MetaStoredComment, "adId">;

      if (adIds.length === 0) {
        comments.push(base);
      } else {
        for (const adId of adIds) comments.push({ ...base, adId });
      }
    }
  }

  const syncedAt = new Date().toISOString();
  writeMetaComments(brandId, { syncedAt, adIdToPostId: resolvedAdIdToPostId ?? {}, comments });

  return NextResponse.json({ ok: true, syncedAt, postCount: uniquePostIds.length, commentCount: comments.length });
}

