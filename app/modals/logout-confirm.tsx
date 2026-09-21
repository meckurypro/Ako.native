import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Text } from "@/components/core";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { friendlyAuthError } from "@/features/auth/validation";
export default function LogoutConfirm(){const router=useRouter();const{signOut}=useAuth();const{colors,radii}=useTheme();const[loading,setLoading]=useState(false);const[error,setError]=useState<string|null>(null);const confirm=async()=>{setLoading(true);setError(null);try{await signOut();}catch(err){setError(friendlyAuthError(err,"Couldn’t sign out. Check your connection and try again."));setLoading(false);}};return <View style={[styles.root,{backgroundColor:colors.overlay}]}><Pressable style={StyleSheet.absoluteFill} onPress={()=>router.back()} accessibilityLabel="Cancel logout"/><View style={[styles.card,{backgroundColor:colors.surface,borderColor:colors.border,borderRadius:radii.xl}]}><Text variant="title">Sign out?</Text><Text color="secondary">Your account will remain available on AKọ. This device’s session will be removed.</Text>{error&&<Text variant="caption" color="danger">{error}</Text>}<Button label="Sign out" variant="danger" loading={loading} onPress={()=>void confirm()} /><Button label="Cancel" variant="ghost" disabled={loading} onPress={()=>router.back()} /></View></View>};const styles=StyleSheet.create({root:{flex:1,justifyContent:"center",padding:24},card:{borderWidth:1,padding:20,gap:14}});
