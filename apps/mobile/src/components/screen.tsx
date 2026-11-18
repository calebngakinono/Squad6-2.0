import { useContext, type ReactElement, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { HeaderHeightContext } from "expo-router/react-navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme";
import { layout, space } from "@/theme/tokens";

type Props = {
  children: ReactNode;
  /**
   * Pinned to the bottom, above the home indicator and the keyboard: the screen's primary action(s),
   * where a thumb reaches them. Usually one or two Buttons.
   */
  footer?: ReactNode;
  /** Set when the screen shows the native navigation header, which already covers the top inset. */
  header?: boolean;
  /** Default true. Set false for screens that manage their own list (FlatList) or must not scroll. */
  scroll?: boolean;
  /** Pull-to-refresh, for scrolling screens. */
  refreshControl?: ReactElement<RefreshControlProps>;
  /** Extra styles for the content area (it already has the gutter and section gap). */
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

// The frame of every screen: background, safe areas, scrolling, keyboard avoidance and a bottom
// action area.
export function Screen({ children, footer, header = false, scroll = true, refreshControl, contentStyle, testID }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  // Undefined outside a navigator. Under a native header the keyboard offset must include it.
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  const content: StyleProp<ViewStyle> = [
    styles.content,
    {
      paddingTop: header ? layout.gutter : insets.top + space.md,
      // Without a footer the content itself has to clear the home indicator.
      paddingBottom: footer ? layout.gutter : insets.bottom + layout.gutter,
      paddingLeft: insets.left + layout.gutter,
      paddingRight: insets.right + layout.gutter,
    },
    contentStyle,
  ];

  return (
    <KeyboardAvoidingView
      testID={testID}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={header ? headerHeight : 0}
      style={[styles.fill, { backgroundColor: t.color.background }]}
    >
      {scroll ? (
        <ScrollView
          style={styles.fill}
          contentContainerStyle={content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, content]}>{children}</View>
      )}
      {footer ? (
        <View
          style={[
            styles.footer,
            {
              backgroundColor: t.color.background,
              borderTopColor: t.color.border,
              paddingBottom: Math.max(insets.bottom, space.md),
              paddingLeft: insets.left + layout.gutter,
              paddingRight: insets.right + layout.gutter,
            },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1, gap: layout.sectionGap },
  footer: { gap: space.sm, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
});
