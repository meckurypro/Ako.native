import { File } from "expo-file-system";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
