export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;

      const item = items[index];

      if (item === undefined) {
        continue;
      }

      results[index] = await mapper(item, index);
    }
  }

  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, () => run());
  await Promise.all(workers);

  return results;
}
