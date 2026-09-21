import { View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Screen, Text } from "@/components/core";
import { EmptyState, ErrorState, Skeleton } from "@/components/feedback";
import { PersonRow } from "@/components/onboarding/PersonRow";
import { useRecommendations } from "@/features/onboarding/api";
export default function People(){const router=useRouter();const recommendations=useRecommendations();return <Screen><Text variant="caption" color="accent">STEP 2 OF 2</Text><Text variant="title" style={{marginTop:6}}>Find your people</Text><Text color="secondary" style={{marginTop:7}}>A short list based on your interests. Following someone is optional.</Text><View style={{gap:12,marginTop:24}}>{recommendations.isLoading?<><Skeleton height={76}/><Skeleton height={76}/><Skeleton height={76}/></>:recommendations.isError?<ErrorState message="Couldn't load suggestions." onRetry={()=>void recommendations.refetch()}/>:recommendations.data?.length?recommendations.data.map(person=><PersonRow key={person.id} person={person}/>):<EmptyState icon="users" title="No suggestions yet" message="You can discover people after setup." />}</View><View style={{marginTop:28}}><Button label="Continue" onPress={()=>router.push("/(onboarding)/complete")} /></View></Screen>}
