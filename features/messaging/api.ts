// File: features/messaging/api.ts
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { File } from "expo-file-system";
import { cacheMessages, cacheProfiles, getCachedMessages } from "@/lib/local-cache";
import { enqueueOutboxMessage, isLocalMessageId, makeLocalMessageId } from "@/lib/outbox";
import { isCurrentlyOffline } from "@/lib/network";

export type ConversationSummary = { id:string; last_message_at:string; pinned_at:string|null; archived_at:string|null; is_request:boolean; is_group:boolean; team_page:{id:string;username:string;name:string;avatar_url:string|null}|null; other_participant:{id:string;username:string;display_name:string;avatar_url:string|null}; last_message:{id:string;content:string;sender_id:string;delivered_at:string|null;read_at:string|null;is_deleted:boolean}|null; unreadCount:number };
type Participant = { conversation_id:string; last_read_at:string|null; archived_at:string|null; pinned_at:string|null; hidden_at:string|null; left_at:string|null; is_request?:boolean };
export type Message = { id:string; conversation_id:string; sender_id:string; content:string; created_at:string; delivered_at:string|null; read_at:string|null; reply_to_message_id:string|null; is_deleted:boolean };
export type ConversationDetail = { id:string; is_group:boolean; is_request:boolean; left_at:string|null; team_page:ConversationSummary["team_page"]; other_participant:ConversationSummary["other_participant"]&{last_seen_at:string|null} };

async function loadConversations(userId:string,archived:boolean):Promise<ConversationSummary[]> {
  let participantQuery=supabase.from("conversation_participants").select("conversation_id, last_read_at, archived_at, pinned_at, hidden_at, left_at, is_request").eq("user_id",userId).is("hidden_at",null);
  participantQuery=archived?participantQuery.not("archived_at","is",null):participantQuery.is("archived_at",null);
  const{data:participantData,error}=await participantQuery;if(error)throw error;const participants=(participantData??[]) as Participant[];if(!participants.length)return[];
  const ids=participants.map(row=>row.conversation_id);const[{data:conversations,error:conversationError},{data:others,error:otherError},{data:messages,error:messageError}]=await Promise.all([
    supabase.from("conversations").select("id, last_message_at, is_group, team_page:pages!conversations_team_page_id_fkey(id, username, name, avatar_url)").in("id",ids).order("last_message_at",{ascending:false}),
    supabase.from("conversation_participants").select("conversation_id, profile:profiles!conversation_participants_user_id_fkey(id, username, display_name, avatar_url)").in("conversation_id",ids).neq("user_id",userId),
    supabase.from("messages").select("id, conversation_id, content, sender_id, created_at, delivered_at, read_at, is_deleted").in("conversation_id",ids).order("created_at",{ascending:false}).limit(Math.min(Math.max(ids.length*20,100),5000)),
  ]);if(conversationError)throw conversationError;if(otherError)throw otherError;if(messageError)throw messageError;
  const participantById=new Map(participants.map(row=>[row.conversation_id,row]));const otherById=new Map<string,ConversationSummary["other_participant"]>();for(const row of others??[]){const profile=Array.isArray((row as any).profile)?(row as any).profile[0]:(row as any).profile;if(profile)otherById.set(row.conversation_id,profile);}
  void cacheProfiles([...otherById.values()]);
  const latest=new Map<string,ConversationSummary["last_message"]>();const unread=new Map<string,number>();for(const message of messages??[]){if(!latest.has(message.conversation_id))latest.set(message.conversation_id,message as ConversationSummary["last_message"]);const participant=participantById.get(message.conversation_id);if(message.sender_id!==userId&&(!participant?.last_read_at||message.created_at>participant.last_read_at))unread.set(message.conversation_id,(unread.get(message.conversation_id)??0)+1);}
  const rows:ConversationSummary[]=[];for(const conversation of conversations??[]){const team=Array.isArray((conversation as any).team_page)?(conversation as any).team_page[0]:(conversation as any).team_page;const other=otherById.get(conversation.id);if(!conversation.is_group&&!other)continue;const participant=participantById.get(conversation.id)!;rows.push({id:conversation.id,last_message_at:conversation.last_message_at,pinned_at:participant.pinned_at,archived_at:participant.archived_at,is_request:participant.is_request??false,is_group:conversation.is_group,team_page:team??null,other_participant:other??{id:"",username:"",display_name:team?.name??"Group",avatar_url:team?.avatar_url??null},last_message:latest.get(conversation.id)??null,unreadCount:participant.left_at?0:unread.get(conversation.id)??0});}
  return rows.sort((a,b)=>(b.pinned_at?1:0)-(a.pinned_at?1:0)||new Date(b.last_message_at).getTime()-new Date(a.last_message_at).getTime());
}

