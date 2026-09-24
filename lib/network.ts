// File: lib/network.ts
import { createContext, createElement, useContext, useEffect, useState, type PropsWithChildren } from "react";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { env } from "./env";

// NetInfo's default reachability probe is a Google endpoint. What matters to this app is whether
// Ako's own backend answers, so probe that: any HTTP response below 500 means it is reachable.
// (Wi-Fi with no data and captive portals then read as offline; so does a blocked Google.)
NetInfo.configure({
  reachabilityUrl: `${env.supabaseUrl}/auth/v1/health`,
  reachabilityMethod: "GET",
  reachabilityTest: async (response) => response.status > 0 && response.status < 500,
  reachabilityShortTimeout: 5 * 1000,
  reachabilityLongTimeout: 30 * 1000,
  reachabilityRequestTimeout: 15 * 1000,
});

export type NetworkStatus = { isConnected: boolean; isInternetReachable: boolean | null };

const NetworkContext = createContext<NetworkStatus>({ isConnected: true, isInternetReachable: true });

function toStatus(state: NetInfoState): NetworkStatus {
  return { isConnected: state.isConnected ?? true, isInternetReachable: state.isInternetReachable };
}

export function isOfflineStatus(status: NetworkStatus) {
  return status.isConnected === false || status.isInternetReachable === false;
}

export function NetworkProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<NetworkStatus>({ isConnected: true, isInternetReachable: true });

  useEffect(() => {
    void NetInfo.fetch().then((state) => setStatus(toStatus(state)));
    return NetInfo.addEventListener((state) => setStatus(toStatus(state)));
  }, []);

  return createElement(NetworkContext.Provider, { value: status }, children);
}

/** Treats "unknown" reachability as online, so platforms/simulators that can't reliably report it don't trigger a false offline banner. */
export function useNetworkStatus() {
  const status = useContext(NetworkContext);
  return { ...status, isOffline: isOfflineStatus(status) };
}

/** Fires `callback` on each offline -> online transition. Returns an unsubscribe function. */
export function onNetworkReconnect(callback: () => void) {
  let wasOffline = false;
  return NetInfo.addEventListener((state) => {
    const offline = isOfflineStatus(toStatus(state));
    if (wasOffline && !offline) callback();
    wasOffline = offline;
  });
}

/** Re-runs the reachability probe now (used by the "Try again" button on offline screens). */
export async function refreshNetworkStatus(): Promise<void> {
  await NetInfo.refresh().catch(() => undefined);
}

/** One-shot check, for call sites that just need to know "can I hit the network right now?" without subscribing. */
export async function isCurrentlyOffline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return isOfflineStatus(toStatus(state));
}
