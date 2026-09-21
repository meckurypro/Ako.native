import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { Easing, type SharedValue, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

const SPARKS = [[0, -17], [15, -8], [15, 8], [0, 17], [-15, 8], [-15, -8]];
export function LikeHeart({ active, color }: { active: boolean; color: string }) {
  const scale = useSharedValue(1); const burst = useSharedValue(0);
  useEffect(() => { if (!active) return; scale.value = withSequence(withTiming(1.32, { duration: 133, easing: Easing.out(Easing.ease) }), withTiming(.94, { duration: 95 }), withTiming(1, { duration: 152 })); burst.value = 0; burst.value = withTiming(1, { duration: 480, easing: Easing.out(Easing.ease) }); }, [active, burst, scale]);
  const heart = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <View style={s.root}><Animated.View style={heart}><MaterialCommunityIcons name={active ? "heart" : "heart-outline"} size={24} color={color} /></Animated.View>{active && SPARKS.map(([x, y], i) => <Spark key={i} x={x} y={y} progress={burst} color={color} />)}</View>;
}
function Spark({ x, y, progress, color }: { x: number; y: number; progress: SharedValue<number>; color: string }) { const style = useAnimatedStyle(() => ({ opacity: 1 - progress.value, transform: [{ translateX: x * progress.value }, { translateY: y * progress.value }, { scale: 1 - progress.value }] })); return <Animated.View style={[s.spark, { backgroundColor: color }, style]} />; }
const s = StyleSheet.create({ root: { width: 28, height: 28, alignItems: "center", justifyContent: "center" }, spark: { position: "absolute", width: 5, height: 5, borderRadius: 99 } });
