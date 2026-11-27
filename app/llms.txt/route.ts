import { buildLlmsResponse, loadLlmsRoot } from "@/lib/llms-docs";

export const dynamic = "force-static";

/** `/llms.txt` (#instructions): what Ziki is and where a connected agent goes next (its organisation's `/<org>/agents.txt`). */
export async function GET(request: Request) {
  return buildLlmsResponse(request, loadLlmsRoot(), "text/plain; charset=utf-8");
}
