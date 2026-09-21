// File: app/requests.tsx
// Port of web's src/pages/FollowRequests.tsx. Wires up the "Follow
// requests" row in app/(tabs)/profile.tsx's OwnerMenu, which already
// computed the pending-count badge but had the row itself marked
// `active: false` ("Coming later") with nowhere to navigate.
import { useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Avatar, Button, Screen, Text } from "@/components/core";
import { EmptyState, ErrorState } from "@/components/feedback";
import {
  useAcceptFollowRequest,
  useDeclineFollowRequest,
  useIncomingFollowRequests,
  type IncomingFollowRequest,
} from "@/features/discovery/api";

const age = (date: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
};

function RequestRow({ request }: { request: IncomingFollowRequest }) {
  const router = useRouter();
  const accept = useAcceptFollowRequest();
  const decline = useDeclineFollowRequest();
  const args = { id: request.id, requesterId: request.requester.id };
  const pending = accept.isPending || decline.isPending;
  const openProfile = () =>
    router.push({ pathname: "/profiles/[username]", params: { username: request.requester.username } });

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
      <Pressable style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }} onPress={openProfile}>
        <Avatar uri={request.requester.avatar_url} name={request.requester.display_name} />
        <View style={{ flex: 1 }}>
          <Text variant="label" numberOfLines={1}>
            {request.requester.display_name}
          </Text>
          <Text variant="caption" color="secondary" numberOfLines={1}>
            @{request.requester.username} · {age(request.created_at)}
          </Text>
        </View>
      </Pressable>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button label="Decline" variant="secondary" disabled={pending} onPress={() => void decline.mutateAsync(args)} />
        <Button label="Accept" variant="primary" disabled={pending} onPress={() => void accept.mutateAsync(args)} />
      </View>
    </View>
  );
}

export default function FollowRequestsScreen() {
  const router = useRouter();
  const [dismissedError, setDismissedError] = useState(false);
  const requests = useIncomingFollowRequests();

  return (
    <Screen scroll={false}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 }}>
        <Button label="Back" variant="ghost" onPress={() => router.back()} />
        <Text variant="title">Follow requests</Text>
      </View>

      {requests.isError && !dismissedError ? (
        <ErrorState
          message="Couldn't load your requests."
          onRetry={() => {
            setDismissedError(true);
            void requests.refetch();
          }}
        />
      ) : (
        <FlatList
          data={requests.data ?? []}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => <RequestRow request={item} />}
          refreshing={requests.isRefetching}
          onRefresh={() => void requests.refetch()}
          ListEmptyComponent={
            !requests.isLoading ? (
              <EmptyState icon="user-check" title="No requests" message="No pending follow requests." />
            ) : null
          }
        />
      )}
    </Screen>
  );
}
