import { useState } from "react";
import { useRouter } from "expo-router";
import { AvatarPicker } from "@/components/profile/AvatarPicker";
import { Button, Input, Screen, Text } from "@/components/core";
import { useAuth } from "@/providers/AuthProvider";
import { useUpdateProfile } from "@/features/profile/useUpdateProfile";
import { friendlyAuthError } from "@/features/auth/validation";
export default function EditProfile(){const router=useRouter();const{profile}=useAuth();const update=useUpdateProfile();const[name,setName]=useState(()=>profile?.display_name??"");const[bio,setBio]=useState(()=>profile?.bio??"");const[error,setError]=useState<string|null>(null);const save=async()=>{if(!name.trim()){setError("Display name is required.");return;}setError(null);try{await update.mutateAsync({display_name:name.trim(),bio:bio.trim()||null});router.back();}catch(err){setError(friendlyAuthError(err,"Couldn’t update your profile."));}};return <Screen><Text variant="title" style={{marginTop:12}}>Edit profile</Text><Text color="secondary" style={{marginTop:4}}>Changes appear on web and mobile.</Text><AvatarPicker/><Input label="Display name" value={name} onChangeText={setName} maxLength={80}/><Input label="Bio" value={bio} onChangeText={setBio} multiline maxLength={300} style={{minHeight:90,textAlignVertical:"top"}}/>{error&&<Text variant="caption" color="danger">{error}</Text>}<Button label="Save profile" loading={update.isPending} onPress={()=>void save()}/><Button label="Cancel" variant="ghost" onPress={()=>router.back()}/></Screen>}
