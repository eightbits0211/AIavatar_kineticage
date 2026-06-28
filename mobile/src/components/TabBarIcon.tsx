import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';

export type TabIconName = 'coach' | 'progress' | 'profile';

interface TabBarIconProps {
  name: TabIconName;
  color: string;
  size?: number;
}

/** Bottom tab-bar icons: AI Coach (robot), Progress (bars), Profile (person). */
export default function TabBarIcon({ name, color, size = 24 }: TabBarIconProps) {
  const stroke = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  switch (name) {
    case 'coach':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x={5} y={8} width={14} height={11} rx={3} {...stroke} />
          <Path d="M12 5V8" {...stroke} />
          <Circle cx={12} cy={4} r={1.5} {...stroke} />
          <Circle cx={9.5} cy={13} r={1} fill={color} stroke={color} />
          <Circle cx={14.5} cy={13} r={1} fill={color} stroke={color} />
          <Path d="M3 12V15M21 12V15" {...stroke} />
        </Svg>
      );
    case 'progress':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Line x1={6} y1={20} x2={6} y2={13} {...stroke} />
          <Line x1={12} y1={20} x2={12} y2={8} {...stroke} />
          <Line x1={18} y1={20} x2={18} y2={4} {...stroke} />
        </Svg>
      );
    case 'profile':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={8} r={4} {...stroke} />
          <Path d="M4 20c0-4 4-6 8-6s8 2 8 6" {...stroke} />
        </Svg>
      );
    default:
      return null;
  }
}
