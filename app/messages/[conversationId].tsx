// File: app/messages/[conversationId].tsx
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, FlatList, Keyboard, KeyboardAvoidingView, PanResponder, Platform, Pressable, ScrollView, Share, StyleSheet, TextInput, Vibration, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Icon } from "@/components/core/Icon";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar, Text } from "@/components/core";
import { ErrorState } from "@/components/feedback";
import { decodeVoiceNote, isLocalMessageId, markConversationRead, messagePreview, type Message, useConversation, useMessages, useSendMessage, useSendVoiceNote } from "@/features/messaging/api";
import { EMOJI_CATEGORIES } from "@/features/messaging/emoji";
import { VoiceNote } from "@/components/messaging/VoiceNote";
import { MessageActionMenu, type MessageAnchor } from "@/components/messaging/MessageActionMenu";
import { DeleteMessageSheet } from "@/components/messaging/DeleteMessageSheet";
import { ForwardMessageSheet } from "@/components/messaging/ForwardMessageSheet";
import { EmojiPickerSheet } from "@/components/messaging/EmojiPickerSheet";
import { useBulkMessageState, useConversationReactions, useDeleteMessages, useMessageUserStates, useRemoveReaction, useSetReaction, useToggleMessageState, useUserTopEmojis, type MessageReaction } from "@/features/messaging/messageState";
import { VoiceRecordingHeldHint, VoiceRecordingLockedBar } from "@/components/messaging/VoiceRecordingOverlay";
import { useVoiceRecorder } from "@/features/messaging/useVoiceRecorder";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { useProbationalLock } from "@/features/account/probational";

const EMOJI = ["😀", "😂", "❤️", "👍", "🙏", "🎉", "🔥", "😮", "😢", "👏", "✅", "💯"];
const WALLPAPER = ["message-circle", "lightbulb", "heart", "star", "rocket", "pencil", "music", "camera"] as const;

// Swipe-to-reply tuning — tracks the finger 1:1 up to SWIPE_MAX, resists
// past that, fires the instant the threshold is crossed (no release needed).
const SWIPE_THRESHOLD = 56;
const SWIPE_MAX = 80;
const SWIPE_RESISTANCE = 0.2;

