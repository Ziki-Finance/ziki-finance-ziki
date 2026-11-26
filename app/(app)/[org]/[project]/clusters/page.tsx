import { redirect } from "next/navigation";
import { scopedForumPath } from "@/lib/project-paths";

/** Clusters live in the project forum now (#agent-clusters): old links land on its Clusters list. */
export default async function OldClustersPage({ params }: { params: Promise<{ org: string; project: string }> }) {
  const { org, project } = await params;
  redirect(`${scopedForumPath("project", decodeURIComponent(org), decodeURIComponent(project))}/clusters`);
}
