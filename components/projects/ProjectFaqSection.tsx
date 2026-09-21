// File: components/projects/ProjectFaqSection.tsx
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Icon, Text } from "@/components/core";
import { useProjectFaqs } from "@/features/projects/api";
import { useTheme } from "@/providers/ThemeProvider";

// Collapsed-by-default FAQ accordion. Shared by the project FAQ (project_faqs) and a gig's own FAQ (project_gig_details.faq).
export function FaqList({ items }: { items: { question: string; answer: string }[] }) {
  const { colors, radii } = useTheme();
  const [open, setOpen] = useState<number | null>(null);
  if (!items.length) return null;
  return (
    <View style={{ marginBottom: 16 }}>
      <Text variant="heading" style={{ marginBottom: 8 }}>FAQ</Text>
      <View style={{ gap: 8 }}>
        {items.map((item, index) => (
          <View key={index} style={{ borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: "hidden" }}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: open === index }} onPress={() => setOpen(open === index ? null : index)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
              <Text variant="label" style={{ flex: 1 }}>{item.question}</Text>
              <Icon name={open === index ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
            </Pressable>
            {open === index ? <Text color="secondary" style={{ paddingHorizontal: 16, paddingBottom: 14 }}>{item.answer}</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

// Visitor view of web's ProjectFaqSection. Editing FAQs is owner-side and stays on web for now.
export function ProjectFaqSection({ projectId }: { projectId: string }) {
  const faqs = useProjectFaqs(projectId);
  return <FaqList items={faqs.data ?? []} />;
}
