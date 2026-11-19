import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { elevationStyle, useTheme } from "@/theme/theme";
import { radius } from "@/theme/tokens";

type RowProps = { divider?: boolean; inset?: boolean };

// A raised group of ListRows, like an iOS inset-grouped list. Rows run edge to edge inside it (so a
// pressed row fills the width), and the last row's divider is removed automatically, so rows can be
// added or hidden conditionally without touching their neighbours.
export function ListGroup({ children }: { children: ReactNode }) {
  const t = useTheme();
  const rows = Children.toArray(children).filter(isValidElement) as ReactElement<RowProps>[];
  // The shadow sits on the outer view; the inner one clips pressed rows to the rounded corners
  // (clipping on the same view would also clip the shadow).
  return (
    <View style={[styles.shape, { backgroundColor: t.color.surface }, elevationStyle(t.elevation.raised, t.color)]}>
      <View style={[styles.shape, styles.clip]}>
        {rows.map((row, i) => cloneElement(row, { inset: true, divider: i < rows.length - 1 && row.props.divider !== false }))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shape: { borderRadius: radius.lg, borderCurve: "continuous" },
  clip: { overflow: "hidden" },
});
