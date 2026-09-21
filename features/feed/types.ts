// File: features/feed/types.ts
export type FeedMode = "ranked" | "following" | "top";
export type Stance = "support" | "disagree" | "pushback";
export type ProfileRole = { label: string; position: number };
export type Author = { id: string; username: string; display_name: string; avatar_url: string | null; tier: string; is_verified: boolean; is_private: boolean; roles: ProfileRole[] };
export type PageAuthor = { id: string; username: string; name: string; avatar_url: string | null; is_verified: boolean; page_type?: string | null; tagline?: string | null };
// Card-preview fields only (mirrors web's TaggedProjectSummary); the full project is fetched on its own screen.
export type TaggedProjectSummary = { id: string; title: string; thumbnail_url: string | null; project_type: string; price_usd: number; promo_price_usd: number | null; status: "active" | "draft" | "archived" | "cancelled"; slug?: string | null; posted_as_page?: { username: string } | null; owner: { username: string; display_name: string } };
export type Post = {
  id: string; author_id: string; heading: string | null; heading_color: string | null; content: string; media_urls: string[];
  visibility: "public" | "followers_only"; like_count: number; dislike_count: number; share_count: number; support_count: number;
  disagree_count: number; pushback_count: number; comment_count: number; is_deleted: boolean; is_archived: boolean; edited_at: string | null;
  created_at: string; reshared_post_id: string | null; posted_as_page_id: string | null; status?: "draft" | "scheduled" | "published"; music_catalogue_id?: string | null; tagged_project?: TaggedProjectSummary | null;
  author: Author; posted_as_page?: PageAuthor | null; reshared_post?: (Omit<Post,"reshared_post"|"reshared_post_id"|"posted_as_page"> & { reshared_post_id?: null }) | null;
};
export type Comment = { id:string;post_id:string;parent_comment_id:string|null;author_id:string;content:string;stance:Stance|null;like_count:number;dislike_count:number;reply_count:number;created_at:string;author:Pick<Author,"id"|"username"|"display_name"|"avatar_url"> };
export const isPlainReshare=(post:Pick<Post,"reshared_post_id"|"content">)=>!!post.reshared_post_id&&!post.content.trim();
export const isQuote=(post:Pick<Post,"reshared_post_id"|"content">)=>!!post.reshared_post_id&&!!post.content.trim();
