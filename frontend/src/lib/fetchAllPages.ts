// Backend list endpoints cap `limit` (100 for most, 200 for attendance) no matter
// what the client asks for, so a report that sends `limit: "500"` silently gets
// only the first page. This walks every page and returns the complete data set
// in the same `{ ...response, data }` shape callers already expect.
const PAGE_SIZE = 100;
const PARALLEL = 4;

type PageFn = (params?: Record<string, string>) => Promise<any>;

export async function fetchAllPages(
  fn: PageFn,
  params: Record<string, string> = {},
): Promise<any> {
  const first = await fn({ ...params, page: "1", limit: String(PAGE_SIZE) });
  const pages = Number(first?.pages) || 1;
  if (!first?.success || !Array.isArray(first.data) || pages <= 1) return first;

  const all: any[] = [...first.data];
  for (let start = 2; start <= pages; start += PARALLEL) {
    const batch = [];
    for (let p = start; p < start + PARALLEL && p <= pages; p++) {
      batch.push(fn({ ...params, page: String(p), limit: String(PAGE_SIZE) }));
    }
    const results = await Promise.all(batch);
    for (const r of results) if (Array.isArray(r?.data)) all.push(...r.data);
  }
  return { ...first, data: all, page: 1, pages: 1, total: all.length };
}
