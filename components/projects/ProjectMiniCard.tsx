// File: components/projects/ProjectMiniCard.tsx
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Icon, PressableScale, Text } from "@/components/core";
import { PROJECT_TYPE_LABELS, type Project } from "@/features/projects/api";
import { useTheme } from "@/providers/ThemeProvider";
import { fonts } from "@/theme/fonts";

type MiniProject = Pick<Project, "id" | "title" | "thumbnail_url" | "project_type"> & Partial<Pick<Project, "status" | "is_private">>;

// Small square-thumbnail project card used in rails and grids (mirrors web's ProjectMiniCard).
export function ProjectMiniCard({ project, showStatus = false }: { project: MiniProject; showStatus?: boolean }) {
  const router = useRouter();
  const { colors, radii } = useTheme();
  const statusLabel = !showStatus ? null : project.status === "draft" ? "Draft" : project.status === "cancelled" ? "Cancelled" : project.is_private ? "Private" : null;
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={`${project.title}, ${PROJECT_TYPE_LABELS[project.project_type]}`} onPress={() => router.push({ pathname: "/projects/[projectId]", params: { projectId: project.id } })} style={[s.card, { width: 144, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg }]}>
      <View style={[s.thumb, { backgroundColor: colors.background }]}>
        {project.thumbnail_url ? <Image source={{ uri: project.thumbnail_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={160} /> : <Icon name="image" size={24} color={colors.textMuted} />}
        {statusLabel ? <View style={s.status}><Text style={s.statusText}>{statusLabel}</Text></View> : null}
      </View>
      <View style={s.copy}>
        <Text numberOfLines={1} style={s.title}>{project.title}</Text>
        <Text color="secondary" style={s.type}>{PROJECT_TYPE_LABELS[project.project_type]}</Text>
      </View>
    </PressableScale>
  );
}

// Horizontal rail of mini cards; renders nothing for an empty list.
export function ProjectRail({ title, projects }: { title: string; projects: MiniProject[] }) {
  if (!projects.length) return null;
  return (
    <View style={{ marginTop: 28 }}>
      <Text variant="heading" style={{ marginBottom: 12 }}>{title}</Text>
      <View style={s.rail}>{projects.map(project => <ProjectMiniCard key={project.id} project={project} />)}</View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  thumb: { width: "100%", aspectRatio: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  status: { position: "absolute", top: 8, left: 8, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { color: "#fff", fontSize: 11, lineHeight: 15, fontFamily: fonts.body.semibold },
  copy: { padding: 12 },
  title: { fontSize: 14, lineHeight: 19, fontFamily: fonts.body.semibold },
  type: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  rail: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
});
