// File: features/projects/api.ts
import { useEffect } from "react";
import { File } from "expo-file-system";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";

export type ProjectType = "file" | "url" | "meeting" | "media" | "gig" | "pitch" | "book" | "event" | "room" | "course";
export type GigRole = { id: string; key: string; label: string; category: string; sort_order: number };
export type GigSample = { id: string; title: string; thumbnail_url: string | null; project_type: ProjectType };
export type MyGig = { id: string; title: string; thumbnail_url: string | null; status: string; created_at: string; role_label: string | null; category: string | null; is_complete: boolean; source: "manual" | "auto_project" | "auto_collaboration" };

export function useGigRoles() {
  return useQuery({ queryKey: ["gig-roles"], staleTime: 60 * 60_000, queryFn: async (): Promise<GigRole[]> => {
    const { data, error } = await supabase.from("gig_roles").select("id, key, label, category, sort_order").eq("is_active", true).order("category").order("sort_order");
    if (error) throw error;
    return data as GigRole[];
  }});
}

export function useGigSamples() {
  const { user } = useAuth();
  return useQuery({ queryKey: ["eligible-gig-samples", user?.id], enabled: !!user, queryFn: async (): Promise<GigSample[]> => {
    const { data, error } = await supabase.from("projects").select("id, title, thumbnail_url, project_type").eq("owner_id", user!.id).neq("project_type", "gig");
    if (error) throw error;
    return data as GigSample[];
  }});
}

export function useMyGigs() {
  const { user } = useAuth();
  return useQuery({ queryKey: ["my-gigs", user?.id], enabled: !!user, queryFn: async (): Promise<MyGig[]> => {
    const { data, error } = await supabase.from("projects").select("id, title, thumbnail_url, status, created_at, project_gig_details!inner(is_complete, source, gig_roles(label, category))").eq("owner_id", user!.id).eq("project_type", "gig").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row: any) => {
      const details = Array.isArray(row.project_gig_details) ? row.project_gig_details[0] : row.project_gig_details;
      const role = Array.isArray(details?.gig_roles) ? details.gig_roles[0] : details?.gig_roles;
      return { id: row.id, title: row.title, thumbnail_url: row.thumbnail_url, status: row.status, created_at: row.created_at, role_label: role?.label ?? null, category: role?.category ?? null, is_complete: details?.is_complete ?? true, source: details?.source ?? "manual" };
    }).sort((a, b) => Number(a.is_complete) - Number(b.is_complete));
  }});
}

export type CreateProjectInput = {
  title: string;
  description?: string;
  project_type: ProjectType;
  posted_as_page_id?: string;
  external_url?: string;
  file_path?: string;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
  price_usd: number;
  promo_price_usd?: number | null;
  is_private: boolean;
  status?: "draft";
  topic_ids: string[];
  scheduled_at?: string;
  goal_amount_usd?: number;
  book_details?: {
    book_type: "book" | "article";
    content_source: "upload" | "link" | "authored";
    author_name?: string;
    is_own_work: boolean;
    source_credit?: string;
    external_url?: string;
    file_path?: string;
    allow_download?: boolean;
    allow_read_in_app?: boolean;
  };
  gig_details?: {
    role_id: string;
    tagline: string;
    delivery_estimate?: string;
    sample_project_ids: string[];
    revisions_included?: number;
    deliverables?: string[];
    faq?: { question: string; answer: string }[];
  };
  media_details?: {
    has_audio: boolean; has_video: boolean; has_image: boolean;
    audio_source?: "link" | "upload"; audio_url?: string; audio_file_path?: string;
    video_source?: "link" | "upload"; video_url?: string; video_file_path?: string;
    image_source?: "upload"; image_file_path?: string;
  };
};

