import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { signedFileUrl } from "@/lib/files/store";

// Opens an attached file: its owner or an admin gets a 60-second signed URL,
// anyone else gets "not found" (no hint that the file exists).
export async function GET(_request: Request, { params }: RouteContext<"/files/[id]">) {
  const viewer = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const link = await signedFileUrl(id, { id: viewer.id, role: viewer.role });
  if (!link) notFound();
  redirect(link.url);
}
