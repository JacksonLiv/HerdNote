import { createTheme, type MantineColorsTuple } from "@mantine/core";

/**
 * USF CyberHerd theme — single source of truth for brand colors.
 * Official USF palette: Green #006747, Gold #CFC493, Evergreen #005432,
 * Slate #466069, Soft Black #303434. Dark "security console" by default.
 */

// USF Green scale (index 6 ≈ official #006747).
const usfGreen: MantineColorsTuple = [
  "#e6f4ef",
  "#c6e4d8",
  "#9fd3bd",
  "#73c1a0",
  "#49b086",
  "#1f9a6c",
  "#006747", // USF Green
  "#005a3e",
  "#005432", // Evergreen
  "#003c25",
];

// USF Gold scale (index 4 ≈ official #CFC493).
const usfGold: MantineColorsTuple = [
  "#fbf9ee",
  "#f1ecd3",
  "#e6dcb3",
  "#dacf99",
  "#cfc493", // USF Gold
  "#c2b277",
  "#a89859",
  "#867843",
  "#64592f",
  "#423a1c",
];

export const theme = createTheme({
  primaryColor: "usfGreen",
  primaryShade: { light: 6, dark: 5 },
  colors: {
    usfGreen,
    usfGold,
  },
  fontFamily: "Inter, system-ui, sans-serif",
  fontFamilyMonospace: "ui-monospace, SFMono-Regular, Menlo, monospace",
  defaultRadius: "md",
  headings: { fontWeight: "700" },
});

/** Severity → Mantine color name, mapped onto the USF accent palette. */
export const SEVERITY_COLOR: Record<string, string> = {
  critical: "red",
  high: "orange",
  medium: "yellow",
  low: "usfGold",
  informational: "usfGreen",
};

/** Asset state → color for badges across the app. */
export const ASSET_STATE_COLOR: Record<string, string> = {
  untouched: "gray",
  enumerated: "blue",
  exploited: "orange",
  compromised: "red",
  cleaned: "usfGreen",
};

export const ASSET_STATES = [
  "untouched",
  "enumerated",
  "exploited",
  "compromised",
  "cleaned",
] as const;
