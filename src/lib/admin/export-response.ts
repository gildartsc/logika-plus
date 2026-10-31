import "server-only";

export function csvResponse(csv: string, baseName: string): Response {
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${baseName}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
