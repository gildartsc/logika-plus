import { csvResponse } from "@/lib/admin/export-response";
import { buildAttemptsCsv } from "@/lib/admin/queries";

// buildAttemptsCsv() checks the admin role before reading anything.
export async function GET() {
  return csvResponse(await buildAttemptsCsv(), "attempts");
}
