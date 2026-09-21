import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";

export type LibraryItemType = "book" | "course" | "media" | "file" | "url";
export type LibraryItem = { projectId: string; projectType: LibraryItemType; title: string; thumbnailUrl: string | null; status: string; acquiredVia: "purchased" | "free"; acquiredAt: string };
const TYPES: LibraryItemType[] = ["book", "course", "media", "file", "url"];

export function libraryItemUrl(item: Pick<LibraryItem, "projectId" | "projectType">) {
  const path = item.projectType === "book" ? `books/${item.projectId}` : item.projectType === "course" ? `courses/${item.projectId}` : `projects/${item.projectId}`;
  return `https://ako-taupe.vercel.app/${path}`;
}

export function useLibrary() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["library", user?.id], enabled: !!user,
    queryFn: async (): Promise<LibraryItem[]> => {
      const byProject = new Map<string, LibraryItem>();
      const [purchasesResult, eventsResult] = await Promise.all([
        supabase.from("purchases").select("created_at, project:projects!purchases_project_id_fkey(id, title, thumbnail_url, project_type, status)").eq("buyer_id", user!.id),
        supabase.from("project_access_events").select("created_at, project:projects!project_access_events_project_id_fkey(id, title, thumbnail_url, project_type, status)").eq("user_id", user!.id).order("created_at", { ascending: false }),
      ]);
      if (purchasesResult.error) throw purchasesResult.error;
      if (eventsResult.error) throw eventsResult.error;
      for (const row of (purchasesResult.data as any[]) ?? []) { const project = Array.isArray(row.project) ? row.project[0] : row.project; if (!project || !TYPES.includes(project.project_type)) continue; byProject.set(project.id, { projectId: project.id, projectType: project.project_type, title: project.title, thumbnailUrl: project.thumbnail_url, status: project.status, acquiredVia: "purchased", acquiredAt: row.created_at }); }
      for (const row of (eventsResult.data as any[]) ?? []) { const project = Array.isArray(row.project) ? row.project[0] : row.project; if (!project || !TYPES.includes(project.project_type) || byProject.has(project.id)) continue; byProject.set(project.id, { projectId: project.id, projectType: project.project_type, title: project.title, thumbnailUrl: project.thumbnail_url, status: project.status, acquiredVia: "free", acquiredAt: row.created_at }); }
      return [...byProject.values()].sort((a, b) => new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime());
    },
  });
}
