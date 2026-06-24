import Svg, { Circle, Path } from 'react-native-svg';

interface SendIconProps {
  size?: number;
}

/**
 * Exact iOS Messages send button — filled blue circle with a thick,
 * rounded-cap upward arrow centered inside.
 */
export default function SendIcon({ size = 32 }: SendIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Blue filled circle */}
      <Circle cx={16} cy={16} r={16} fill="#007AFF" />
      {/* Upward arrow — thick stroke, rounded caps and joins */}
      <Path
        d="M16 22.5V11M16 11L11 16M16 11L21 16"
        stroke="#FFFFFF"
        strokeWidth={2.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
