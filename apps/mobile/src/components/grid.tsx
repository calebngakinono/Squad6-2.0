import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { space } from "@/theme/tokens";

// Two-column wrapping layout for Tiles or Stats. Children set their own basis (Tile does; StatCell
// below wraps a Stat). An odd last item stretches to the full width.
export function Grid({ children, gap = "sm" }: { children: ReactNode; gap?: "sm" | "lg" }) {
  return <View style={[styles.grid, { gap: gap === "lg" ? space.lg : space.sm }]}>{children}</View>;
}

/** A cell in a Grid for content that does not size itself (a Stat). */
export function GridCell({ children }: { children: ReactNode }) {
  return <View style={styles.cell}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { flexBasis: "40%", flexGrow: 1 },
});
