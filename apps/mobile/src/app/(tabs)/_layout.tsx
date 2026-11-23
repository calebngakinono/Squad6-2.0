import { NativeTabs } from "expo-router/native-tabs";
import { useTheme } from "@/theme/theme";

// The five places in the app, on the native iOS tab bar (Liquid Glass on iOS 26): sage tint, Overpass
// labels, SF Symbols. Screens that cover the tab bar (live workout, join, settings…) live in the root
// Stack instead.
export default function TabsLayout() {
  const t = useTheme();
  const label = t.text("caption");
  // Our Screen already pads for the safe area (which, inside a tab, includes the tab bar), so the
  // automatic scroll-view insets are turned off to avoid padding twice.
  const shared = { disableAutomaticContentInsets: true, contentStyle: { backgroundColor: t.color.background } } as const;

  return (
    <NativeTabs tintColor={t.color.accent} labelStyle={{ fontFamily: label.fontFamily, fontWeight: label.fontWeight }}>
      <NativeTabs.Trigger name="index" {...shared}>
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="squad" {...shared}>
        <NativeTabs.Trigger.Label>Squad</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "person.3", selected: "person.3.fill" }} md="group" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="standings" {...shared}>
        <NativeTabs.Trigger.Label>Standings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.number" md="leaderboard" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="challenges" {...shared}>
        <NativeTabs.Trigger.Label>Challenges</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "flag", selected: "flag.fill" }} md="flag" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me" {...shared}>
        <NativeTabs.Trigger.Label>Me</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }} md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