export function useUploadProjectAsset(bucket: "post-media" | "private-content") {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (asset: { uri: string; name?: string | null; mimeType?: string | null; size?: number | null }) => {
      if (!user) throw new Error("Not signed in");
      const maximum = bucket === "post-media" ? 50 * 1024 * 1024 : 500 * 1024 * 1024;
      if ((asset.size ?? 0) > maximum) throw new Error(bucket === "post-media" ? "Image must be under 50MB." : "File must be under 500MB.");
      const bytes = await new File(asset.uri).arrayBuffer();
      if (!bytes.byteLength) throw new Error("The selected file could not be read.");
      const ext = asset.name?.split(".").pop() || asset.mimeType?.split("/")[1] || "bin";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType: asset.mimeType ?? undefined, upsert: false });
      if (error) throw error;
      return bucket === "post-media" ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : path;
    },
  });
}

export function useCreateProject() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      if (!user) throw new Error("Not signed in");
      const { topic_ids, scheduled_at, goal_amount_usd, book_details, gig_details, media_details, ...project } = input;

      if (project.project_type === "pitch") {
        const { data, error } = await supabase.rpc("create_pitch_project", {
          p_title: project.title,
          p_description: project.description ?? null,
          p_thumbnail_url: project.thumbnail_url ?? null,
          p_thumbnail_width: project.thumbnail_width ?? null,
          p_thumbnail_height: project.thumbnail_height ?? null,
          p_is_private: project.is_private,
          p_posted_as_page_id: project.posted_as_page_id ?? null,
          p_goal_amount_usd: goal_amount_usd,
        });
        if (error) throw error;
        if (topic_ids.length) {
          const { error: topicsError } = await supabase.from("project_topics").insert(topic_ids.map((interest_id) => ({ project_id: data, interest_id })));
          if (topicsError) throw topicsError;
        }
        return { id: data as string };
      }

      const { data, error } = await supabase.from("projects").insert({ ...project, owner_id: user.id }).select("id").single();
      if (error) throw error;
      if (topic_ids.length) {
        const { error: topicsError } = await supabase.from("project_topics").insert(topic_ids.map((interest_id) => ({ project_id: data.id, interest_id })));
        if (topicsError) throw topicsError;
      }
      if (project.project_type === "meeting" && scheduled_at) {
        const { error: detailsError } = await supabase.from("project_meeting_details").insert({ project_id: data.id, scheduled_at, recording_enabled: false });
        if (detailsError) throw detailsError;
      }
      if (project.project_type === "room") {
        const { error: detailsError } = await supabase.from("project_room_details").insert({ project_id: data.id });
        if (detailsError) throw detailsError;
      }
      if (project.project_type === "book" && book_details) {
        const { error: detailsError } = await supabase.from("project_book_details").insert({ project_id: data.id, ...book_details });
        if (detailsError) throw detailsError;
      }
      if (project.project_type === "gig" && gig_details) {
        const { sample_project_ids, ...details } = gig_details;
        const { error: detailsError } = await supabase.from("project_gig_details").insert({ project_id: data.id, ...details });
        if (detailsError) throw detailsError;
        if (sample_project_ids.length) {
          const { error: samplesError } = await supabase.from("project_gig_samples").insert(sample_project_ids.map((sample_project_id, sort_order) => ({ gig_project_id: data.id, sample_project_id, sort_order })));
          if (samplesError) throw samplesError;
        }
      }
      if (project.project_type === "media" && media_details) {
        const { error: detailsError } = await supabase.from("project_media_details").insert({ project_id: data.id, ...media_details });
        if (detailsError) throw detailsError;
      }
      return data;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["user-projects"] }),
  });
}

// ---------------------------------------------------------------------------
// Project detail, access and type details (mirrors web's useProjects, useProjectAccess,
// useProjectMembers, useSavedProjects, useProjectTypeDetails and useProjectFaqs).
// ---------------------------------------------------------------------------
export type ProjectStatus = "active" | "draft" | "archived" | "cancelled";

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  event: "Event", media: "Media", file: "File", url: "URL", course: "Course", room: "Cohort", meeting: "Meeting", gig: "Gig", pitch: "Pitch", book: "Book",
};

