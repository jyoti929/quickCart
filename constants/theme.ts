import { Platform } from "react-native";

/**
 * Cross-platform shadow helper.
 * On web: returns { boxShadow } (React Native Web dropped shadow* props).
 * On native: returns the standard RN shadow* + elevation object.
 *
 * Usage inside StyleSheet.create():
 *   myView: {
 *     ...shadowStyle("#000", 4, 0.1, 8, 4),
 *   }
 */
export function shadowStyle(
  color: string,
  height: number,
  opacity: number,
  radius: number,
  elevation: number = 2,
  width: number = 0
): Record<string, any> {
  if (Platform.OS === "web") {
    // Convert RGBA manually for web boxShadow
    const hex = color.replace("#", "");
    let r = 0, g = 0, b = 0;
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
    return {
      boxShadow: `${width}px ${height}px ${radius}px rgba(${r},${g},${b},${opacity})`,
    };
  }
  return {
    shadowColor: color,
    shadowOffset: { width, height },
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation,
  };
}

export const Theme = {
  colors: {
    background: "#FFFFFF",       // Pure white screen background
    primary: "#2a5d4c",          // Deep teal for primary buttons and links
    primaryLight: "#FFECE8",     // Soft peach tint for alert backgrounds or inputs
    primaryDark: "#1E293B",      // Slate dark for headers, titles, and icons
    white: "#FFFFFF",
    black: "#000000",
    textDark: "#0F172A",         // Slate-900 main text color
    textMedium: "#475569",       // Slate-600 subtitle and labels text color
    textLight: "#94A3B8",        // Slate-400 placeholder text color
    border: "#E2E8F0",           // Slate-200 border color for inputs
    error: "#EF4444",            // Standard error red
    success: "#10B981",          // Cohesive green success
    inputBg: "#F8FAFC",          // Clean slate input background
  },
  // Legacy shadow object kept for backward-compat; prefer shadowStyle() helper
  shadow: {
    ...Platform.select({
      web: { boxShadow: "0px 6px 12px rgba(255,94,58,0.08)" },
      default: {
        shadowColor: "#FF5E3A",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
      },
    }),
  },
};
