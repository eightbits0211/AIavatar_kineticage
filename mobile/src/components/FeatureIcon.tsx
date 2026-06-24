import Svg, { Path, Circle } from 'react-native-svg';

export type FeatureIconName = 'coaching' | 'progress' | 'goals' | 'achievements';

interface FeatureIconProps {
  name: FeatureIconName;
  size?: number;
  color?: string;
}

/** Line icons for the welcome screen feature cards. */
export default function FeatureIcon({ name, size = 20, color = '#4A90C2' }: FeatureIconProps) {
  const stroke = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  switch (name) {
    case 'coaching':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M5 4h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 4V6a2 2 0 0 1 2-2z" {...stroke} />
          <Circle cx={9.5} cy={9.5} r={1} fill={color} stroke={color} />
          <Circle cx={14.5} cy={9.5} r={1} fill={color} stroke={color} />
        </Svg>
      );
    case 'progress':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M4 16L9 11L12 14L19 7" {...stroke} />
          <Path d="M15 7H19V11" {...stroke} />
        </Svg>
      );
    case 'goals':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={8.5} {...stroke} />
          <Circle cx={12} cy={12} r={4.5} {...stroke} />
          <Circle cx={12} cy={12} r={1} fill={color} stroke={color} />
        </Svg>
      );
    case 'achievements':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M7 4H17V8A5 5 0 0 1 7 8Z" {...stroke} />
          <Path d="M7 5H4V7A3 3 0 0 0 7 9" {...stroke} />
          <Path d="M17 5H20V7A3 3 0 0 1 17 9" {...stroke} />
          <Path d="M12 13V17" {...stroke} />
          <Path d="M9 20H15M10.5 20V17H13.5V20" {...stroke} />
        </Svg>
      );
    default:
      return null;
  }
}