export type Project = {
  id: string; owner_id: string; posted_as_page_id: string | null; title: string; description: string | null; external_url: string | null; file_path: string | null;
  thumbnail_url: string | null; thumbnail_width: number | null; thumbnail_height: number | null; project_type: ProjectType; price_usd: number; promo_price_usd: number | null;
  status: ProjectStatus; is_active: boolean; published_at: string | null; cancelled_at: string | null; created_at: string; updated_at: string; is_private: boolean; like_count: number; slug: string | null;
};
export type ProjectOwner = { id: string; username: string; display_name: string; avatar_url: string | null; tier: string; roles: { position: number; label: string }[] };
export type ProjectPage = { id: string; username: string; name: string; avatar_url: string | null; page_type: string | null; is_verified: boolean };
export type ProjectWithOwner = Project & { owner: ProjectOwner; posted_as_page: ProjectPage | null; topics: { id: string; name: string }[] };

// What the buyer actually pays: a promo price, when set, always wins over the listed price (same rule as web and the purchase edge function).
export const getEffectivePrice = (project: Pick<Project, "price_usd" | "promo_price_usd">) => project.promo_price_usd ?? project.price_usd;
export const isProjectFree = (project: Pick<Project, "price_usd" | "promo_price_usd">) => getEffectivePrice(project) <= 0;
export const hasActivePromo = (project: Pick<Project, "price_usd" | "promo_price_usd">) => project.promo_price_usd !== null && project.promo_price_usd !== undefined;

// Resolves the readable message from an edge function failure (mirrors web's resolveFunctionErrorMessage).
export async function projectFunctionError(error: unknown, fallback: string) {
  if (error instanceof FunctionsHttpError) {
    try { const body = await error.context.json(); if (typeof body?.error === "string") return body.error; } catch { /* fall through to the generic message */ }
  }
  return error instanceof Error ? error.message || fallback : fallback;
}

const DETAIL_SELECT = "*, owner:profiles!projects_owner_id_fkey(id, username, display_name, avatar_url, tier, profile_roles(position, role:roles(label))), posted_as_page:pages(id, username, name, avatar_url, page_type, is_verified), topics:project_topics(interest:interests(id, name))";

export function useProjectDetail(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-detail", projectId], enabled: !!projectId,
    queryFn: async (): Promise<ProjectWithOwner> => {
      const { data, error } = await supabase.from("projects").select(DETAIL_SELECT).eq("id", projectId!).single();
      if (error) throw error;
      const raw = data as any;
      const { profile_roles, ...owner } = raw.owner;
      const roles = (Array.isArray(profile_roles) ? profile_roles : []).map((row: any) => { const role = Array.isArray(row.role) ? row.role[0] : row.role; return { position: row.position as number, label: (role?.label ?? "") as string }; }).filter((role: { label: string }) => role.label).sort((a: { position: number }, b: { position: number }) => a.position - b.position);
      return { ...raw, owner: { ...owner, roles }, posted_as_page: raw.posted_as_page ?? null, topics: (raw.topics ?? []).map((row: any) => row.interest).filter(Boolean) };
    },
  });
}

// Three separate rails (same creator, same type, shared topics), all public-only: these are discovery surfaces, which private projects must stay out of.
export function useSimilarProjects(project: (Pick<Project, "id" | "owner_id" | "project_type"> & { topics?: { id: string }[] }) | undefined) {
  return useQuery({
    queryKey: ["similar-projects", project?.id], enabled: !!project,
    queryFn: async () => {
      const topicIds = (project!.topics ?? []).map(topic => topic.id);
      const [creator, sameType, topicLinks] = await Promise.all([
        supabase.from("projects").select("*").eq("owner_id", project!.owner_id).eq("status", "active").eq("is_private", false).neq("id", project!.id).order("created_at", { ascending: false }).limit(6),
        supabase.from("projects").select("*").eq("project_type", project!.project_type).eq("status", "active").eq("is_private", false).neq("id", project!.id).neq("owner_id", project!.owner_id).order("created_at", { ascending: false }).limit(6),
        topicIds.length ? supabase.from("project_topics").select("project_id").in("interest_id", topicIds).neq("project_id", project!.id) : Promise.resolve({ data: [] as { project_id: string }[], error: null }),
      ]);
      if (creator.error) throw creator.error;
      if (sameType.error) throw sameType.error;
      if (topicLinks.error) throw topicLinks.error;
      let moreOnTopic: Project[] = [];
      const topicProjectIds = Array.from(new Set((topicLinks.data ?? []).map(row => row.project_id)));
      if (topicProjectIds.length) {
        const { data, error } = await supabase.from("projects").select("*").in("id", topicProjectIds).eq("status", "active").eq("is_private", false).order("created_at", { ascending: false }).limit(6);
        if (error) throw error;
        moreOnTopic = data as Project[];
      }
      return { moreFromCreator: creator.data as Project[], moreOfType: sameType.data as Project[], moreOnTopic };
    },
  });
}

