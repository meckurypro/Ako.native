import { Alert, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Avatar, Button, Text } from "@/components/core";
import { useAuth } from "@/providers/AuthProvider";
import { useAvatarUpload } from "@/features/profile/useAvatarUpload";
import { friendlyAuthError } from "@/features/auth/validation";
import { ensurePermission } from "@/lib/permissions";
export function AvatarPicker(){const{profile}=useAuth();const upload=useAvatarUpload();const choose=async(source:"camera"|"library")=>{const granted=await ensurePermission(source==="camera"?"camera":"mediaLibrary");if(!granted)return;const result=source==="camera"?await ImagePicker.launchCameraAsync({mediaTypes:["images"],allowsEditing:true,aspect:[1,1],quality:.9}):await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],allowsEditing:true,aspect:[1,1],quality:.9});if(result.canceled)return;try{await upload.mutateAsync(result.assets[0]);}catch(error){Alert.alert("Couldn't update photo",friendlyAuthError(error,"Choose another image or try again."));}};return <View style={{alignItems:"center",gap:12}}><Avatar uri={profile?.avatar_url} name={profile?.display_name??profile?.username??"AKọ"} size={96}/><View style={{flexDirection:"row",gap:8}}><Button label="Choose photo" variant="secondary" loading={upload.isPending} onPress={()=>void choose("library")} /><Button label="Camera" variant="ghost" disabled={upload.isPending} onPress={()=>void choose("camera")} /></View><Text variant="caption" color="muted">JPEG, PNG, WebP or GIF · 5MB maximum</Text></View>}
