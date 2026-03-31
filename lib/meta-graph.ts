type GraphError = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
};

export type GraphPaging = {
  next?: string;
};

export type GraphListResponse<T> = {
  data: T[];
  paging?: GraphPaging;
  error?: GraphError;
};

function getAccessToken(): string {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    throw new Error("Missing META_ACCESS_TOKEN env var");
  }
  return token;
}

function withAccessToken(params?: Record<string, string | number | boolean | undefined>): URLSearchParams {
  const search = new URLSearchParams();
  search.set("access_token", getAccessToken());
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) continue;
      search.set(k, String(v));
    }
  }
  return search;
}

export async function graphGet<T>(
  graphPath: string,
  params?: Record<string, string | number | boolean | undefined>,
  options?: { apiVersion?: string }
): Promise<T> {
  const apiVersion = options?.apiVersion ?? "v20.0";
  const url = new URL(`https://graph.facebook.com/${apiVersion}/${graphPath.replace(/^\//, "")}`);
  url.search = withAccessToken(params).toString();

  const res = await fetch(url.toString(), { method: "GET" });
  const json = (await res.json()) as { error?: GraphError };
  if (!res.ok || json?.error?.message) {
    const err = json?.error;
    const message = err?.message ?? `Meta Graph request failed (${res.status})`;
    const parts = [message];
    if (err?.code !== undefined) parts.push(`code: ${err.code}`);
    if (err?.error_subcode !== undefined) parts.push(`subcode: ${err.error_subcode}`);
    if (err?.type) parts.push(`type: ${err.type}`);
    throw new Error(parts.length > 1 ? `${message} (${parts.slice(1).join(", ")})` : message);
  }
  return json as T;
}

export async function graphPost<T>(
  graphPath: string,
  body: Record<string, string | number | boolean | undefined>,
  options?: { apiVersion?: string }
): Promise<T> {
  const apiVersion = options?.apiVersion ?? "v20.0";
  const url = `https://graph.facebook.com/${apiVersion}/${graphPath.replace(/^\//, "")}`;

  const form = new URLSearchParams();
  form.set("access_token", getAccessToken());
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined) continue;
    form.set(k, String(v));
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const json = (await res.json()) as { error?: GraphError };
  if (!res.ok || json?.error?.message) {
    const err = json?.error;
    const message = err?.message ?? `Meta Graph POST failed (${res.status})`;
    const parts = [message];
    if (err?.code !== undefined) parts.push(`code: ${err.code}`);
    if (err?.error_subcode !== undefined) parts.push(`subcode: ${err.error_subcode}`);
    if (err?.type) parts.push(`type: ${err.type}`);
    throw new Error(parts.length > 1 ? `${message} (${parts.slice(1).join(", ")})` : message);
  }
  return json as T;
}

export async function graphGetAllPages<T>(
  graphPath: string,
  params?: Record<string, string | number | boolean | undefined>,
  options?: { apiVersion?: string; maxPages?: number; maxItems?: number }
): Promise<T[]> {
  const apiVersion = options?.apiVersion ?? "v20.0";
  const maxPages = options?.maxPages ?? 50;
  const maxItems = options?.maxItems ?? Number.POSITIVE_INFINITY;

  let page = 0;
  let url: string | null = null;
  const out: T[] = [];

  while (page < maxPages && out.length < maxItems) {
    page += 1;

    const data: GraphListResponse<T> = url
      ? await (async () => {
          const res = await fetch(url);
          const json = (await res.json()) as GraphListResponse<T>;
          if (!res.ok || json?.error?.message) {
            const err = json?.error;
            const message = err?.message ?? `Meta Graph request failed (${res.status})`;
            const parts = [message];
            if (err?.code !== undefined) parts.push(`code: ${err.code}`);
            if (err?.error_subcode !== undefined) parts.push(`subcode: ${err.error_subcode}`);
            if (err?.type) parts.push(`type: ${err.type}`);
            throw new Error(parts.length > 1 ? `${message} (${parts.slice(1).join(", ")})` : message);
          }
          return json;
        })()
      : await graphGet<GraphListResponse<T>>(graphPath, params, { apiVersion });

    if (Array.isArray(data.data)) {
      for (const item of data.data) {
        out.push(item);
        if (out.length >= maxItems) break;
      }
    }

    url = data.paging?.next ?? null;
    if (!url) break;
  }

  return out;
}