export function useHasPurchased(projectId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["has-purchased", projectId, user?.id], enabled: !!user && !!projectId,
    queryFn: async () => {
      const { data } = await supabase.from("purchases").select("id").eq("project_id", projectId).eq("buyer_id", user!.id).maybeSingle();
      return !!data;
    },
  });
}

export function usePurchaseProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string) => {
      const { data, error } = await supabase.functions.invoke("purchase-project", { body: { project_id: projectId } });
      if (error) throw new Error(await projectFunctionError(error, "Purchase failed."));
      if (data?.error) throw new Error(data.error);
      return data.purchase;
    },
    onSuccess: (_data, projectId) => {
      void client.invalidateQueries({ queryKey: ["has-purchased", projectId] });
      void client.invalidateQueries({ queryKey: ["wallet"] });
      void client.invalidateQueries({ queryKey: ["project-access-count", projectId] });
    },
  });
}

// A gig "purchase" is a booking-fee deposit that also drops the buyer into a conversation with the host (book-gig does both).
export function useBookGig() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string): Promise<{ conversationId: string }> => {
      const { data, error } = await supabase.functions.invoke("book-gig", { body: { project_id: projectId } });
      if (error) throw new Error(await projectFunctionError(error, "Booking failed."));
      if (data?.error) throw new Error(data.error);
      return { conversationId: data.conversation_id };
    },
    onSuccess: (_data, projectId) => {
      void client.invalidateQueries({ queryKey: ["has-purchased", projectId] });
      void client.invalidateQueries({ queryKey: ["wallet"] });
      void client.invalidateQueries({ queryKey: ["mobile-conversations"] });
    },
  });
}

// Short-lived signed URL for a hosted file. The edge function is the access gate (owner / free / purchased).
export function useGetProjectFile() {
  return useMutation({
    mutationFn: async ({ projectId, kind = "file", action = "download" }: { projectId: string; kind?: "file" | "audio" | "video" | "image" | "book"; action?: "download" | "stream" }): Promise<string> => {
      const { data, error } = await supabase.functions.invoke("get-project-file", { body: { project_id: projectId, kind, action } });
      if (error) throw new Error(await projectFunctionError(error, "Couldn't access file."));
      if (data?.error) throw new Error(data.error);
      return data.url;
    },
  });
}

export function useIsProjectMember(projectId: string, isPrivate: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-project-member", projectId, user?.id], enabled: !!user && !!projectId && isPrivate,
    queryFn: async () => {
      const { data, error } = await supabase.from("project_members").select("user_id").eq("project_id", projectId).eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}

export function useIsProjectSaved(projectId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-project-saved", projectId, user?.id], enabled: !!user && !!projectId,
    queryFn: async () => {
      const { data } = await supabase.from("saved_projects").select("project_id").eq("project_id", projectId).eq("user_id", user!.id).maybeSingle();
      return !!data;
    },
  });
}

export function useToggleSavedProject(projectId: string) {
  const { user } = useAuth();
  const client = useQueryClient();
  const key = ["is-project-saved", projectId, user?.id];
  return useMutation({
    mutationFn: async (currentlySaved: boolean) => {
      if (!user) throw new Error("Not signed in");
      const { error } = currentlySaved
        ? await supabase.from("saved_projects").delete().eq("project_id", projectId).eq("user_id", user.id)
        : await supabase.from("saved_projects").insert({ project_id: projectId, user_id: user.id });
      if (error) throw error;
    },
    onMutate: async (currentlySaved) => { await client.cancelQueries({ queryKey: key }); const previous = client.getQueryData(key); client.setQueryData(key, !currentlySaved); return { previous }; },
    onError: (_error, _saved, context) => client.setQueryData(key, context?.previous),
    onSettled: () => { void client.invalidateQueries({ queryKey: key }); void client.invalidateQueries({ queryKey: ["saved-projects"] }); void client.invalidateQueries({ queryKey: ["activity-saved-projects"] }); },
  });
}

