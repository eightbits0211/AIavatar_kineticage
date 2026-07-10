export const colors = {
  primary: '#4A90C2',        // Blue from the design
  primaryLight: '#6BA3D0',
  primaryDark: '#3A7CA8',
  secondary: '#F5A623',      // Orange for avatar
  background: '#000000',     // Black background (dark trial — was #E8F0F8)
  surface: '#1C1C1E',        // Dark grey cards/surfaces (dark trial — was #FFFFFF)
  text: '#FFFFFF',          // White text (dark theme)
  textSecondary: '#AEAEB2',  // Light gray secondary label
  textLight: '#8E8E93',     // Mid gray placeholder
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  border: '#2C2C2E',        // Dark divider/border
  companionBubble: '#242426', // Grey for Kin messages (slightly darker)
  userBubble: '#4A90C2',      // Blue for user messages
  shadow: 'rgba(0, 0, 0, 0.1)', // Subtle shadows
  progressBar: 'rgba(255, 255, 255, 0.3)', // Progress bar background
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  h1: { fontSize: 28, fontFamily: 'Inter_700Bold', lineHeight: 34 },
  h2: { fontSize: 22, fontFamily: 'Inter_600SemiBold', lineHeight: 28 },
  h3: { fontSize: 18, fontFamily: 'Inter_600SemiBold', lineHeight: 24 },
  body: { fontSize: 16, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  bodyBold: { fontSize: 16, fontFamily: 'Inter_600SemiBold', lineHeight: 22 },
  caption: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  small: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 16 },
};

/**
 * Returns a color with the given alpha. Accepts a 6-digit hex (#RRGGBB) and
 * converts to rgba(); any other format (already rgb/rgba) is returned as-is.
 * Handy for deriving subtle translucent tints from an accent color on dark UI.
 */
export const withAlpha = (color: string, alpha: number): string => {
  if (!color.startsWith('#') || color.length < 7) return color;
  const n = parseInt(color.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};
