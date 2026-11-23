import { Stack } from "expo-router";
import { useStackOptions } from "@/theme/navigation";

// A tab's own stack, so its screen gets the native header (title, header buttons).
export default function TabStackLayout() {
  return <Stack screenOptions={useStackOptions()} />;
}