export function useProjectAccessCount(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-access-count", projectId], enabled: !!projectId,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.from("project_access_counts").select("access_count").eq("project_id", projectId!).maybeSingle();
      if (error) throw error;
      return data?.access_count ?? 0;
    },
  });
}

// Paid access is logged server-side by purchase-project; only a FREE, non-owner unlock needs this client-side log.
export function useLogFreeProjectAccess() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ projectId, accessType }: { projectId: string; accessType: "download" | "stream" | "link_click" }) => {
      if (!user) return;
      const { error } = await supabase.from("project_access_events").insert({ project_id: projectId, user_id: user.id, access_type: accessType, amount_paid: 0 });
      if (error) throw error;
    },
  });
}

// Powers the Activity "History" tab. Owners viewing their own project aren't tracked.
export function useMarkProjectSeen(projectId: string | undefined, ownerId: string | undefined) {
  const { user } = useAuth();
  const client = useQueryClient();
  useEffect(() => {
    if (!projectId || !user || !ownerId || user.id === ownerId) return;
    let cancelled = false;
    void (async () => {
      const { error } = await supabase.from("project_views").upsert({ user_id: user.id, project_id: projectId, viewed_at: new Date().toISOString() }, { onConflict: "user_id,project_id" });
      if (!cancelled && !error) void client.invalidateQueries({ queryKey: ["activity-history"] });
    })();
    return () => { cancelled = true; };
  }, [projectId, user, ownerId, client]);
}

export type EventDetails = { project_id: string; event_date: string | null; location_type: "physical" | "online"; location_value: string; ticket_template_url: string | null };
export type MeetingDetails = { project_id: string; scheduled_at: string; status: "scheduled" | "live" | "ended" | "cancelled" };
export type MediaDetails = {
  project_id: string; has_audio: boolean; has_video: boolean; has_image: boolean; audio_source: "link" | "upload" | null; audio_url: string | null; audio_file_path: string | null;
  video_source: "link" | "upload" | null; video_url: string | null; video_file_path: string | null; image_source: "link" | "upload" | null; image_url: string | null; image_file_path: string | null;
};
export type GigDetails = { project_id: string; tagline: string | null; delivery_estimate: string | null; revisions_included: number | null; deliverables: string[] | null; faq: { question: string; answer: string }[] | null };
export type PitchDetails = { project_id: string; goal_amount_usd: number; linked_room_id: string };
export type BookDetails = { project_id: string; book_type: "book" | "article"; content_source: "link" | "upload" | "authored"; author_name: string | null; external_url: string | null; allow_download: boolean; allow_read_in_app: boolean; page_count: number | null };

function useDetailsRow<T>(table: string, key: string, projectId: string | undefined) {
  return useQuery({
    queryKey: [key, projectId], enabled: !!projectId,
    queryFn: async (): Promise<T | null> => {
      const { data, error } = await supabase.from(table).select("*").eq("project_id", projectId!).maybeSingle();
      if (error) throw error;
      return data as T | null;
    },
  });
}
export const useEventDetails = (projectId: string | undefined) => useDetailsRow<EventDetails>("project_event_details", "project-event-details", projectId);
export const useMeetingDetails = (projectId: string | undefined) => useDetailsRow<MeetingDetails>("project_meeting_details", "project-meeting-details", projectId);
export const useMediaDetails = (projectId: string | undefined) => useDetailsRow<MediaDetails>("project_media_details", "project-media-details", projectId);
export const useGigDetails = (projectId: string | undefined) => useDetailsRow<GigDetails>("project_gig_details", "project-gig-details", projectId);
export const usePitchDetails = (projectId: string | undefined) => useDetailsRow<PitchDetails>("project_pitch_details", "project-pitch-details", projectId);
export const useBookDetails = (projectId: string | undefined) => useDetailsRow<BookDetails>("project_book_details", "project-book-details", projectId);

