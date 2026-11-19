import { Children, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { space } from "@/theme/tokens";

// Two (at most three) Buttons side by side, sharing the width equally. Use it where a pair of
// actions belong together (Pause | Finish, Decline | Approve) so they take one row of thumb space.
export function ButtonRow({ children }: { children: ReactNode }) {
  return (
    <View style={styles.row}>
      {Children.toArray(children).map((child, i) => (
        <View key={i} style={styles.cell}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.sm },
  cell: { flex: 1 },
});
