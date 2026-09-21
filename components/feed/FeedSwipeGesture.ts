import { createContext, useContext } from "react";
import { Gesture } from "react-native-gesture-handler";

export const FeedSwipeGestureContext = createContext<ReturnType<typeof Gesture.Pan> | null>(null);
export const useFeedSwipeGesture = () => useContext(FeedSwipeGestureContext);
