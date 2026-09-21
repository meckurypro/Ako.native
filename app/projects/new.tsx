import { useEffect, useState } from "react";
import { Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import { Icon } from "@/components/core/Icon";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar, Text } from "@/components/core";
import { useActiveIdentity } from "@/features/compose/api";
import { useCategories } from "@/features/onboarding/api";
import { type ProjectType, useCreateProject, useGigRoles, useGigSamples, useUploadProjectAsset } from "@/features/projects/api";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import type { ThemeColors } from "@/theme";

const LABELS: Record<ProjectType, string> = { file: "File", url: "URL", meeting: "Meeting", media: "Media", gig: "Gig", pitch: "Pitch", book: "Book", event: "Event", room: "Cohort", course: "Course" };
const HINTS: Record<ProjectType, string> = {
  file: "A file you upload and host here — visitors download it with one click.",
  url: "A link you're selling access to — a WhatsApp group, a page, anything.",
  meeting: "A single scheduled live session people buy access to join.",
  media: "Audio, video, or both. Link out or upload to stream here.",
  gig: "A skill or service you offer. Show proof of work, get messaged or booked.",
  pitch: "Share an idea and let people support it for any amount.",
  book: "A book or article. Link out, upload a PDF, or build it here.",
  event: "Sell tickets to something happening in person or online.",
  room: "A structured learning group with its own chat.",
  course: "Structured modules and lessons. Build it, then publish when ready.",
};
const PERSONAL_TYPES: ProjectType[] = ["gig", "book", "media", "file"];
const PAGE_TYPES: ProjectType[] = ["event", "room", "course", "book", "url"];
const MAX_TOPICS = 5;
type MediaKey = "audio" | "video" | "image";
type MediaChannel = { enabled: boolean; url: string; path: string | null; name: string | null };

