// File: features/feed/api.ts
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { useActiveIdentity } from "@/features/compose/api";
import { isCurrentlyOffline } from "@/lib/network";
import { enqueueOutboxComment, enqueueOutboxReaction, isLocalCommentId, makeLocalCommentId, reactionKey } from "@/lib/outbox";
import { makeUuid } from "@/lib/uuid";
import type { Comment, FeedMode, Post, Stance } from "./types";
const PAGE_SIZE=15;
const AUTHOR_SELECT="id, username, display_name, avatar_url, tier, is_verified, is_private, profile_roles(position, role:roles(label))";
// Mirrors web's lib/postSelects.ts PAGE_SELECT: every query that feeds a PostCard must join the page a post was published as, or the card falls back to the posting member's own name.
export const PAGE_SELECT="posted_as_page:pages(id, username, name, avatar_url, page_type, is_verified, tagline)";
// Mirrors web's TAGGED_PROJECT_SELECT: only the card-preview fields, since this rides along on every feed post.
const TAGGED_PROJECT_SELECT="tagged_project:projects!posts_tagged_project_id_fkey(id, title, thumbnail_url, project_type, price_usd, promo_price_usd, status, slug, owner:profiles!projects_owner_id_fkey(username, display_name), posted_as_page:pages(username))";
export const FEED_SELECT=`*, author:profiles!posts_author_id_fkey(${AUTHOR_SELECT}), ${PAGE_SELECT}, ${TAGGED_PROJECT_SELECT}, reshared_post(*, author:profiles!posts_author_id_fkey(${AUTHOR_SELECT}))`;
// The identity a reaction is made as: the active page's id in Page mode, null when acting personally (web's acted_as_page_id). `ready` is false until the identity has loaded so a tap can't be recorded as the wrong actor.
function useActingIdentity(){const identity=useActiveIdentity();return{ready:!identity.isLoading,pageId:identity.data?.mode==="page"?identity.data.page.id:null};}
function normalizeAuthor(raw:Record<string,unknown>){const rows=Array.isArray(raw.profile_roles)?raw.profile_roles:[];return{...raw,roles:rows.map((row)=>{const item=row as {position:number;role:{label:string}|{label:string}[]};const role=Array.isArray(item.role)?item.role[0]:item.role;return{position:item.position,label:role?.label??""};}).filter(role=>role.label)};}
export function normalizePost(raw:Record<string,unknown>):Post{const author=normalizeAuthor(raw.author as Record<string,unknown>);const source=raw.reshared_post as Record<string,unknown>|null;return{...raw,author,reshared_post:source?{...source,author:normalizeAuthor(source.author as Record<string,unknown>)}:source} as unknown as Post;}
async function functionError(error:unknown,fallback:string){if(error instanceof FunctionsHttpError){try{const body=await error.context.json() as {error?:string};return body.error??fallback;}catch{return fallback;}}return error instanceof Error?error.message:fallback;}
export function useFeed(mode:FeedMode, enabled=true){const{user}=useAuth();return useInfiniteQuery({queryKey:["feed",mode,user?.id],enabled:!!user&&enabled,initialPageParam:0,queryFn:async({pageParam})=>{const rpc=mode==="ranked"?"get_ranked_feed":mode==="following"?"get_following_feed":"get_trending_feed";const{data,error}=await supabase.rpc(rpc,{p_viewer_id:user!.id,p_limit:PAGE_SIZE,p_offset:pageParam*PAGE_SIZE});if(error)throw error;const ids:string[]=(data??[]).map((row:{post_id:string})=>row.post_id);if(!ids.length)return[];const{data:rows,error:postError}=await supabase.from("posts").select(FEED_SELECT).in("id",ids);if(postError)throw postError;const map=new Map((rows as unknown as Record<string,unknown>[]).map(row=>[String(row.id),normalizePost(row)]));const posts=ids.flatMap((id:string)=>{const post=map.get(id);return post?[post]:[];});if(mode!=="top")void supabase.rpc("fulfill_gift_tokens",{p_viewer_id:user!.id,p_served_post_ids:ids});return posts;},getNextPageParam:(last,pages)=>last.length===PAGE_SIZE?pages.length:undefined,staleTime:30_000});}
export function useTopicFeed(interestId?:string){return useInfiniteQuery({queryKey:["feed","topic",interestId],enabled:!!interestId,initialPageParam:0,queryFn:async({pageParam}):Promise<Post[]>=>{const{data:topics,error:topicsError}=await supabase.from("post_topics").select("post_id").eq("interest_id",interestId!);if(topicsError)throw topicsError;const ids=(topics??[]).map(row=>row.post_id);if(!ids.length)return[];const{data,error}=await supabase.from("posts").select(FEED_SELECT).eq("is_deleted",false).eq("is_archived",false).in("id",ids).order("created_at",{ascending:false}).range(pageParam*PAGE_SIZE,pageParam*PAGE_SIZE+PAGE_SIZE-1);if(error)throw error;return(data as unknown as Record<string,unknown>[]).map(normalizePost);},getNextPageParam:(last,pages)=>last.length===PAGE_SIZE?pages.length:undefined,staleTime:30_000});}
export function usePostFollowState(authorId:string){const{user}=useAuth();const identity=useActiveIdentity();const pageId=identity.data?.mode==="page"?identity.data.page.id:null;return useQuery({queryKey:["post-follow-state",authorId,user?.id,pageId],enabled:!!user&&!!authorId&&!identity.isLoading,queryFn:async()=>{const followingQuery=pageId?supabase.from("page_follows_target").select("page_id").eq("page_id",pageId).eq("followed_profile_id",authorId).maybeSingle():supabase.from("follows").select("follower_id").eq("follower_id",user!.id).eq("following_id",authorId).maybeSingle();const[following,request,back]=await Promise.all([followingQuery,supabase.from("follow_requests").select("id").eq("requester_id",user!.id).eq("target_id",authorId).maybeSingle(),supabase.from("follows").select("follower_id").eq("follower_id",authorId).eq("following_id",user!.id).maybeSingle()]);for(const result of[following,request,back])if(result.error)throw result.error;return{following:!!following.data,requested:!!request.data,followedBy:!!back.data};}});}
export function useFollowFromPost(authorId:string,isPrivate:boolean){const{user}=useAuth();const identity=useActiveIdentity();const pageId=identity.data?.mode==="page"?identity.data.page.id:null;const client=useQueryClient();return useMutation({mutationFn:async()=>{if(!user)throw new Error("Not signed in");const{error}=isPrivate?await supabase.from("follow_requests").insert({requester_id:user.id,target_id:authorId}):pageId?await supabase.from("page_follows_target").insert({page_id:pageId,followed_profile_id:authorId}):await supabase.from("follows").insert({follower_id:user.id,following_id:authorId});if(error&&error.code!=="23505")throw error;},onSuccess:()=>{void client.invalidateQueries({queryKey:["post-follow-state",authorId]});void client.invalidateQueries({queryKey:["follow-state",authorId]});void client.invalidateQueries({queryKey:["profile"]});void client.invalidateQueries({queryKey:["discover-people"]});}});}
export function usePost(postId:string){return useQuery({queryKey:["post",postId],enabled:!!postId,queryFn:async()=>{const{data,error}=await supabase.from("posts").select(FEED_SELECT).eq("id",postId).single();if(error)throw error;return normalizePost(data as unknown as Record<string,unknown>);}});}
export function useReaction(postId:string,type:"like"|"dislike"){
  const{user}=useAuth();const{ready,pageId}=useActingIdentity();
  return useQuery({queryKey:["reaction",postId,type,user?.id,pageId],enabled:!!user&&ready,queryFn:async()=>{
    let query=supabase.from("reactions").select("id").eq("post_id",postId).eq("user_id",user!.id).eq("type",type);
    query=pageId?query.eq("acted_as_page_id",pageId):query.is("acted_as_page_id",null);
    const{data,error}=await query.limit(1).maybeSingle();if(error)throw error;return!!data;
  }});
}
export function useToggleReaction(postId:string,type:"like"|"dislike"){
  const{user}=useAuth();const{ready,pageId}=useActingIdentity();const client=useQueryClient();const key=["reaction",postId,type,user?.id,pageId];
  return useMutation({mutationFn:async(active:boolean)=>{
    if(!user)throw new Error("Not signed in");
    if(!ready)throw new Error("Still loading your account. Try again in a moment.");
    // Offline: queue the state the person wants (not a toggle); the outbox applies it on reconnect. The optimistic cache write in onMutate already shows it.
    if(await isCurrentlyOffline()){await enqueueOutboxReaction(user.id,{key:reactionKey("post",postId,type,pageId),target:"post",targetId:postId,type,desired:!active,pageId,postId});return;}
    if(active){
      let query=supabase.from("reactions").delete().eq("post_id",postId).eq("user_id",user.id).eq("type",type);
      query=pageId?query.eq("acted_as_page_id",pageId):query.is("acted_as_page_id",null);
      const{error}=await query;if(error)throw error;return;
    }
    const{error}=await supabase.from("reactions").insert({post_id:postId,user_id:user.id,type,target_type:"post",acted_as_page_id:pageId});
    if(error&&error.code!=="23505")throw error;
  },onMutate:async(active)=>{await client.cancelQueries({queryKey:key});const previous=client.getQueryData(key);client.setQueryData(key,!active);return{previous};},onError:(_e,_v,c)=>client.setQueryData(key,c?.previous),onSettled:()=>{void client.invalidateQueries({queryKey:key});void client.invalidateQueries({queryKey:["feed"]});void client.invalidateQueries({queryKey:["post",postId]});}});
}
export function useBookmark(postId:string){const{user}=useAuth();return useQuery({queryKey:["bookmark",postId,user?.id],enabled:!!user,queryFn:async()=>{const{data,error}=await supabase.from("bookmarks").select("id").eq("post_id",postId).eq("user_id",user!.id).maybeSingle();if(error)throw error;return!!data;}});}
export function useToggleBookmark(postId:string){const{user}=useAuth();const client=useQueryClient();const key=["bookmark",postId,user?.id];return useMutation({mutationFn:async(active:boolean)=>{if(!user)throw new Error("Not signed in");const{error}=active?await supabase.from("bookmarks").delete().eq("post_id",postId).eq("user_id",user.id):await supabase.from("bookmarks").insert({post_id:postId,user_id:user.id});if(error)throw error;},onMutate:async(active)=>{await client.cancelQueries({queryKey:key});const previous=client.getQueryData(key);client.setQueryData(key,!active);return{previous};},onError:(_e,_v,c)=>client.setQueryData(key,c?.previous),onSettled:()=>void client.invalidateQueries({queryKey:key})});}
export function useComments(postId:string){return useQuery({queryKey:["comments",postId],enabled:!!postId,queryFn:async():Promise<Comment[]>=>{const{data,error}=await supabase.from("comments").select("*, author:profiles!comments_author_id_fkey(id, username, display_name, avatar_url)").eq("post_id",postId).is("parent_comment_id",null).eq("is_deleted",false).order("created_at",{ascending:true});if(error)throw error;return data as unknown as Comment[];}});}
export function useReplies(postId:string,parentId:string,enabled:boolean){return useQuery({queryKey:["comments",postId,"replies",parentId],enabled:enabled&&!!postId&&!!parentId,queryFn:async():Promise<Comment[]>=>{const{data,error}=await supabase.from("comments").select("*, author:profiles!comments_author_id_fkey(id, username, display_name, avatar_url)").eq("post_id",postId).eq("parent_comment_id",parentId).eq("is_deleted",false).order("created_at",{ascending:true});if(error)throw error;return data as unknown as Comment[];}});}
export function useCreateComment(postId:string){
  const{user,profile}=useAuth();const client=useQueryClient();
  return useMutation({mutationFn:async(input:{content:string;stance?:Stance;parent_comment_id?:string}):Promise<Comment>=>{
    // Offline: queue it (lib/outbox.ts) and hand back a placeholder so the composer closes and the comment shows up, marked as waiting, until it is sent.
    if(await isCurrentlyOffline()){
      if(!user)throw new Error("Not signed in");
      const localId=makeLocalCommentId();
      await enqueueOutboxComment(localId,user.id,{postId,content:input.content,stance:input.stance,parentCommentId:input.parent_comment_id,clientRequestId:makeUuid()});
      return{id:localId,post_id:postId,parent_comment_id:input.parent_comment_id??null,author_id:user.id,content:input.content,stance:input.stance??null,like_count:0,dislike_count:0,reply_count:0,created_at:new Date().toISOString(),author:{id:user.id,username:profile?.username??"",display_name:profile?.display_name??"You",avatar_url:profile?.avatar_url??null}};
    }
    const{data,error}=await supabase.functions.invoke("create-comment",{body:{post_id:postId,...input}});if(error)throw new Error(await functionError(error,"Couldn’t post this comment."));if(data?.error)throw new Error(data.error);return data.comment;
  },onSuccess:(comment)=>{
    if(isLocalCommentId(comment.id)){
      // Show the queued comment where it will live once it is sent; the refetch after the outbox flush replaces it with the real one.
      const key=comment.parent_comment_id?["comments",postId,"replies",comment.parent_comment_id]:["comments",postId];
      client.setQueryData<Comment[]>(key,old=>[...(old??[]),comment]);
      return;
    }
    void client.invalidateQueries({queryKey:["comments",postId]});void client.invalidateQueries({queryKey:["feed"]});void client.invalidateQueries({queryKey:["post",postId]});
  }});
}
export function useCommentReaction(commentId:string,type:"like"|"dislike"){
  const{user}=useAuth();const{ready,pageId}=useActingIdentity();
  return useQuery({queryKey:["comment-reaction",commentId,type,user?.id,pageId],enabled:!!user&&!!commentId&&ready,queryFn:async()=>{
    let query=supabase.from("reactions").select("id").eq("comment_id",commentId).eq("user_id",user!.id).eq("type",type).eq("target_type","comment");
    query=pageId?query.eq("acted_as_page_id",pageId):query.is("acted_as_page_id",null);
    const{data,error}=await query.limit(1).maybeSingle();if(error)throw error;return!!data;
  }});
}
export function useToggleCommentReaction(postId:string,commentId:string,type:"like"|"dislike"){
  const{user}=useAuth();const{ready,pageId}=useActingIdentity();const client=useQueryClient();const opposite=type==="like"?"dislike":"like";
  const key=["comment-reaction",commentId,type,user?.id,pageId];const oppositeKey=["comment-reaction",commentId,opposite,user?.id,pageId];
  return useMutation({mutationFn:async(active:boolean)=>{
    if(!user)throw new Error("Not signed in");
    if(!ready)throw new Error("Still loading your account. Try again in a moment.");
    if(await isCurrentlyOffline()){await enqueueOutboxReaction(user.id,{key:reactionKey("comment",commentId,type,pageId),target:"comment",targetId:commentId,type,desired:!active,pageId,postId});return;}
    if(active){
      let query=supabase.from("reactions").delete().eq("comment_id",commentId).eq("user_id",user.id).eq("type",type).eq("target_type","comment");
      query=pageId?query.eq("acted_as_page_id",pageId):query.is("acted_as_page_id",null);
      const{error}=await query;if(error)throw error;return;
    }
    // A like and a dislike from the same actor can't coexist; clearing is scoped to this actor so the other identity's reaction is untouched.
    let clear=supabase.from("reactions").delete().eq("comment_id",commentId).eq("user_id",user.id).eq("type",opposite).eq("target_type","comment");
    clear=pageId?clear.eq("acted_as_page_id",pageId):clear.is("acted_as_page_id",null);
    const{error:clearError}=await clear;if(clearError)throw clearError;
    const{error}=await supabase.from("reactions").insert({comment_id:commentId,user_id:user.id,type,target_type:"comment",acted_as_page_id:pageId});
    if(error&&error.code!=="23505")throw error;
  },onMutate:async(active)=>{await Promise.all([client.cancelQueries({queryKey:key}),client.cancelQueries({queryKey:oppositeKey})]);const previous=client.getQueryData(key);const previousOpposite=client.getQueryData(oppositeKey);client.setQueryData(key,!active);if(!active)client.setQueryData(oppositeKey,false);return{previous,previousOpposite};},onError:(_e,_v,c)=>{client.setQueryData(key,c?.previous);client.setQueryData(oppositeKey,c?.previousOpposite);},onSettled:()=>{void client.invalidateQueries({queryKey:key});void client.invalidateQueries({queryKey:oppositeKey});void client.invalidateQueries({queryKey:["comments",postId]});}});
}
export function useCreateReshare(postId:string){const client=useQueryClient();return useMutation({mutationFn:async(caption:string)=>{const{data,error}=await supabase.functions.invoke("create-reshare",{body:{originalPostId:postId,caption:caption.trim()}});if(error)throw new Error(await functionError(error,"Couldn't reshare this post."));if(data?.error)throw new Error(data.error);return data.post;},onSuccess:()=>void client.invalidateQueries({queryKey:["feed"]})});}
export type MobileGiftType={id:string;name:string;cost_usd:number;icon_url:string|null;sort_order:number};
export function useGiftTypes(){return useQuery({queryKey:["gift-types"],queryFn:async():Promise<MobileGiftType[]>=>{const{data,error}=await supabase.from("gift_types").select("id, name, cost_usd, icon_url, sort_order").eq("is_active",true).order("sort_order");if(error)throw error;return data as MobileGiftType[];},staleTime:300000});}
export function useWallet(){const{user}=useAuth();return useQuery({queryKey:["wallet",user?.id],enabled:!!user,queryFn:async()=>{const{data,error}=await supabase.from("wallets").select("balance").eq("user_id",user!.id).single();if(error)throw error;return data as {balance:number};}});}
export function useSendGift(){const client=useQueryClient();return useMutation({mutationFn:async(input:{recipient_id:string;gift_type_id:string;post_id?:string;comment_id?:string})=>{const{data,error}=await supabase.functions.invoke("process-gift",{body:input});if(error)throw error;if(data?.error)throw new Error(data.error);return data.gift;},onSuccess:()=>{void client.invalidateQueries({queryKey:["wallet"]});void client.invalidateQueries({queryKey:["gift-types"]});void client.invalidateQueries({queryKey:["feed"]});void client.invalidateQueries({queryKey:["post"]});}});}
export function useSavedPosts(){const{user}=useAuth();return useInfiniteQuery({queryKey:["saved-posts",user?.id],enabled:!!user,initialPageParam:0,queryFn:async({pageParam})=>{const from=pageParam*PAGE_SIZE;const{data,error}=await supabase.from("bookmarks").select(`post:posts!bookmarks_post_id_fkey(${FEED_SELECT})`).eq("user_id",user!.id).order("created_at",{ascending:false}).range(from,from+PAGE_SIZE-1);if(error)throw error;return(data??[]).flatMap((row:any)=>row.post?[normalizePost(Array.isArray(row.post)?row.post[0]:row.post)]:[]);},getNextPageParam:(last,pages)=>last.length===PAGE_SIZE?pages.length:undefined});}
export type SecondaryActionKey="support"|"reshare"|"share"|"gift"|"save"|"disagree"|"pushback"|"dislike";const ACTION_FALLBACK:SecondaryActionKey[]=["support","reshare","share","gift","save","disagree","pushback","dislike"];
export function useEngagementOrder(){const{user}=useAuth();return useQuery({queryKey:["engagement-order",user?.id],enabled:!!user,staleTime:300000,queryFn:async():Promise<SecondaryActionKey[]>=>{const counts:Record<SecondaryActionKey,number>={support:0,reshare:0,share:0,gift:0,save:0,disagree:0,pushback:0,dislike:0};const[stances,dislikes,gifts,saves,reshares,shares]=await Promise.all([supabase.from("comments").select("stance").eq("author_id",user!.id).eq("is_deleted",false).not("stance","is",null),supabase.from("reactions").select("id",{count:"exact",head:true}).eq("user_id",user!.id).eq("type","dislike"),supabase.from("gifts").select("id",{count:"exact",head:true}).eq("sender_id",user!.id),supabase.from("bookmarks").select("id",{count:"exact",head:true}).eq("user_id",user!.id),supabase.from("posts").select("id",{count:"exact",head:true}).eq("author_id",user!.id).not("reshared_post_id","is",null),supabase.from("reactions").select("id",{count:"exact",head:true}).eq("user_id",user!.id).eq("type","share")]);for(const result of[stances,dislikes,gifts,saves,reshares,shares])if(result.error)throw result.error;for(const row of stances.data??[]){if(row.stance==="support")counts.support++;else if(row.stance==="disagree")counts.disagree++;else if(row.stance==="pushback")counts.pushback++;}counts.dislike=dislikes.count??0;counts.gift=gifts.count??0;counts.save=saves.count??0;counts.reshare=reshares.count??0;counts.share=shares.count??0;return[...ACTION_FALLBACK].sort((a,b)=>counts[b]-counts[a]||ACTION_FALLBACK.indexOf(a)-ACTION_FALLBACK.indexOf(b));}});}

export function usePrioritizePost() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      const { data, error } = await supabase.functions.invoke("prioritize-post", { body: { post_id: postId } });
      if (error) throw new Error(await functionError(error, "Couldn't prioritize this post."));
      if (data?.error) throw new Error(data.error);
      return data.prioritized as { post_id: string; creator_id: string; prioritized_date: string };
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["feed"] });
      void client.invalidateQueries({ queryKey: ["identity-posts"] });
    },
  });
}

export function useSetPostArchived() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, archived }: { postId: string; archived: boolean }) => {
      const { error } = await supabase.from("posts").update({ is_archived: archived }).eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["feed"] });
      void client.invalidateQueries({ queryKey: ["identity-posts"] });
      void client.invalidateQueries({ queryKey: ["activity-posts"] });
    },
  });
}

export function useDeletePost() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from("posts").update({ is_deleted: true }).eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["feed"] });
      void client.invalidateQueries({ queryKey: ["identity-posts"] });
      void client.invalidateQueries({ queryKey: ["activity-posts"] });
    },
  });
}
