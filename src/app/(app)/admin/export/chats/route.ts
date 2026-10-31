import { csvResponse } from "@/lib/admin/export-response";
import { buildChatsCsv } from "@/lib/admin/queries";

// buildChatsCsv() checks the admin role before reading anything.
export async function GET() {
  return csvResponse(await buildChatsCsv(), "chats");
}