export function useConversations(archived=false){const{user}=useAuth();return useQuery({queryKey:["mobile-conversations",archived,user?.id],enabled:!!user,queryFn:()=>loadConversations(user!.id,archived),refetchInterval:15000});}
export function useUpdateConversation(){const{user}=useAuth();const client=useQueryClient();return useMutation({mutationFn:async(input:{id:string;pinned_at?:string|null;archived_at?:string|null;hidden_at?:string|null})=>{if(!user)throw new Error("Not signed in");const{id,...updates}=input;const{error}=await supabase.from("conversation_participants").update(updates).eq("conversation_id",id).eq("user_id",user.id);if(error)throw error;},onSuccess:()=>void client.invalidateQueries({queryKey:["mobile-conversations"]})});}

export function useConversation(id:string){const{user}=useAuth();const client=useQueryClient();return useQuery({queryKey:["mobile-conversation",id,user?.id],enabled:!!user&&!!id,
  // Seed instantly from whatever conversation-list query is already cached (the inbox
  // screen the user just tapped a row on) so the chat screen never shows a blank/loading
  // header — this is what lets the whole screen mount before the network round trip for
  // full conversation detail (last_seen_at, is_request, etc.) resolves. Falls through to
  // a real loading state only for a cold deep link where no list was fetched this session.
  placeholderData:():ConversationDetail|undefined=>{
    const lists=client.getQueriesData<ConversationSummary[]>({queryKey:["mobile-conversations"]});
    for(const[,data]of lists){const match=data?.find(row=>row.id===id);if(match)return{id:match.id,is_group:match.is_group,is_request:match.is_request,left_at:null,team_page:match.team_page,other_participant:{...match.other_participant,last_seen_at:null}};}
    return undefined;
  },
  queryFn:async():Promise<ConversationDetail>=>{const[{data:conversation,error:conversationError},{data:mine,error:mineError},{data:other,error:otherError}]=await Promise.all([supabase.from("conversations").select("id, is_group, team_page:pages!conversations_team_page_id_fkey(id, username, name, avatar_url)").eq("id",id).single(),supabase.from("conversation_participants").select("is_request, left_at").eq("conversation_id",id).eq("user_id",user!.id).single(),supabase.from("conversation_participants").select("profile:profiles!conversation_participants_user_id_fkey(id, username, display_name, avatar_url, last_seen_at)").eq("conversation_id",id).neq("user_id",user!.id).limit(1).maybeSingle()]);if(conversationError)throw conversationError;if(mineError)throw mineError;if(otherError)throw otherError;const page=Array.isArray((conversation as any).team_page)?(conversation as any).team_page[0]:(conversation as any).team_page;const profile=Array.isArray((other as any)?.profile)?(other as any).profile[0]:(other as any)?.profile;if(profile)void cacheProfiles([profile]);return{id:conversation.id,is_group:conversation.is_group,is_request:mine.is_request??false,left_at:mine.left_at,team_page:page??null,other_participant:profile??{id:"",username:"",display_name:page?.name??"Group",avatar_url:page?.avatar_url??null,last_seen_at:null}};}});}

