import { View } from "react-native";
import { Card } from "@/components/core";
import { Skeleton } from "@/components/feedback";
export function FeedSkeleton(){return <View style={{gap:10}}>{[0,1,2].map(item=><Card key={item} style={{borderRadius:0,gap:14}}><View style={{flexDirection:"row",gap:12}}><Skeleton width={44} height={44} radius={22}/><View style={{flex:1,gap:7}}><Skeleton width="44%"/><Skeleton width="28%" height={12}/></View></View><Skeleton/><Skeleton width="88%"/><Skeleton height={180} radius={14}/></Card>)}</View>}
