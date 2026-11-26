import { redirect } from "next/navigation";
import { scopedForumPath } from "@/lib/project-paths";

/** Clusters live in the project forum now (#agent-clusters): an old cluster link opens it there. */
export default async function OldClusterPage({ params }: { params: Promise<{ org: string; project: string; clusterId: string }> }) {
  const { org, project, clusterId } = await params;
  redirect(`${scopedForumPath("project", decodeURIComponent(org), decodeURIComponent(project))}/clusters/${encodeURIComponent(decodeURIComponent(clusterId))}`);
}
