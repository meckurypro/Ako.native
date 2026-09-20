// File: types/database.ts
//
// Ports only the slice of web's src/types/database.ts that ported code
// needs so far. Append more interfaces from there as screens get ported —
// keep names and shapes identical so query results stay interchangeable.

export type PageType = "organization" | "brand" | "product";

export interface Page {
  id: string;
  page_type: PageType;
  name: string;
  username: string;
  tagline: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  website_url: string | null;
  category_id: string | null;
  parent_organization_id: string | null;
  created_by: string;
  is_verified: boolean;
  is_active: boolean;
  follower_count: number;
  created_at: string;
  updated_at: string;
}

// What "who am I posting/browsing as right now" resolves to.
export type ActiveIdentity =
  | { mode: "personal" }
  | { mode: "page"; page: Page; role_label: string; is_admin: boolean };
