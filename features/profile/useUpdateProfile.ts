import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
export function useUpdateProfile(){const{user,refreshProfile}=useAuth();return useMutation({mutationFn:async(input:{display_name:string;bio:string|null})=>{if(!user)throw new Error("Not signed in");const{error}=await supabase.from("profiles").update(input).eq("id",user.id);if(error)throw error;await refreshProfile();}});}