function lastSeen(value: string | null) {
  if (!value) return "Last seen recently";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 2) return "Online";
  if (minutes < 60) return `Last seen ${minutes}m ago`;
  if (minutes < 1440) return `Last seen today at ${new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  return "Last seen recently";
}
function time(value: string) { return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }

const Wallpaper = memo(function Wallpaper() { const { colors } = useTheme(); return <View pointerEvents="none" style={StyleSheet.absoluteFill}>{Array.from({ length: 10 }, (_, row) => <View key={row} style={[s.wallRow, { top: row * 82, left: row % 2 ? -13 : 14 }]}>{WALLPAPER.map((icon, index) => <Icon key={`${row}-${icon}`} name={icon} size={24 + (index % 2) * 5} color={colors.text} style={{ opacity: .035, transform: [{ rotate: `${(row * 19 + index * 37) % 90}deg` }] }} />)}</View>)}</View>; });

export default function MessageThreadScreen() {
  void EMOJI;
  const router = useRouter(); const { conversationId, draft: draftParam } = useLocalSearchParams<{ conversationId: string; draft?: string }>(); const { colors } = useTheme(); const { user } = useAuth(); const insets = useSafeAreaInsets(); const bottomInset = Platform.OS === "android" ? Math.max(insets.bottom, 34) : insets.bottom;
  // Probational users don't get the social layer — see
  // features/account/probational.ts. Folded into `writable` below so
  // it reuses the existing "can no longer send messages" fallback.
  const messageLocked = useProbationalLock("probational_message_enabled");
  const conversation = useConversation(conversationId ?? ""); const messages = useMessages(conversationId ?? ""); const send = useSendMessage(conversationId ?? ""); const sendVoice=useSendVoiceNote(conversationId??"");
  const list = useRef<FlatList<Message>>(null); const inputRef = useRef<TextInput>(null); const [draft, setDraft] = useState(() => typeof draftParam === "string" ? draftParam : ""); const [showEmoji, setShowEmoji] = useState(false); const [search, setSearch] = useState(false); const [headerMenu, setHeaderMenu] = useState(false); const [query, setQuery] = useState("");const[voicePreview,setVoicePreview]=useState<{uri:string;durationSec:number;peaks?:number[];viewOnce:boolean}|null>(null);
  const voiceRecorder = useVoiceRecorder(useCallback(result => setVoicePreview({ uri: result.uri, durationSec: result.durationSec, peaks: result.peaks, viewOnce: false }), []));
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);

  // ---- Per-message actions: long-press menu, reactions, star/pin/hide, delete, forward, multi-select ----
  const cid = conversationId ?? "";
  // Optimistic outbox messages carry a local id that isn't a uuid, so they never go to the server queries.
  const serverIds = useMemo(() => (messages.data ?? []).filter(m => !isLocalMessageId(m.id)).map(m => m.id), [messages.data]);
  const userStates = useMessageUserStates(cid, serverIds);
  const reactions = useConversationReactions(cid, serverIds);
  const topEmojis = useUserTopEmojis();
  const toggleStar = useToggleMessageState(cid, "starred_at");
  const togglePin = useToggleMessageState(cid, "pinned_at");
  const toggleHide = useToggleMessageState(cid, "hidden_at");
  const bulkState = useBulkMessageState(cid);
  const deleteMessages = useDeleteMessages(cid);
  const setReaction = useSetReaction(cid);
  const removeReaction = useRemoveReaction(cid);
  const [menu, setMenu] = useState<{ message: Message; anchor: MessageAnchor } | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ ids: string[]; allowEveryone: boolean } | null>(null);
  const [forwardItems, setForwardItems] = useState<{ content: string }[] | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const stateMap = userStates.data;
  const reactionMap = reactions.data;
  // Hidden and delete-for-me messages disappear from the live thread (hidden ones can be restored from "Hidden messages").
  const visibleMessages = useMemo(() => (messages.data ?? []).filter(m => { const state = stateMap?.[m.id]; return !state?.hidden_at && !state?.deleted_for_me_at; }), [messages.data, stateMap]);
  const selectedMessages = useMemo(() => visibleMessages.filter(m => selectedIds.has(m.id)), [visibleMessages, selectedIds]);
  const selectionAllowsEveryone = selectedMessages.length > 0 && selectedMessages.every(m => m.sender_id === user?.id && !m.is_deleted);
  const selectionForwardable = selectedMessages.some(m => !m.is_deleted);
  // Deselecting the last message ends selection mode, derived (not synced through an effect).
  const selecting = selectMode && selectedIds.size > 0;
  const exitSelect = useCallback(() => { setSelectMode(false); setSelectedIds(new Set()); }, []);
  const toggleSelected = useCallback((id: string) => setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }), []);
  const onActionError = (error: unknown) => Alert.alert("Couldn't do that", error instanceof Error ? error.message : "Please try again.");
  const shareText = (items: Message[]) => items.filter(m => !m.is_deleted).map(m => messagePreview(m.content)).join("\n");
  const openMenu = useCallback((message: Message, anchor: MessageAnchor) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); Keyboard.dismiss(); setMenu({ message, anchor }); }, []);
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const person = conversation.data?.other_participant; const rows = useMemo(() => !query.trim() ? visibleMessages : visibleMessages.filter(message => message.content.toLowerCase().includes(query.trim().toLowerCase())), [visibleMessages, query]);
  const messagesById = useMemo(() => new Map((messages.data ?? []).map(m => [m.id, m])), [messages.data]);
  const indexById = useMemo(() => new Map(rows.map((m, i) => [m.id, i])), [rows]);

  // Which messages get the "just added" bounce-in animation on the Bubble
  // below — genuine new arrivals only (one just sent, or one landing via
  // the 5s poll while the thread is open), never the initial load of a
  // conversation or the SQLite-cache paint that precedes it. hasLoadedRef
  // gates that first population; after that, any id not yet in
  // seenIdsRef is new.
  const hasLoadedRef = useRef(false);
  const seenIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => { hasLoadedRef.current = false; seenIdsRef.current = new Set(); }, [conversationId]);
  useEffect(() => { if (!messages.data) return; for (const m of messages.data) seenIdsRef.current.add(m.id); hasLoadedRef.current = true; }, [messages.data]);

  useEffect(() => { const unread = (messages.data ?? []).filter(message => message.sender_id !== user?.id && !message.read_at).map(message => message.id); if (user && conversationId) void markConversationRead(conversationId, user.id, unread); }, [conversationId, messages.data, user]);
  useEffect(() => { if (!query) setTimeout(() => list.current?.scrollToEnd({ animated: false }), 50); }, [messages.data?.length, query]);

  const flashHighlight = useCallback((id: string) => { setFlashId(id); if (flashTimer.current) clearTimeout(flashTimer.current); flashTimer.current = setTimeout(() => setFlashId(null), 700); }, []);
  const scrollToMessage = useCallback((id: string) => { const index = indexById.get(id); if (index == null) return; list.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 }); flashHighlight(id); }, [indexById, flashHighlight]);
  // Swiping a bubble to reply feels the same as tapping "Reply" from a
  // long-press menu: drop whichever composer mode is up (emoji tray) so
  // the keyboard has room, then focus the input. The extra frame lets
  // the reply banner actually mount (it changes the composer's height)
  // before we focus, so the layout change and keyboard animation don't fight.
  const startReply = useCallback((m: Message) => { setReplyTarget(m); flashHighlight(m.id); setShowEmoji(false); requestAnimationFrame(() => inputRef.current?.focus()); }, [flashHighlight]);

  const submit = () => { if (!draft.trim() || send.isPending) return; const message = draft; const replyingTo = replyTarget; setDraft(""); setShowEmoji(false); setReplyTarget(null); send.mutate({ content: message, replyToMessageId: replyingTo?.id ?? null }, { onError: () => { setDraft(message); setReplyTarget(replyingTo); Alert.alert("Couldn't send message", "Please try again."); } }); };
  const renderMessage = useCallback(({ item }: { item: Message }) => <Bubble
    item={item}
    own={item.sender_id === user?.id}
    accent={colors.accent}
    repliedTo={item.reply_to_message_id ? messagesById.get(item.reply_to_message_id) ?? null : null}
    repliedToIsMe={item.reply_to_message_id ? messagesById.get(item.reply_to_message_id)?.sender_id === user?.id : false}
    isFlashed={flashId === item.id}
    animateIn={hasLoadedRef.current && !seenIdsRef.current.has(item.id)}
    starred={!!stateMap?.[item.id]?.starred_at}
    pinned={!!stateMap?.[item.id]?.pinned_at}
    reactions={reactionMap?.[item.id]}
    myId={user?.id ?? ""}
    selectMode={selecting}
    selected={selectedIds.has(item.id)}
    onSwipeReply={startReply}
    onQuoteTap={scrollToMessage}
    onLongPress={openMenu}
    onToggleSelect={toggleSelected}
    onReactionPress={(messageId, emoji, mine) => (mine ? removeReaction.mutate(messageId, { onError: onActionError }) : setReaction.mutate({ messageId, emoji }, { onError: onActionError }))}
  />, [colors.accent, user?.id, messagesById, flashId, startReply, scrollToMessage, stateMap, reactionMap, selecting, selectedIds, openMenu, toggleSelected]);
  const sendPreview=()=>{if(!voicePreview||sendVoice.isPending)return;const preview=voicePreview;setVoicePreview(null);sendVoice.mutate(preview,{onError:()=>{setVoicePreview(preview);Alert.alert("Couldn't send voice message","Please try again.");}});};
  const openProfile = () => { if (person?.username) router.push({ pathname: "/profiles/[username]", params: { username: person.username } }); };
  // Only a truly cold open (no cached conversation-list entry to seed
  // from — see useConversation's placeholderData) ever reaches this:
  // otherwise the header/composer shell below mounts immediately and
  // the thread's own loader further down handles the rest, so opening
  // a chat from the message list never waits on this query.
  if (conversation.isError && !conversation.data) return <SafeAreaView style={[s.root, { backgroundColor: colors.background }]}><ErrorState message="Couldn't open this conversation." onRetry={() => void conversation.refetch()} /></SafeAreaView>;
  const name = conversation.data ? (conversation.data.is_group && conversation.data.team_page ? conversation.data.team_page.name : person!.display_name) : "Chat";
  const avatar = conversation.data ? (conversation.data.is_group && conversation.data.team_page ? conversation.data.team_page.avatar_url : person!.avatar_url) : null;
  const writable = conversation.data ? !conversation.data.left_at && !messageLocked : true;
  return <SafeAreaView edges={["top", "left", "right", "bottom"]} style={[s.root, { backgroundColor: colors.background }]}><KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={8}>
    {selecting ? <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <Pressable onPress={exitSelect} style={s.iconButton} accessibilityLabel="Cancel selection"><Icon name="x" size={22} color={colors.textSecondary} /></Pressable>
      <Text style={s.selectCount}>{selectedIds.size} selected</Text>
      <Pressable onPress={() => { bulkState.mutate({ messageIds: [...selectedIds], patch: { starred_at: new Date().toISOString() } }, { onError: onActionError }); exitSelect(); }} style={s.iconButton} accessibilityLabel="Star"><Icon name="star" size={20} color={colors.textSecondary} /></Pressable>
      <Pressable onPress={() => { bulkState.mutate({ messageIds: [...selectedIds], patch: { hidden_at: new Date().toISOString() } }, { onError: onActionError }); exitSelect(); }} style={s.iconButton} accessibilityLabel="Hide for me"><Icon name="eye-off" size={20} color={colors.textSecondary} /></Pressable>
      <Pressable disabled={!selectionForwardable} onPress={() => setForwardItems(selectedMessages.filter(m => !m.is_deleted).map(m => ({ content: m.content })))} style={[s.iconButton, !selectionForwardable && s.dim]} accessibilityLabel="Forward"><Icon name="forward" size={20} color={colors.textSecondary} /></Pressable>
      <Pressable disabled={!selectionForwardable} onPress={() => { const text = shareText(selectedMessages); if (text) void Share.share({ message: text }); }} style={[s.iconButton, !selectionForwardable && s.dim]} accessibilityLabel="Share outside app"><Icon name="share-2" size={20} color={colors.textSecondary} /></Pressable>
      <Pressable onPress={() => setDeleteTarget({ ids: [...selectedIds], allowEveryone: selectionAllowsEveryone })} style={s.iconButton} accessibilityLabel="Delete"><Icon name="trash-2" size={20} color={colors.danger} /></Pressable>
    </View> : <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}><Pressable onPress={() => router.back()} style={s.iconButton}><Icon name="arrow-left" size={23} color={colors.textSecondary} /></Pressable><Pressable onPress={openProfile} style={s.identity}><View><Avatar uri={avatar} name={name} size={40} /><View style={[s.presence, { backgroundColor: colors.accent }]} /></View><View style={s.identityText}><Text numberOfLines={1} style={s.name}>{name}</Text><Text numberOfLines={1} color="muted" style={s.status}>{conversation.data ? (conversation.data.is_group ? "Group conversation" : lastSeen(person?.last_seen_at ?? null)) : " "}</Text></View></Pressable><View style={s.menuAnchor}><Pressable onPress={() => setHeaderMenu(value => !value)} style={s.iconButton}><Icon name="more-horizontal" size={22} color={colors.textSecondary} /></Pressable>{headerMenu && <><Pressable onPress={() => setHeaderMenu(false)} style={s.menuDismiss}/><View style={[s.menu,{backgroundColor:colors.surface,borderColor:colors.border}]}><Pressable onPress={() => {setHeaderMenu(false);setSearch(true);}} style={s.menuItem}><Icon name="search" size={17} color={colors.text}/><Text style={s.menuText}>Search</Text></Pressable><Pressable onPress={() => {setHeaderMenu(false);router.push({pathname:"/messages/[conversationId]/hidden",params:{conversationId}});}} style={s.menuItem}><Icon name="eye-off" size={17} color={colors.text}/><Text style={s.menuText}>Hidden messages</Text></Pressable></View></>}</View></View>}
    {search && <View style={[s.search, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}><Icon name="search" size={18} color={colors.textMuted} /><TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Search in conversation" placeholderTextColor={colors.textMuted} selectionColor={colors.accent} style={[s.searchInput, { color: colors.text }]} /><Pressable onPress={() => { setSearch(false); setQuery(""); }}><Icon name="x" size={19} color={colors.textMuted} /></Pressable></View>}
    <View style={s.thread}><Wallpaper />{messages.isLoading ? <ActivityIndicator color={colors.accent} style={s.loader} /> : messages.isError ? <ErrorState message="Couldn't load messages." onRetry={() => void messages.refetch()} /> : <FlatList ref={list} data={rows} keyExtractor={item => item.id} renderItem={renderMessage} contentContainerStyle={[s.messageList, !rows.length && s.emptyList]} keyboardShouldPersistTaps="handled" onScrollToIndexFailed={info => setTimeout(() => list.current?.scrollToIndex({ index: info.index, animated: true }), 60)} ListEmptyComponent={<Text color="muted" align="center" style={s.empty}>{query ? "No matching messages." : "Say hello."}</Text>} />}</View>
    {showEmoji && <View style={[s.emojiBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}><View style={s.emojiTop}><Pressable onPress={() => setDraft(value => value.slice(0,-1))} disabled={!draft} style={s.backspace}><Icon name="delete" size={21} color={colors.textMuted}/></Pressable></View><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.emojiScroll}>{EMOJI_CATEGORIES.map(section=><View key={section.key} style={s.emojiSection}><Text color="muted" style={s.emojiLabel}>{section.label}</Text><View style={s.emojiGrid}>{section.emojis.map((emoji,index)=><Pressable key={`${section.key}-${index}`} onPress={() => setDraft(value => value + emoji)} style={s.emoji}><Text style={s.emojiText}>{emoji}</Text></Pressable>)}</View></View>)}</ScrollView></View>}
    {conversation.data?.is_request && <View style={[s.request, { backgroundColor: colors.accentSoft }]}><Text color="secondary" style={s.requestText}>Reply to accept this message request.</Text></View>}
    {replyTarget && <View style={[s.replyBanner, { backgroundColor: colors.surfaceElevated, borderTopColor: colors.border }]}><View style={[s.replyBannerBar, { backgroundColor: colors.accent }]} /><View style={s.replyBannerText}><Text style={[s.replyBannerName, { color: colors.accent }]}>{replyTarget.sender_id === user?.id ? "You" : name}</Text><Text numberOfLines={1} color="muted" style={s.replyBannerSnippet}>{replyTarget.is_deleted ? "Original message deleted" : decodeVoiceNote(replyTarget.content) ? "Voice note" : replyTarget.content}</Text></View><Pressable onPress={() => setReplyTarget(null)} style={s.replyBannerClose}><Icon name="x" size={18} color={colors.textMuted} /></Pressable></View>}
    {voiceRecorder.phase === "locked" ? (
      <VoiceRecordingLockedBar peaks={voiceRecorder.livePeaks} durationMillis={voiceRecorder.durationMillis} onCancel={voiceRecorder.cancelRecording} onSend={voiceRecorder.finishRecording} />
    ) : (
      <View style={[s.composer, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: 8 + bottomInset, position: "relative" }]}>
        {writable&&voicePreview?<><Pressable onPress={()=>setVoicePreview(null)} style={s.composeIcon}><Icon name="trash-2" size={22} color={colors.danger}/></Pressable><View style={[voicePreviewStyles.preview,{backgroundColor:colors.surfaceElevated,borderColor:colors.border}]}><Icon name="mic" size={18} color={colors.accent}/><Text style={voicePreviewStyles.previewTime}>{Math.floor(voicePreview.durationSec/60)}:{String(Math.floor(voicePreview.durationSec%60)).padStart(2,"0")}</Text><Pressable onPress={()=>setVoicePreview(value=>value?{...value,viewOnce:!value.viewOnce}:value)} style={[voicePreviewStyles.onceToggle,{backgroundColor:voicePreview.viewOnce?colors.accent:colors.surface}]}><Text style={{color:voicePreview.viewOnce?"#07130D":colors.textMuted,fontSize:11,fontWeight:"800"}}>1</Text></Pressable></View><Pressable onPress={sendPreview} disabled={sendVoice.isPending} style={[s.send,{backgroundColor:colors.accent}]}>{sendVoice.isPending?<ActivityIndicator size="small" color="#07130D"/>:<Icon name="send" size={19} color="#07130D"/>}</Pressable></>
        :writable?<><Pressable onPress={() => setShowEmoji(value => { const next = !value; if (next) inputRef.current?.blur(); else requestAnimationFrame(() => inputRef.current?.focus()); return next; })} style={s.composeIcon}><Icon name={showEmoji?"keyboard":"smile"} size={24} color={colors.textSecondary} /></Pressable><TextInput ref={inputRef} value={draft} onChangeText={setDraft} onFocus={() => setShowEmoji(false)} placeholder="Message..." placeholderTextColor={colors.textMuted} selectionColor={colors.accent} multiline maxLength={2000} style={[s.draft, { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]} onSubmitEditing={submit} blurOnSubmit={false} />{draft.trim() && <Pressable onPress={submit} disabled={send.isPending} style={[s.send, { backgroundColor: colors.accent, opacity: send.isPending ? .6 : 1 }]}>{send.isPending ? <ActivityIndicator size="small" color="#07130D" /> : <Icon name="send" size={19} color="#07130D" />}</Pressable>}</>
        :<Text color="muted" align="center" style={s.left}>You can no longer send messages in this conversation.</Text>}
        {voiceRecorder.phase === "held" && <VoiceRecordingHeldHint dragX={voiceRecorder.dragX} dragY={voiceRecorder.dragY} durationMillis={voiceRecorder.durationMillis} />}
        {writable && !voicePreview && !draft.trim() && (
          <View {...voiceRecorder.panHandlers} style={[s.send, { backgroundColor: colors.accent }]}>
            <Icon name="mic" size={20} color="#07130D" />
          </View>
        )}
      </View>
    )}
    {menu && (() => {
      const message = menu.message; const state = stateMap?.[message.id]; const voice = decodeVoiceNote(message.content);
      const mine = reactionMap?.[message.id]?.find(r => r.user_id === user?.id)?.emoji ?? null;
      return <MessageActionMenu
        anchor={menu.anchor} content={messagePreview(message.content)} canCopy={!voice} isMine={message.sender_id === user?.id} isDeleted={message.is_deleted}
        isStarred={!!state?.starred_at} isPinned={!!state?.pinned_at} emojis={topEmojis} myReaction={mine}
        onReact={emoji => setReaction.mutate({ messageId: message.id, emoji }, { onError: onActionError })}
        onRemoveReaction={() => removeReaction.mutate(message.id, { onError: onActionError })}
        onOpenFullPicker={() => setPickerFor(message.id)}
        onReply={() => startReply(message)}
        onForward={() => setForwardItems([{ content: message.content }])}
        onCopy={() => void Clipboard.setStringAsync(message.content)}
        onToggleStar={() => toggleStar.mutate({ messageId: message.id, active: !state?.starred_at }, { onError: onActionError })}
        onDeletePress={() => setDeleteTarget({ ids: [message.id], allowEveryone: message.sender_id === user?.id && !message.is_deleted })}
        onTogglePin={() => togglePin.mutate({ messageId: message.id, active: !state?.pinned_at }, { onError: onActionError })}
        onHide={() => toggleHide.mutate({ messageId: message.id, active: true }, { onError: onActionError })}
        onShare={() => void Share.share({ message: messagePreview(message.content) })}
        onSelect={() => { setSelectMode(true); setSelectedIds(new Set([message.id])); }}
        onClose={() => setMenu(null)}
      />;
    })()}
    {pickerFor && <EmojiPickerSheet onPick={emoji => { setReaction.mutate({ messageId: pickerFor, emoji }, { onError: onActionError }); setPickerFor(null); }} onClose={() => setPickerFor(null)} />}
    {deleteTarget && <DeleteMessageSheet count={deleteTarget.ids.length} allowEveryone={deleteTarget.allowEveryone} onClose={() => setDeleteTarget(null)} onDelete={scope => { const target = deleteTarget; setDeleteTarget(null); deleteMessages.mutate({ messageIds: target.ids, scope }, { onError: onActionError }); exitSelect(); }} />}
    {forwardItems && <ForwardMessageSheet messages={forwardItems} onClose={() => setForwardItems(null)} onSent={() => { setForwardItems(null); exitSelect(); }} />}
  </KeyboardAvoidingView></SafeAreaView>;
}

type BubbleProps = { item: Message; own: boolean; accent: string; repliedTo: Message | null; repliedToIsMe: boolean; isFlashed: boolean; animateIn: boolean; starred: boolean; pinned: boolean; reactions: MessageReaction[] | undefined; myId: string; selectMode: boolean; selected: boolean; onSwipeReply: (m: Message) => void; onQuoteTap: (id: string) => void; onLongPress: (m: Message, anchor: MessageAnchor) => void; onToggleSelect: (id: string) => void; onReactionPress: (messageId: string, emoji: string, mine: boolean) => void };
const Bubble = memo(function Bubble({ item, own, accent, repliedTo, repliedToIsMe, isFlashed, animateIn, starred, pinned, reactions, myId, selectMode, selected, onSwipeReply, onQuoteTap, onLongPress, onToggleSelect, onReactionPress }: BubbleProps) {
  const voice=decodeVoiceNote(item.content);
  const repliedVoice = repliedTo && !repliedTo.is_deleted ? decodeVoiceNote(repliedTo.content) : null;

  // Entrance: a spring allowed to overshoot past 1 (no extrapolate:
  // "clamp") gives the WhatsApp-style "pop" a slight bounce instead of a
  // flat ease-in. Skipped entirely (anim starts at 1) for anything
  // already on screen — initial load and the SQLite paint that precedes
  // it — so opening a conversation never replays this for a whole
  // screenful of messages at once.
  const anim = useRef(new Animated.Value(animateIn ? 0 : 1)).current;
  useEffect(() => { if (animateIn) Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 6, tension: 170 }).start(); }, [animateIn, anim]);
  const entranceStyle = { opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }, { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] };

  // Swipe-to-reply: the responder lives on the outer row (the full width
  // of whichever side of the screen this message occupies), not on the
  // bubble itself — a short bubble used to leave a lot of dead space
  // next to it that didn't respond to the gesture at all.
  const swipeX = useRef(new Animated.Value(0)).current;
  const triggered = useRef(false);
  const selectModeRef = useRef(selectMode);
  useEffect(() => { selectModeRef.current = selectMode; }, [selectMode]);
  const bubbleRef = useRef<View>(null);
  const local = isLocalMessageId(item.id);
  const groups = useMemo(() => { const byEmoji = new Map<string, { count: number; mine: boolean }>(); for (const r of reactions ?? []) { const g = byEmoji.get(r.emoji) ?? { count: 0, mine: false }; g.count += 1; if (r.user_id === myId) g.mine = true; byEmoji.set(r.emoji, g); } return [...byEmoji.entries()]; }, [reactions, myId]);
  const openMenu = () => { if (selectMode || local) return; bubbleRef.current?.measureInWindow((x, y, width, height) => onLongPress(item, { x, y, width, height })); };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (_, g) => !selectModeRef.current && !item.is_deleted && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) && g.dx > 0,
    onPanResponderGrant: () => { triggered.current = false; },
    onPanResponderMove: (_, g) => {
      const dx = Math.max(0, g.dx);
      const display = dx <= SWIPE_MAX ? dx : SWIPE_MAX + (dx - SWIPE_MAX) * SWIPE_RESISTANCE;
      swipeX.setValue(display);
      if (dx > SWIPE_THRESHOLD && !triggered.current) { triggered.current = true; Vibration.vibrate(12); onSwipeReply(item); }
    },
    onPanResponderRelease: () => { Animated.spring(swipeX, { toValue: 0, useNativeDriver: true, friction: 7 }).start(); },
    onPanResponderTerminate: () => { Animated.spring(swipeX, { toValue: 0, useNativeDriver: true, friction: 7 }).start(); },
  })).current;

  return <Animated.View style={[s.bubbleRow, own ? s.ownRow : s.otherRow, selected && { backgroundColor: accent + "22" }, entranceStyle]}>
    {selectMode && <View pointerEvents="none" style={s.selectMark}><Icon name={selected ? "check-square" : "circle"} size={20} color={selected ? accent : "#9DA39E"} /></View>}
    <View style={own ? s.ownGesture : s.otherGesture} {...pan.panHandlers}>
      <Animated.View style={[s.replyHint, { backgroundColor: accent + "26" }, { opacity: swipeX.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: "clamp" }), transform: [{ scale: swipeX.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0.7, 1], extrapolate: "clamp" }) }] }]}>
        <Icon name="reply" size={16} color={accent} />
      </Animated.View>
      <Animated.View ref={bubbleRef} style={[s.bubble, own ? { backgroundColor: accent } : s.otherBubble, isFlashed && { backgroundColor: accent + "40" }, { transform: [{ translateX: swipeX }] }]}>
        <Pressable onLongPress={openMenu} delayLongPress={280} onPress={selectMode ? () => onToggleSelect(item.id) : undefined}>
        {repliedTo && !item.is_deleted && <Pressable onPress={() => onQuoteTap(repliedTo.id)} style={[s.quote, { borderLeftColor: own ? "rgba(255,255,255,0.5)" : accent }]}>
          <Text numberOfLines={1} style={[s.quoteName, own && { color: "#07130D" }]}>{repliedToIsMe ? "You" : ""}</Text>
          <Text numberOfLines={1} style={[s.quoteSnippet, own && { color: "#173526" }]}>{repliedTo.is_deleted ? "Original message deleted" : repliedVoice ? "Voice note" : repliedTo.content}</Text>
        </Pressable>}
        {item.is_deleted ? <Text color={own ? "primary" : "muted"} style={s.deleted}>This message was deleted</Text> : voice?.path?<VoiceNote id={item.id} path={voice.path} durationSec={voice.durationSec} peaks={voice.peaks} own={own} viewOnce={voice.viewOnce}/>:<Text style={[s.messageText, own && { color: "#07130D" }]}>{item.content}</Text>}
        <View style={s.meta}>{pinned && <Icon name="pin" size={11} color={own ? "#173526" : "#9DA39E"} fill={own ? "#173526" : "#9DA39E"} />}{starred && <Icon name="star" size={11} color={own ? "#173526" : "#9DA39E"} fill={own ? "#173526" : "#9DA39E"} />}<Text style={[s.time, own && { color: "#173526" }]}>{time(item.created_at)}</Text>{own && <Icon name={item.read_at ? "check-check" : "check"} size={15} color={item.read_at ? "#075B9B" : "#173526"} />}</View>
        </Pressable>
      </Animated.View>
      {groups.length > 0 && <View style={[s.reactRow, own ? s.reactOwn : s.reactOther]}>{groups.map(([emoji, g]) => <Pressable key={emoji} onPress={() => selectMode ? onToggleSelect(item.id) : onReactionPress(item.id, emoji, g.mine)} style={[s.reactChip, g.mine && { borderColor: accent, backgroundColor: accent + "26" }]}><Text style={s.reactEmoji}>{emoji}</Text>{g.count > 1 && <Text style={s.reactCount}>{g.count}</Text>}</Pressable>)}</View>}
    </View>
  </Animated.View>;
});

const voicePreviewStyles=StyleSheet.create({preview:{flex:1,minHeight:42,borderWidth:1,borderRadius:22,paddingHorizontal:13,flexDirection:"row",alignItems:"center",gap:9},previewTime:{fontSize:14,fontWeight:"700",flex:1},onceToggle:{width:25,height:25,borderRadius:13,alignItems:"center",justifyContent:"center"}});

const s = StyleSheet.create({ selectCount: { flex: 1, fontSize: 15, fontWeight: "700", marginLeft: 6 }, dim: { opacity: 0.3 }, selectMark: { position: "absolute", left: 6, top: 0, bottom: 0, justifyContent: "center", zIndex: 2 }, reactRow: { flexDirection: "row", gap: 4, marginTop: -4, paddingHorizontal: 6, flexWrap: "wrap" }, reactOwn: { justifyContent: "flex-end" }, reactOther: { justifyContent: "flex-start" }, reactChip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 12, borderWidth: 1, borderColor: "#292C29", backgroundColor: "#181A18" }, reactEmoji: { fontSize: 13 }, reactCount: { fontSize: 11, fontWeight: "700" }, root: { flex: 1 }, header: { minHeight: 64, flexDirection: "row", alignItems: "center", paddingHorizontal: 7, borderBottomWidth: StyleSheet.hairlineWidth }, iconButton: { width: 38, height: 45, alignItems: "center", justifyContent: "center" }, menuAnchor:{position:"relative"},menuDismiss:{position:"absolute",right:-12,top:45,width:380,height:800,zIndex:9},menu:{position:"absolute",zIndex:10,top:45,right:8,width:170,borderWidth:1,borderRadius:12,paddingVertical:4,elevation:8,shadowColor:"#000",shadowOpacity:.32,shadowRadius:10},menuItem:{minHeight:44,paddingHorizontal:13,flexDirection:"row",alignItems:"center",gap:11},menuText:{fontSize:14,fontWeight:"600"}, identity: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 9 }, identityText: { flex: 1, minWidth: 0 }, name: { fontSize: 15, lineHeight: 20, fontWeight: "800" }, status: { fontSize: 11, lineHeight: 15 }, presence: { position: "absolute", right: -1, bottom: -1, width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: "#111" }, search: { height: 43, margin: 9, borderWidth: 1, borderRadius: 21, paddingHorizontal: 12, alignItems: "center", flexDirection: "row", gap: 8 }, searchInput: { flex: 1, height: 40, padding: 0, fontSize: 14 }, thread: { flex: 1, overflow: "hidden" }, wallRow: { position: "absolute", right: -4, flexDirection: "row", justifyContent: "space-around", gap: 18, width: "112%" }, loader: { marginTop: 55 }, messageList: { padding: 12, paddingBottom: 16 }, emptyList: { flexGrow: 1, justifyContent: "center" }, empty: { fontSize: 14, marginBottom: 18 }, bubbleRow: { width: "100%", marginVertical: 3, flexDirection: "row" }, ownRow: { justifyContent: "flex-end" }, otherRow: { justifyContent: "flex-start" }, ownGesture: { maxWidth: "100%", paddingLeft: "20%", alignItems: "flex-end" }, otherGesture: { maxWidth: "100%", paddingRight: "20%", alignItems: "flex-start" }, replyHint: { position: "absolute", left: -36, top: "50%", marginTop: -16, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" }, bubble: { maxWidth: "100%", paddingHorizontal: 11, paddingTop: 8, paddingBottom: 5, borderRadius: 16 }, otherBubble: { backgroundColor: "#181A18", borderWidth: StyleSheet.hairlineWidth, borderColor: "#292C29" }, quote: { borderLeftWidth: 2, paddingLeft: 7, marginBottom: 5 }, quoteName: { fontSize: 12, fontWeight: "700", color: "#9DA39E" }, quoteSnippet: { fontSize: 12, color: "#9DA39E" }, messageText: { fontSize: 15, lineHeight: 20 }, deleted: { fontSize: 14, fontStyle: "italic" }, meta: { marginTop: 3, alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: 3 }, time: { color: "#9DA39E", fontSize: 10, lineHeight: 13 }, emojiBar:{height:"45%",minHeight:270,borderTopWidth:StyleSheet.hairlineWidth},emojiTop:{height:35,alignItems:"flex-end",justifyContent:"center",paddingHorizontal:12},backspace:{padding:6},emojiScroll:{paddingHorizontal:12,paddingBottom:18},emojiSection:{marginBottom:12},emojiLabel:{fontSize:12,lineHeight:17,marginBottom:4},emojiGrid:{flexDirection:"row",flexWrap:"wrap"},emoji:{width:"12.5%",aspectRatio:1,alignItems:"center",justifyContent:"center"},emojiText:{fontSize:27,lineHeight:32}, request: { paddingHorizontal: 18, paddingVertical: 7 }, requestText: { fontSize: 12, textAlign: "center" }, replyBanner: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 9 }, replyBannerBar: { width: 3, alignSelf: "stretch", borderRadius: 2 }, replyBannerText: { flex: 1, minWidth: 0 }, replyBannerName: { fontSize: 12, fontWeight: "800" }, replyBannerSnippet: { fontSize: 12 }, replyBannerClose: { padding: 6 }, composer: { minHeight: 61, paddingHorizontal: 8, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "flex-end", gap: 7 }, composeIcon: { width: 29, height: 42, alignItems: "center", justifyContent: "center" }, draft: { flex: 1, minHeight: 42, maxHeight: 104, borderWidth: 1, borderRadius: 22, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, fontSize: 15, lineHeight: 20 }, send: { height: 39, width: 39, borderRadius: 21, alignItems: "center", justifyContent: "center", marginBottom: 1 }, left: { flex: 1, fontSize: 12, paddingVertical: 10 } });
