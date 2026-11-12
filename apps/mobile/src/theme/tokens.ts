// Single source of visual tokens for the app. Placeholder values until the designer's Figma file
// arrives; screens must use these instead of one-off colors and sizes so the swap is one file.
export const palette = {
  light: {
    background: "#F7F7F5",
    surface: "#FFFFFF",
    text: "#141414",
    textMuted: "#5C5F66",
    border: "#D9DADC",
    accent: "#1F6F4A",
    onAccent: "#FFFFFF",
    danger: "#B3261E",
  },
  dark: {
    background: "#0F1011",
    surface: "#1A1B1D",
    text: "#F2F2F0",
    textMuted: "#A3A6AD",
    border: "#2E3033",
    accent: "#4FBF8A",
    onAccent: "#0F1011",
    danger: "#F2B8B5",
  },
} as const;

export type Palette = { [K in keyof (typeof palette)["light"]]: string };

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { md: 12, lg: 16 } as const;
export const type = {
  title: { fontSize: 32, lineHeight: 38, fontWeight: "700" },
  body: { fontSize: 17, lineHeight: 24, fontWeight: "400" },
  metric: { fontSize: 24, lineHeight: 30, fontWeight: "600" },
  label: { fontSize: 15, lineHeight: 20, fontWeight: "600" },
  small: { fontSize: 14, lineHeight: 20, fontWeight: "400" },
} as const;
// Apple's minimum comfortable tap target.
export const minTouch = 48;