export default function NewProject() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profile } = useAuth();
  const identity = useActiveIdentity();
  const categories = useCategories();
  const create = useCreateProject();
  const gigRoles = useGigRoles();
  const gigSamples = useGigSamples();
  const thumbnailUpload = useUploadProjectAsset("post-media");
  const fileUpload = useUploadProjectAsset("private-content");
  const postingAsPage = identity.data?.mode === "page" ? identity.data.page : null;
  const allowedTypes = postingAsPage ? PAGE_TYPES : PERSONAL_TYPES;
  const [type, setType] = useState<ProjectType>("file");
  const [typeMenu, setTypeMenu] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnail, setThumbnail] = useState<{ url: string; width: number; height: number } | null>(null);
  const [file, setFile] = useState<{ path: string; name: string } | null>(null);
  const [url, setUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [goal, setGoal] = useState("");
  const [bookType, setBookType] = useState<"book" | "article">("book");
  const [bookSource, setBookSource] = useState<"upload" | "link" | "authored">("upload");
  const [bookUrl, setBookUrl] = useState("");
  const [bookReadInApp, setBookReadInApp] = useState(true);
  const [bookDownload, setBookDownload] = useState(false);
  const [bookOwnWork, setBookOwnWork] = useState(true);
  const [bookAuthor, setBookAuthor] = useState("");
  const [bookCredit, setBookCredit] = useState("");
  const [gigRoleId, setGigRoleId] = useState("");
  const [gigRoleMenu, setGigRoleMenu] = useState(false);
  const [gigTagline, setGigTagline] = useState("");
  const [gigDelivery, setGigDelivery] = useState("");
  const [gigRevisions, setGigRevisions] = useState("");
  const [gigDeliverables, setGigDeliverables] = useState<string[]>([]);
  const [gigFaq, setGigFaq] = useState<{question:string;answer:string}[]>([]);
  const [gigSampleIds, setGigSampleIds] = useState<string[]>([]);
  const [mediaChannels, setMediaChannels] = useState<Record<MediaKey,MediaChannel>>({audio:{enabled:false,url:"",path:null,name:null},video:{enabled:false,url:"",path:null,name:null},image:{enabled:false,url:"",path:null,name:null}});
  const [price, setPrice] = useState("0");
  const [promoEnabled, setPromoEnabled] = useState(false);
  const [promo, setPromo] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [topics, setTopics] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!allowedTypes.includes(type)) setType(allowedTypes[0]); }, [allowedTypes, type]);
  useEffect(() => {
    if (type === "book" && !bookOwnWork) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPrice("0");
      setPromoEnabled(false);
      setPromo("");
    }
  }, [type, bookOwnWork]);

  const chooseThumbnail = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 0.9 });
    if (result.canceled) return;
    const asset = result.assets[0];
    try {
      const uploaded = await thumbnailUpload.mutateAsync({ uri: asset.uri, name: asset.fileName, mimeType: asset.mimeType, size: asset.fileSize });
      setThumbnail({ url: uploaded, width: asset.width, height: asset.height });
    } catch (err) { setError(err instanceof Error ? err.message : "Thumbnail upload failed."); }
  };

  const chooseFile = async (pdfOnly = false) => {
    const result = await DocumentPicker.getDocumentAsync({ type: pdfOnly ? "application/pdf" : "*/*", copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (pdfOnly && asset.mimeType !== "application/pdf") return setError("Only PDF files are supported for upload right now.");
    try {
      const path = await fileUpload.mutateAsync({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size });
      setFile({ path, name: asset.name });
    } catch (err) { setError(err instanceof Error ? err.message : "File upload failed."); }
  };

  const chooseMediaFile = async (key: MediaKey) => {
    const mime = key === "audio" ? "audio/*" : key === "video" ? "video/*" : "image/*";
    const result = await DocumentPicker.getDocumentAsync({ type: mime, copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    try {
      const path = await fileUpload.mutateAsync({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size });
      setMediaChannels(current=>({...current,[key]:{...current[key],path,name:asset.name}}));
    } catch (err) { setError(err instanceof Error ? err.message : "File upload failed."); }
  };

  const toggleTopic = (id: string) => setTopics((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else if (next.size < MAX_TOPICS) next.add(id);
    return next;
  });

  const submit = async () => {
    setError(null);
    if (!title.trim()) return setError("Title is required.");
    if (type === "file" && !file) return setError("Upload a file to continue.");
    if (type === "url" && !url.trim()) return setError("Add the link you're sharing access to.");
    if (type === "meeting" && !scheduledAt.trim()) return setError("Set when this meeting happens.");
    if (type === "book" && bookSource === "upload" && !file) return setError("Upload a PDF to continue.");
    if (type === "book" && bookSource === "upload" && !bookReadInApp && !bookDownload) return setError("Allow download, in-app reading, or both.");
    if (type === "book" && bookSource === "link" && !bookUrl.trim()) return setError("Add the link to the book or article.");
    if (type === "book" && !bookOwnWork && !bookAuthor.trim()) return setError("Add the original author's name.");
    if (type === "gig" && !gigRoleId) return setError("Select the professional role this gig represents.");
    if (type === "gig" && !gigTagline.trim()) return setError("Add a short tagline for this gig.");
    if (type === "media") {
      const {audio,video,image}=mediaChannels;
      if (!audio.enabled&&!video.enabled&&!image.enabled) return setError("Turn on Audio, Video, Image, or any combination.");
      if ((audio.enabled&&!audio.path&&!audio.url.trim())||(video.enabled&&!video.path&&!video.url.trim())||(image.enabled&&!image.path)) return setError("Add a link or upload a file for each channel you turned on.");
    }
    const amount = Number.parseFloat(price) || 0;
    let promoAmount: number | null = null;
    if (promoEnabled) {
      promoAmount = Number.parseFloat(promo);
      if (Number.isNaN(promoAmount) || promoAmount < 0 || promoAmount >= amount) return setError("Promo price must be valid and lower than the actual price.");
    }
    if (type === "pitch" && (!(Number.parseFloat(goal) > 0))) return setError("Set a fundraising goal above $0.");
    try {
      await create.mutateAsync({
        title: title.trim(), description: description.trim() || undefined, project_type: type,
        posted_as_page_id: postingAsPage?.id, external_url: type === "url" ? url.trim() : undefined,
        file_path: type === "file" ? file?.path : undefined, thumbnail_url: thumbnail?.url,
        thumbnail_width: thumbnail?.width, thumbnail_height: thumbnail?.height,
        price_usd: type === "pitch" ? 0 : amount, promo_price_usd: type === "pitch" ? null : promoAmount,
        is_private: isPrivate, status: type === "course" || (type === "book" && bookSource === "authored") ? "draft" : undefined,
        topic_ids: [...topics], scheduled_at: type === "meeting" ? new Date(scheduledAt).toISOString() : undefined,
        goal_amount_usd: type === "pitch" ? Number.parseFloat(goal) : undefined,
        book_details: type === "book" ? {
          book_type: bookType, content_source: bookSource, is_own_work: bookOwnWork,
          author_name: bookOwnWork ? undefined : bookAuthor.trim(),
          source_credit: bookOwnWork ? undefined : bookCredit.trim() || undefined,
          external_url: bookSource === "link" ? bookUrl.trim() : undefined,
          file_path: bookSource === "upload" ? file?.path : undefined,
          allow_download: bookSource === "upload" ? bookDownload : undefined,
          allow_read_in_app: bookSource === "upload" ? bookReadInApp : undefined,
        } : undefined,
        gig_details: type === "gig" ? {
          role_id: gigRoleId, tagline: gigTagline.trim(), delivery_estimate: gigDelivery.trim() || undefined,
          sample_project_ids: gigSampleIds,
          revisions_included: gigRevisions.trim() ? Number.parseInt(gigRevisions, 10) : undefined,
          deliverables: gigDeliverables.map(value=>value.trim()).filter(Boolean),
          faq: gigFaq.map(item=>({question:item.question.trim(),answer:item.answer.trim()})).filter(item=>item.question&&item.answer),
        } : undefined,
        media_details: type === "media" ? {
          has_audio:mediaChannels.audio.enabled,has_video:mediaChannels.video.enabled,has_image:mediaChannels.image.enabled,
          audio_source:mediaChannels.audio.enabled?(mediaChannels.audio.path?"upload":"link"):undefined,
          audio_url:mediaChannels.audio.enabled?mediaChannels.audio.url.trim()||undefined:undefined,
          audio_file_path:mediaChannels.audio.enabled?mediaChannels.audio.path??undefined:undefined,
          video_source:mediaChannels.video.enabled?(mediaChannels.video.path?"upload":"link"):undefined,
          video_url:mediaChannels.video.enabled?mediaChannels.video.url.trim()||undefined:undefined,
          video_file_path:mediaChannels.video.enabled?mediaChannels.video.path??undefined:undefined,
          image_source:mediaChannels.image.enabled?"upload":undefined,
          image_file_path:mediaChannels.image.enabled?mediaChannels.image.path??undefined:undefined,
        }:undefined,
      });
      Alert.alert(type === "course" ? "Draft created" : "Project published", `${title.trim()} created successfully.`, [{ text: "OK", onPress: () => router.replace("/(tabs)/profile") }]);
    } catch (err) { setError(err instanceof Error ? err.message : "Couldn't create project."); }
  };

  const displayName = postingAsPage?.name ?? profile?.display_name ?? "You";
  const avatar = postingAsPage?.avatar_url ?? profile?.avatar_url;
  const inputStyle = [styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }];

  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "left", "right"]}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}><Icon name="arrow-left" size={23} color={colors.textMuted}/></Pressable>
      <Text style={styles.pageTitle}>New project</Text>
      <Pressable onPress={() => void chooseThumbnail()} style={[styles.thumbnail, { borderColor: colors.border, backgroundColor: colors.surface }, thumbnail ? { aspectRatio: thumbnail.width / thumbnail.height } : null]}>
        {thumbnail ? <Image source={{ uri: thumbnail.url }} style={styles.thumbnailImage}/> : <View style={styles.thumbnailEmpty}><Icon name="image" size={25} color={colors.textMuted}/><Text color="muted">{thumbnailUpload.isPending ? "Uploading…" : "Add thumbnail"}</Text></View>}
      </Pressable>
      <View style={styles.identity}><Avatar uri={avatar} name={displayName} size={32}/><Text style={styles.identityText} color="muted">Posting as <Text style={styles.identityName}>{displayName}</Text>{!postingAsPage && <Text color="accent" onPress={()=>router.push("/pages" as never)}> · switch</Text>}</Text></View>

      <FieldLabel text="TITLE" small/><TextInput value={title} onChangeText={setTitle} selectionColor={colors.accent} style={[styles.titleInput, { borderBottomColor: colors.border, color: colors.text }]}/>
      <FieldLabel text="Project type"/><Pressable onPress={() => setTypeMenu(true)} style={inputStyle}><Text>{LABELS[type]}</Text><Icon name="chevron-down" size={18} color={colors.textMuted}/></Pressable>
      <Text variant="caption" color="muted" style={styles.hint}>{HINTS[type]} {postingAsPage ? "Event, Cohort, and Course are page-only." : "Gig, Meeting, Media, and File are personal-only."}</Text>

      <FieldLabel text="Description"/><View style={styles.formatBar}>{(["bold","italic","strikethrough","underline"] as const).map((icon)=><Icon key={icon} name={icon} size={18} color={colors.textMuted}/>)}</View>
      <TextInput value={description} onChangeText={(v)=>setDescription(v.slice(0,450))} multiline textAlignVertical="top" selectionColor={colors.accent} style={[inputStyle, styles.description]}/><Text variant="caption" color="muted" align="right" style={styles.counter}>{description.length}/450</Text>

      <Pressable onPress={()=>setTopicsOpen(v=>!v)} style={styles.row}><Text style={styles.label} color="muted">Topics (optional){topics.size ? ` (${topics.size})` : ""}</Text><Icon name={topicsOpen?"chevron-up":"chevron-down"} size={18} color={colors.textMuted}/></Pressable>
      {topicsOpen && <View><Text variant="caption" color="muted" style={styles.topicCount}>{topics.size}/{MAX_TOPICS} selected</Text>{categories.data?.map(category=><View key={category.id} style={[styles.category,{borderBottomColor:colors.border}]}><Pressable onPress={()=>setOpenCategory(v=>v===category.id?null:category.id)} style={styles.row}><Text style={styles.label}>{category.name}</Text><Icon name={openCategory===category.id?"chevron-up":"chevron-down"} size={18} color={colors.textMuted}/></Pressable>{openCategory===category.id&&<View style={styles.pills}>{category.interests.map(interest=>{const selected=topics.has(interest.id);return <Pressable key={interest.id} disabled={!selected&&topics.size>=MAX_TOPICS} onPress={()=>toggleTopic(interest.id)} style={[styles.pill,{borderColor:selected?colors.accent:colors.border,backgroundColor:selected?colors.accent:colors.surface},!selected&&topics.size>=MAX_TOPICS&&styles.disabled]}><Text style={{fontSize:12,fontWeight:"600",color:selected?colors.onAccent:colors.text}}>{interest.name}</Text></Pressable>})}</View>}</View>)}</View>}

      {type === "file" && <><FieldLabel text="File"/><Pressable onPress={()=>void chooseFile()} style={inputStyle}><View style={styles.fileLabel}><Icon name="file-up" size={18} color={colors.textMuted}/><Text color="secondary" numberOfLines={1}>{fileUpload.isPending?"Uploading…":file?.name??"Choose file"}</Text></View></Pressable><Text variant="caption" color="muted" style={styles.hint}>Hosted here — no external link is stored. Visitors with access download it with one tap.</Text></>}
      {type === "url" && <><FieldLabel text="URL"/><TextInput value={url} onChangeText={setUrl} placeholder="https://" placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="url" style={inputStyle}/></>}
      {type === "meeting" && <><FieldLabel text="Scheduled date and time"/><TextInput value={scheduledAt} onChangeText={setScheduledAt} placeholder="2026-09-30T14:00:00" placeholderTextColor={colors.textMuted} autoCapitalize="none" style={inputStyle}/></>}
      {type === "pitch" && <><FieldLabel text="Fundraising goal (USD)"/><TextInput value={goal} onChangeText={setGoal} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textMuted} style={inputStyle}/></>}

      {type === "book" && <>
        <FieldLabel text="Type"/>
        <View style={styles.segmentRow}>{(["book","article"] as const).map(value=><ChoiceButton key={value} label={value==="book"?"Book":"Article"} selected={bookType===value} onPress={()=>setBookType(value)} colors={colors}/>)}</View>
        <FieldLabel text="How are you adding it?"/>
        <View style={styles.sourceList}>
          <RadioCard label="Upload PDF" hint="Host the file here — allow download, in-app reading, or both." selected={bookSource==="upload"} onPress={()=>setBookSource("upload")} colors={colors}/>
          <RadioCard label="Link" hint="Redirect readers to it elsewhere — nothing hosted here." selected={bookSource==="link"} onPress={()=>setBookSource("link")} colors={colors}/>
          <RadioCard label="Write in Ako" hint="Build it chapter by chapter, right here, like a Course." selected={bookSource==="authored"} onPress={()=>setBookSource("authored")} colors={colors}/>
        </View>
        {bookSource==="upload"&&<><FieldLabel text="PDF"/><Pressable onPress={()=>void chooseFile(true)} style={inputStyle}><View style={styles.fileLabel}><Icon name="file-up" size={18} color={colors.textMuted}/><Text color="secondary" numberOfLines={1}>{fileUpload.isPending?"Uploading…":file?.name??"Choose PDF"}</Text></View></Pressable><CheckRow label="Let readers read it right here in Ako" checked={bookReadInApp} onPress={()=>setBookReadInApp(v=>!v)} colors={colors}/><CheckRow label="Let readers download the PDF" checked={bookDownload} onPress={()=>setBookDownload(v=>!v)} colors={colors}/></>}
        {bookSource==="link"&&<><FieldLabel text="Link"/><TextInput value={bookUrl} onChangeText={setBookUrl} placeholder="https://..." placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="url" style={inputStyle}/></>}
        {bookSource==="authored"&&<View style={[styles.authoredNotice,{backgroundColor:colors.accentSoft}]}><Icon name="info" size={18} color={colors.accent}/><Text color="muted" style={{flex:1,fontSize:13}}>This creates a draft. Build your chapters next, add a cover, then publish when it&apos;s ready — no one can buy it until you do.</Text></View>}
        <FieldLabel text="Author"/>
        <View style={styles.segmentRow}><ChoiceButton label="I wrote this" selected={bookOwnWork} onPress={()=>setBookOwnWork(true)} colors={colors}/><ChoiceButton label="Someone else wrote this" selected={!bookOwnWork} onPress={()=>setBookOwnWork(false)} colors={colors}/></View>
        {!bookOwnWork&&<><FieldLabel text="Author's name"/><TextInput value={bookAuthor} onChangeText={setBookAuthor} placeholder="Who actually wrote it" placeholderTextColor={colors.textMuted} style={inputStyle}/><FieldLabel text="Credit / source (optional)"/><TextInput value={bookCredit} onChangeText={setBookCredit} placeholder="Originally published by…" placeholderTextColor={colors.textMuted} style={inputStyle}/><Text variant="caption" color="muted" style={styles.hint}>{"You're crediting someone else as the author, so this can't be sold — price is locked at $0."}</Text></>}
      </>}

      {type === "gig" && <>
        <FieldLabel text="Professional role"/>
        <Pressable onPress={()=>setGigRoleMenu(true)} style={inputStyle}><Text color={gigRoleId?"primary":"muted"}>{gigRoles.data?.find(role=>role.id===gigRoleId)?.label??"Select a role…"}</Text><Icon name="chevron-down" size={18} color={colors.textMuted}/></Pressable>
        <Text variant="caption" color="muted" style={styles.hint}>What this gig represents professionally — it&apos;s how your work shows up as a tab on your profile.</Text>
        <FieldLabel text="TAGLINE" small/><TextInput value={gigTagline} onChangeText={value=>setGigTagline(value.slice(0,100))} placeholder="e.g. Voice-over & audio production" placeholderTextColor={colors.textMuted} style={[styles.titleInput,{borderBottomColor:colors.border,color:colors.text}]}/>
        <View style={styles.twoColumns}><View style={{flex:1}}><FieldLabel text="DELIVERY ESTIMATE (OPTIONAL)" small/><TextInput value={gigDelivery} onChangeText={value=>setGigDelivery(value.slice(0,60))} placeholder="e.g. 3–5 business days" placeholderTextColor={colors.textMuted} style={[styles.titleInput,{borderBottomColor:colors.border,color:colors.text,fontSize:14}]}/></View><View style={{width:125}}><FieldLabel text="REVISIONS" small/><TextInput value={gigRevisions} onChangeText={setGigRevisions} keyboardType="number-pad" placeholder="e.g. 2" placeholderTextColor={colors.textMuted} style={[styles.titleInput,{borderBottomColor:colors.border,color:colors.text,fontSize:14}]}/></View></View>
        <FieldLabel text="What's included (optional)"/>
        {gigDeliverables.map((value,index)=><View key={index} style={styles.dynamicRow}><TextInput value={value} onChangeText={text=>setGigDeliverables(items=>items.map((item,i)=>i===index?text:item))} placeholder="e.g. Source files included" placeholderTextColor={colors.textMuted} style={[...inputStyle,{flex:1}]}/><Pressable onPress={()=>setGigDeliverables(items=>items.filter((_,i)=>i!==index))}><Icon name="x" size={19} color={colors.textMuted}/></Pressable></View>)}
        <Pressable onPress={()=>setGigDeliverables(items=>[...items,""])} style={styles.addAction}><Icon name="plus" size={15} color={colors.accent}/><Text color="accent" style={styles.addText}>Add item</Text></Pressable>
        <FieldLabel text="FAQ (optional — head off the questions before they're asked)"/>
        {gigFaq.map((item,index)=><View key={index} style={[styles.faqCard,{borderColor:colors.border}]}><View style={styles.dynamicRow}><TextInput value={item.question} onChangeText={text=>setGigFaq(items=>items.map((entry,i)=>i===index?{...entry,question:text}:entry))} placeholder="Question" placeholderTextColor={colors.textMuted} style={[...inputStyle,{flex:1,backgroundColor:colors.surface}]}/><Pressable onPress={()=>setGigFaq(items=>items.filter((_,i)=>i!==index))}><Icon name="x" size={19} color={colors.textMuted}/></Pressable></View><TextInput value={item.answer} onChangeText={text=>setGigFaq(items=>items.map((entry,i)=>i===index?{...entry,answer:text}:entry))} placeholder="Answer" placeholderTextColor={colors.textMuted} multiline style={[...inputStyle,{minHeight:70,backgroundColor:colors.surface}]}/></View>)}
        <Pressable onPress={()=>setGigFaq(items=>[...items,{question:"",answer:""}])} style={styles.addAction}><Icon name="plus" size={15} color={colors.accent}/><Text color="accent" style={styles.addText}>Add question</Text></Pressable>
        <FieldLabel text="Work samples (optional, up to 6)"/>
        {!gigSamples.data?.length?<View style={[styles.emptySamples,{borderColor:colors.border,backgroundColor:colors.surface}]}><Text variant="caption" color="muted">You don&apos;t have any other projects yet to show as samples — you can add these later from Edit.</Text></View>:gigSamples.data.map(sample=>{const selected=gigSampleIds.includes(sample.id);const disabled=!selected&&gigSampleIds.length>=6;return <Pressable key={sample.id} disabled={disabled} onPress={()=>setGigSampleIds(ids=>selected?ids.filter(id=>id!==sample.id):[...ids,sample.id])} style={[styles.sampleRow,{borderColor:selected?colors.accent:colors.border,backgroundColor:selected?colors.accentSoft:colors.background},disabled&&styles.disabled]}>{sample.thumbnail_url?<Image source={{uri:sample.thumbnail_url}} style={styles.sampleImage}/>:<View style={[styles.sampleImage,{backgroundColor:colors.surface,alignItems:"center",justifyContent:"center"}]}><Icon name="image" size={17} color={colors.textMuted}/></View>}<View style={{flex:1}}><Text numberOfLines={1}>{sample.title}</Text><Text variant="caption" color="muted">{LABELS[sample.project_type]}</Text></View>{selected&&<Icon name="check" size={18} color={colors.accent}/>}</Pressable>})}
        <Text variant="caption" color="muted" style={styles.hint}>Pick from your own projects to show as proof of work on this gig.</Text>
      </>}

      {type === "media" && <>
        <FieldLabel text="What's included (pick one or more)"/>
        <View style={styles.mediaToggles}>{(["audio","video","image"] as MediaKey[]).map(key=>{const active=mediaChannels[key].enabled;const icon=key==="audio"?"music":key==="video"?"video":"image";return <Pressable key={key} onPress={()=>setMediaChannels(current=>({...current,[key]:{...current[key],enabled:!active}}))} style={[styles.mediaToggle,{borderColor:active?colors.accent:colors.border,backgroundColor:active?colors.accent:colors.surface}]}><Icon name={icon} size={16} color={active?colors.onAccent:colors.textMuted}/><Text style={{fontSize:14,fontWeight:"600",color:active?colors.onAccent:colors.textMuted}}>{key[0].toUpperCase()+key.slice(1)}</Text></Pressable>})}</View>
        {!mediaChannels.audio.enabled&&!mediaChannels.video.enabled&&!mediaChannels.image.enabled&&<Text variant="caption" color="muted" style={styles.hint}>Turn on Audio, Video, Image, or any combination to continue.</Text>}
        {(["audio","video","image"] as MediaKey[]).filter(key=>mediaChannels[key].enabled).map(key=>{const channel=mediaChannels[key];const label=key==="image"?"Upload the image":"Upload a preview clip";const note=key==="image"?"Displayed in full here — visitors with access can download it or copy a link to it.":`Plays right here as a ~30-second preview — not the full ${key}.`;return <View key={key} style={[styles.mediaChannel,{borderLeftColor:colors.border}]}><FieldLabel text={label}/><Pressable onPress={()=>void chooseMediaFile(key)} style={inputStyle}><View style={styles.fileLabel}><Icon name="file-up" size={18} color={colors.textMuted}/><Text color="secondary" numberOfLines={1}>{fileUpload.isPending?"Uploading…":channel.name??(channel.path?"File uploaded — tap to replace":"Choose file")}</Text></View></Pressable>{channel.path&&<Pressable onPress={()=>setMediaChannels(current=>({...current,[key]:{...current[key],path:null,name:null}}))} style={styles.removeUpload}><Text color="danger" style={styles.addText}>Remove upload</Text></Pressable>}<Text variant="caption" color="muted" style={styles.hint}>{note}</Text>{key!=="image"&&<><FieldLabel text={`Link to the full ${key}${key==="audio"?" (Spotify, Apple Music, etc.)":" (YouTube, Vimeo, etc.)"}`}/><TextInput value={channel.url} onChangeText={value=>setMediaChannels(current=>({...current,[key]:{...current[key],url:value}}))} placeholder={key==="audio"?"https://open.spotify.com/...":"https://youtube.com/..."} placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="url" style={inputStyle}/></>}</View>})}
      </>}

      {type !== "pitch" && <><FieldLabel text={type==="gig"?"Booking fee (USD, optional)":"Price (USD)"}/><TextInput value={price} onChangeText={setPrice} editable={!(type==="book"&&!bookOwnWork)} keyboardType="decimal-pad" style={[...inputStyle,type==="book"&&!bookOwnWork&&styles.disabled]}/><Text variant="caption" color="muted" style={styles.hint}>{type==="book"&&!bookOwnWork?"Crediting someone else's work — this has to stay free.":"Set to 0 for a free project."}</Text>{!(type==="book"&&!bookOwnWork)&&<><Pressable onPress={()=>{setPromoEnabled(v=>!v);if(promoEnabled)setPromo("")}} style={styles.checkboxRow}><View style={[styles.checkbox,{borderColor:colors.border,backgroundColor:promoEnabled?colors.accent:"transparent"}]}>{promoEnabled&&<Icon name="check" size={13} color={colors.onAccent}/>}</View><Text style={styles.label} color="muted">Add a promo price</Text></Pressable>{promoEnabled&&<TextInput value={promo} onChangeText={setPromo} keyboardType="decimal-pad" placeholder="Promo price" placeholderTextColor={colors.textMuted} style={inputStyle}/>}</>}</>}

      <View style={[styles.privacy,{backgroundColor:colors.surface}]}><Icon name="eye-off" size={21} color={colors.textMuted}/><View style={styles.privacyCopy}><Text style={styles.label}>Private project</Text><Text variant="caption" color="muted">Not listed anywhere, and not open to anyone by link — only people you add can see or open it.</Text></View><Switch value={isPrivate} onValueChange={setIsPrivate} trackColor={{false:colors.border,true:colors.accent}}/></View>
      {!!error&&<Text color="danger" accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <Pressable disabled={create.isPending||thumbnailUpload.isPending||fileUpload.isPending} onPress={()=>void submit()} style={[styles.publish,{backgroundColor:colors.accent},create.isPending&&styles.disabled]}><Text style={{color:colors.onAccent,fontWeight:"600"}}>{create.isPending?"Publishing…":type==="course"||(type==="book"&&bookSource==="authored")?"Create draft":type==="pitch"?"Publish pitch":"Publish project"}</Text></Pressable>
    </ScrollView>
    <Modal visible={typeMenu} transparent animationType="fade" onRequestClose={()=>setTypeMenu(false)}><Pressable style={[styles.modalBackdrop,{backgroundColor:colors.overlay}]} onPress={()=>setTypeMenu(false)}><View style={[styles.typeSheet,{backgroundColor:colors.surface}]}>{allowedTypes.map(option=><Pressable key={option} onPress={()=>{setType(option);setTypeMenu(false)}} style={styles.typeOption}><Text style={styles.label} color={option===type?"accent":"primary"}>{LABELS[option]}</Text>{option===type&&<Icon name="check" size={19} color={colors.accent}/>}</Pressable>)}</View></Pressable></Modal>
    <Modal visible={gigRoleMenu} transparent animationType="fade" onRequestClose={()=>setGigRoleMenu(false)}><View style={[styles.modalBackdrop,{backgroundColor:colors.overlay}]}><Pressable style={StyleSheet.absoluteFill} onPress={()=>setGigRoleMenu(false)}/><View style={[styles.roleSheet,{backgroundColor:colors.surface}]}><Text style={styles.sheetTitle}>Professional role</Text><ScrollView>{gigRoles.data?.map((role,index)=><View key={role.id}>{index===0||gigRoles.data?.[index-1]?.category!==role.category?<Text variant="caption" color="muted" style={styles.roleCategory}>{role.category}</Text>:null}<Pressable onPress={()=>{setGigRoleId(role.id);setGigRoleMenu(false)}} style={styles.typeOption}><Text>{role.label}</Text>{role.id===gigRoleId&&<Icon name="check" size={19} color={colors.accent}/>}</Pressable></View>)}</ScrollView></View></View></Modal>
  </SafeAreaView>;
}

