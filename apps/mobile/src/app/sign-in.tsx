import { router, Stack } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { T } from "@/components/screen-text";
import { AuthForm } from "@/features/auth/auth-form";
import { space } from "@/theme/tokens";

// For members coming back. New people start with onboarding, which creates the account near its end.
export default function SignInScreen() {
  return (
    <Screen
      header
      footer={
        <Button
          variant="ghost"
          label="New to Squad Six? Get started"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/onboarding"))}
        />
      }
    >
      <Stack.Screen options={{ headerShown: true, title: "" }} />
      <View style={styles.header}>
        <T variant="title" accessibilityRole="header">
          Welcome back
        </T>
        <T tone="textMuted">Sign in to see your squad.</T>
      </View>
      <AuthForm initialMode="sign-in" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.sm },
});
