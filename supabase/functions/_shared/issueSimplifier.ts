export function extractAcceptanceCriteria(body: string | null): string[] {
  if (!body) return [];
  const lines = body.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) =>
    /^\s{0,3}(?:#{1,6}\s*)?(?:acceptance criteria|acceptance tests|definition of done)\s*:?\s*$/i.test(line)
  );
  if (headingIndex < 0) return [];

  const criteria: string[] = [];
  for (const line of lines.slice(headingIndex + 1)) {
    if (/^\s{0,3}#{1,6}\s+/.test(line)) break;
    const item = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.+?)\s*$/)?.[1];
    if (item) criteria.push(item);
    if (criteria.length === 15) break;
  }
  return criteria;
}