export function useMessages(conversationId:string){
  const{user}=useAuth();
  const client=useQueryClient();
  // Paint from the SQLite chat-history cache immediately (covers the case where the
  // persisted react-query cache hasn't restored yet, or this conversation wasn't
  // fetched during the current session).
  useEffect(()=>{
    if(!conversationId)return;
    if(client.getQueryData(["mobile-messages",conversationId]))return;
    let cancelled=false;
    getCachedMessages(conversationId).then(cached=>{
      if(!cancelled&&cached?.length&&!client.getQueryData(["mobile-messages",conversationId])){
        client.setQueryData(["mobile-messages",conversationId],cached);
      }
    });
    return()=>{cancelled=true;};
  },[conversationId,client]);
  return useQuery({queryKey:["mobile-messages",conversationId],enabled:!!user&&!!conversationId,queryFn:async()=>{const{data,error}=await supabase.from("messages").select("id, conversation_id, sender_id, content, created_at, delivered_at, read_at, reply_to_message_id, is_deleted").eq("conversation_id",conversationId).order("created_at",{ascending:false}).limit(100);if(error)throw error;const messages=((data??[]) as Message[]).reverse();void cacheMessages(conversationId,messages);return messages;},refetchInterval:5000});
}

export { isLocalMessageId } from "@/lib/outbox";

/** Fire-and-forget: asks send-message-push to notify the other participant(s). Never blocks or fails the send. Skipped for locally-queued (offline) sends — lib/outbox.ts's flushOutbox() makes the equivalent call itself once the real server row lands (can't import notifyPush there: outbox.ts is imported by this file, so importing back would be circular). See supabase/functions/send-message-push. */
function notifyPush(messageId:string){if(isLocalMessageId(messageId))return;void supabase.functions.invoke("send-message-push",{body:{message_id:messageId}}).catch(error=>console.warn("send-message-push failed",error));}

export function useSendMessage(conversationId:string){const{user}=useAuth();const client=useQueryClient();return useMutation({mutationFn:async(input:string|{content:string;replyToMessageId?:string|null}):Promise<Message>=>{if(!user)throw new Error("Not signed in");const raw=typeof input==="string"?input:input.content;const replyToMessageId=typeof input==="string"?null:input.replyToMessageId??null;const clean=raw.trim();if(!clean)throw new Error("Message cannot be empty");
  if(await isCurrentlyOffline()){const localId=makeLocalMessageId();const localMessage:Message={id:localId,conversation_id:conversationId,sender_id:user.id,content:clean,created_at:new Date().toISOString(),delivered_at:null,read_at:null,reply_to_message_id:replyToMessageId,is_deleted:false};await enqueueOutboxMessage(localId,conversationId,{content:clean,senderId:user.id,replyToMessageId});return localMessage;}
  const{data,error}=await supabase.from("messages").insert({conversation_id:conversationId,sender_id:user.id,content:clean,delivered_at:new Date().toISOString(),reply_to_message_id:replyToMessageId}).select("id, conversation_id, sender_id, content, created_at, delivered_at, read_at, reply_to_message_id, is_deleted").single();if(error)throw error;await supabase.from("conversation_participants").update({is_request:false,archived_at:null}).eq("conversation_id",conversationId).eq("user_id",user.id);return data as Message;},onSuccess:(message)=>{client.setQueryData<Message[]>(["mobile-messages",conversationId],old=>[...(old??[]),message]);if(!isLocalMessageId(message.id)){void cacheMessages(conversationId,[message]);void client.invalidateQueries({queryKey:["mobile-conversations"]});notifyPush(message.id);}}});}