// The work-sample projects attached to a gig (the create flow's useGigSamples lists what CAN be attached; this lists what IS).
export function useGigWorkSamples(gigProjectId: string | undefined) {
  return useQuery({
    queryKey: ["project-gig-samples", gigProjectId], enabled: !!gigProjectId,
    queryFn: async (): Promise<Project[]> => {
      const { data: links, error: linksError } = await supabase.from("project_gig_samples").select("sample_project_id, sort_order").eq("gig_project_id", gigProjectId!).order("sort_order");
      if (linksError) throw linksError;
      if (!links?.length) return [];
      const { data: projects, error } = await supabase.from("projects").select("*").in("id", links.map(link => link.sample_project_id));
      if (error) throw error;
      const byId = new Map((projects ?? []).map(project => [project.id, project as Project]));
      return links.map(link => byId.get(link.sample_project_id)).filter((project): project is Project => !!project);
    },
  });
}

// The reverse direction: active, public gig pages a project is featured on as a work sample.
export function useGigsFeaturingProject(sampleProjectId: string | undefined) {
  return useQuery({
    queryKey: ["gigs-featuring-project", sampleProjectId], enabled: !!sampleProjectId,
    queryFn: async (): Promise<{ id: string; title: string; role_label: string | null }[]> => {
      const { data: links, error: linksError } = await supabase.from("project_gig_samples").select("gig_project_id").eq("sample_project_id", sampleProjectId!);
      if (linksError) throw linksError;
      const gigIds = [...new Set((links ?? []).map(link => link.gig_project_id))];
      if (!gigIds.length) return [];
      const { data, error } = await supabase.from("project_gig_details").select("project_id, gig_roles(label), projects!inner(id, title, status, is_private)").in("project_id", gigIds).eq("projects.status", "active").eq("projects.is_private", false);
      if (error) throw error;
      return ((data ?? []) as any[]).map(row => {
        const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
        const role = Array.isArray(row.gig_roles) ? row.gig_roles[0] : row.gig_roles;
        return { id: project.id, title: project.title, role_label: role?.label ?? null };
      });
    },
  });
}

export function usePitchRaised(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-pitch-raised", projectId], enabled: !!projectId,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.from("pitch_supporters").select("amount_usd").eq("project_id", projectId!);
      if (error) throw error;
      return (data ?? []).reduce((sum, row) => sum + row.amount_usd, 0);
    },
  });
}

export function useSupportPitch(projectId: string) {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ amountUsd, message }: { amountUsd: number; message?: string }) => {
      if (!user) throw new Error("Not signed in");
      if (!(amountUsd > 0)) throw new Error("Enter an amount to support with.");
      const { error } = await supabase.from("pitch_supporters").insert({ project_id: projectId, supporter_id: user.id, amount_usd: amountUsd, message: message?.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => { void client.invalidateQueries({ queryKey: ["project-pitch-raised", projectId] }); void client.invalidateQueries({ queryKey: ["wallet"] }); },
  });
}

export type ProjectFaq = { id: string; project_id: string; question: string; answer: string; sort_order: number };
export function useProjectFaqs(projectId: string) {
  return useQuery({
    queryKey: ["project-faqs", projectId], enabled: !!projectId,
    queryFn: async (): Promise<ProjectFaq[]> => {
      const { data, error } = await supabase.from("project_faqs").select("id, project_id, question, answer, sort_order").eq("project_id", projectId).order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Owner status changes (publish / unpublish / archive / restore) and hard delete (refused server-side once anyone has purchased).
export function useSetProjectStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ProjectStatus }) => {
      const { error } = await supabase.from("projects").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => { await Promise.all(["project-detail", "user-projects", "page-projects", "my-gigs", "library"].map(key => client.invalidateQueries({ queryKey: [key] }))); },
  });
}

export function useDeleteProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string) => {
      const { data, error } = await supabase.functions.invoke("delete-project", { body: { project_id: projectId } });
      if (error) throw new Error(await projectFunctionError(error, "Couldn't delete this project."));
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: async () => { await Promise.all(["user-projects", "page-projects", "my-gigs", "library"].map(key => client.invalidateQueries({ queryKey: [key] }))); },
  });
}