function FieldLabel({text,small=false}:{text:string;small?:boolean}) { return <Text style={[styles.fieldLabel,small&&styles.smallLabel]} color="muted">{text}</Text>; }
function ChoiceButton({label,selected,onPress,colors}:{label:string;selected:boolean;onPress:()=>void;colors:ThemeColors}) { return <Pressable onPress={onPress} style={[styles.choiceButton,{borderColor:selected?colors.accent:colors.border,backgroundColor:selected?colors.accentSoft:colors.background}]}><Text style={styles.choiceText} color={selected?"primary":"secondary"}>{label}</Text></Pressable>; }
function RadioCard({label,hint,selected,onPress,colors}:{label:string;hint:string;selected:boolean;onPress:()=>void;colors:ThemeColors}) { return <Pressable onPress={onPress} style={[styles.radioCard,{borderColor:selected?colors.accent:colors.border,backgroundColor:selected?colors.accentSoft:colors.background}]}><Icon name={selected?"check-circle-2":"circle"} size={17} color={selected?colors.accent:colors.textMuted}/><View style={{flex:1}}><Text style={styles.label}>{label}</Text><Text variant="caption" color="muted">{hint}</Text></View></Pressable>; }
function CheckRow({label,checked,onPress,colors}:{label:string;checked:boolean;onPress:()=>void;colors:ThemeColors}) { return <Pressable onPress={onPress} style={styles.checkboxRow}><View style={[styles.checkbox,{borderColor:colors.border,backgroundColor:checked?colors.accent:"transparent"}]}>{checked&&<Icon name="check" size={13} color={colors.onAccent}/>}</View><Text style={styles.label}>{label}</Text></Pressable>; }
const styles=StyleSheet.create({safe:{flex:1},content:{paddingHorizontal:16,paddingTop:12,paddingBottom:40},back:{width:36,height:36,justifyContent:"center",marginBottom:6},pageTitle:{fontFamily:Platform.select({ios:"Georgia",android:"serif"}),fontSize:24,lineHeight:31,marginBottom:20},thumbnail:{width:"100%",aspectRatio:16/9,borderWidth:1,borderRadius:12,overflow:"hidden",alignItems:"center",justifyContent:"center",marginBottom:16},thumbnailImage:{width:"100%",height:"100%"},thumbnailEmpty:{alignItems:"center",gap:6},identity:{flexDirection:"row",alignItems:"center",gap:8,marginBottom:16},identityText:{fontSize:14,flex:1},identityName:{fontWeight:"600"},fieldLabel:{fontSize:14,lineHeight:20,fontWeight:"500",marginBottom:6,marginTop:14},smallLabel:{fontSize:11,letterSpacing:1.2,fontWeight:"700"},titleInput:{fontSize:18,minHeight:48,borderBottomWidth:1,paddingHorizontal:0},input:{minHeight:48,borderWidth:1,borderRadius:12,paddingHorizontal:16,flexDirection:"row",alignItems:"center",justifyContent:"space-between",fontSize:16},hint:{marginTop:6},formatBar:{height:32,flexDirection:"row",alignItems:"center",gap:20,paddingHorizontal:6},description:{minHeight:96,paddingTop:12},counter:{marginTop:6},row:{minHeight:44,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},label:{fontSize:14,lineHeight:20,fontWeight:"600"},topicCount:{marginVertical:8},category:{borderBottomWidth:StyleSheet.hairlineWidth},pills:{flexDirection:"row",flexWrap:"wrap",gap:8,paddingBottom:12},pill:{paddingHorizontal:12,paddingVertical:6,borderWidth:1,borderRadius:999},fileLabel:{flex:1,flexDirection:"row",alignItems:"center",gap:9},segmentRow:{flexDirection:"row",gap:8},choiceButton:{flex:1,minHeight:42,borderWidth:1,borderRadius:12,alignItems:"center",justifyContent:"center",paddingHorizontal:10},choiceText:{fontSize:14,fontWeight:"600",textAlign:"center"},sourceList:{gap:8},radioCard:{minHeight:74,borderWidth:1,borderRadius:12,paddingHorizontal:14,paddingVertical:11,flexDirection:"row",alignItems:"flex-start",gap:10},authoredNotice:{marginTop:14,borderRadius:12,padding:14,flexDirection:"row",alignItems:"flex-start",gap:9},twoColumns:{flexDirection:"row",gap:12},dynamicRow:{flexDirection:"row",alignItems:"center",gap:8,marginBottom:8},addAction:{minHeight:34,flexDirection:"row",alignItems:"center",gap:4,alignSelf:"flex-start"},addText:{fontSize:12,fontWeight:"600"},faqCard:{borderWidth:1,borderRadius:10,padding:10,marginBottom:8},emptySamples:{borderWidth:1,borderRadius:12,padding:14},sampleRow:{minHeight:58,borderWidth:1,borderRadius:12,paddingHorizontal:10,paddingVertical:8,flexDirection:"row",alignItems:"center",gap:10,marginBottom:8},sampleImage:{width:40,height:40,borderRadius:8},mediaToggles:{flexDirection:"row",gap:8},mediaToggle:{flex:1,minHeight:42,borderWidth:1,borderRadius:12,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:6},mediaChannel:{marginTop:12,borderLeftWidth:2,paddingLeft:12},removeUpload:{minHeight:28,justifyContent:"center",alignSelf:"flex-start"},checkboxRow:{flexDirection:"row",alignItems:"center",gap:9,minHeight:44},checkbox:{width:18,height:18,borderRadius:3,borderWidth:1,alignItems:"center",justifyContent:"center"},privacy:{marginTop:18,borderRadius:12,padding:14,flexDirection:"row",alignItems:"center",gap:12},privacyCopy:{flex:1,gap:2},error:{marginTop:14},publish:{height:48,borderRadius:12,alignItems:"center",justifyContent:"center",marginTop:24},disabled:{opacity:.45},modalBackdrop:{flex:1,justifyContent:"flex-end"},typeSheet:{paddingHorizontal:16,paddingTop:14,paddingBottom:32,borderTopLeftRadius:28,borderTopRightRadius:28},roleSheet:{maxHeight:"78%",paddingHorizontal:16,paddingTop:18,paddingBottom:28,borderTopLeftRadius:28,borderTopRightRadius:28},sheetTitle:{fontSize:20,fontWeight:"700",marginBottom:10},roleCategory:{marginTop:12,marginBottom:2,textTransform:"uppercase",letterSpacing:1},typeOption:{minHeight:48,flexDirection:"row",alignItems:"center",justifyContent:"space-between"}});