export type VoiceNotePayload={path?:string;url?:string;durationSec:number;peaks?:number[];viewOnce?:boolean};
const VOICE_MARKER="ako-voice-note:v1:";
export function encodeVoiceNote(payload:VoiceNotePayload){return `${VOICE_MARKER}${JSON.stringify(payload)}`;}
export function decodeVoiceNote(content:string):VoiceNotePayload|null{if(!content.startsWith(VOICE_MARKER))return null;try{const value=JSON.parse(content.slice(VOICE_MARKER.length));return typeof value?.durationSec==="number"&&(typeof value?.path==="string"||typeof value?.url==="string")?value:null;}catch{return null;}}
export function formatVoiceDuration(value:number){const seconds=Math.max(0,Math.floor(value||0));return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`;}
export function messagePreview(content:string){return decodeVoiceNote(content)?"Voice note":content;}
export function useSendVoiceNote(conversationId:string){const{user}=useAuth();const client=useQueryClient();return useMutation({mutationFn:async(input:{uri:string;durationSec:number;peaks?:number[];viewOnce?:boolean})=>{if(!user)throw new Error("Not signed in");const file=new File(input.uri);const extension=file.type.includes("webm")?"webm":"m4a";const path=`${user.id}/dm/${conversationId}/${Date.now()}.${extension}`;const{error:uploadError}=await supabase.storage.from("audio").upload(path,file,{contentType:file.type||"audio/mp4"});if(uploadError)throw uploadError;const content=encodeVoiceNote({path,durationSec:input.durationSec,peaks:input.peaks,viewOnce:input.viewOnce});const{data,error}=await supabase.from("messages").insert({conversation_id:conversationId,sender_id:user.id,content,delivered_at:new Date().toISOString()}).select("id, conversation_id, sender_id, content, created_at, delivered_at, read_at, reply_to_message_id, is_deleted").single();if(error)throw error;await supabase.from("conversation_participants").update({is_request:false,archived_at:null}).eq("conversation_id",conversationId).eq("user_id",user.id);return data as Message;},onSuccess:(message)=>{client.setQueryData<Message[]>(["mobile-messages",conversationId],old=>[...(old??[]),message]);void cacheMessages(conversationId,[message]);void client.invalidateQueries({queryKey:["mobile-conversations"]});notifyPush(message.id);}});}

export async function markConversationRead(conversationId:string,userId:string,messageIds:string[]){const now=new Date().toISOString();if(messageIds.length)await supabase.from("messages").update({read_at:now}).in("id",messageIds).neq("sender_id",userId).is("read_at",null);await supabase.from("conversation_participants").update({last_read_at:now}).eq("conversation_id",conversationId).eq("user_id",userId);}

export type HiddenMessage = Pick<Message,"id"|"conversation_id"|"sender_id"|"content"|"created_at"|"is_deleted">;
export function useHiddenMessages(conversationId:string){const{user}=useAuth();return useQuery({queryKey:["mobile-hidden-messages",conversationId,user?.id],enabled:!!user&&!!conversationId,queryFn:async():Promise<HiddenMessage[]>=>{const{data:states,error:stateError}=await supabase.from("message_user_state").select("message_id").eq("user_id",user!.id).not("hidden_at","is",null);if(stateError)throw stateError;if(!states?.length)return[];const{data,error}=await supabase.from("messages").select("id, conversation_id, sender_id, content, created_at, is_deleted").eq("conversation_id",conversationId).in("id",states.map(row=>row.message_id)).order("created_at",{ascending:false});if(error)throw error;return(data??[]) as HiddenMessage[];}});}
export function useUnhideMessage(conversationId:string){const{user}=useAuth();const client=useQueryClient();return useMutation({mutationFn:async(messageId:string)=>{if(!user)throw new Error("Not signed in");const{error}=await supabase.from("message_user_state").update({hidden_at:null}).eq("message_id",messageId).eq("user_id",user.id);if(error)throw error;},onSuccess:()=>{void client.invalidateQueries({queryKey:["mobile-hidden-messages",conversationId]});void client.invalidateQueries({queryKey:["mobile-message-state",conversationId]});}});}
// Finds or creates a 1:1 conversation via the get_or_create_direct_conversation RPC (never inserts into conversations directly). Mirrors web's useStartConversation.
export function useStartConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (otherUserId: string): Promise<string> => {
      const { data, error } = await supabase.rpc("get_or_create_direct_conversation", { p_other_user_id: otherUserId });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ["mobile-conversations"] }),
  });
}
