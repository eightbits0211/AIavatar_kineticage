import Svg, { Path, Line, Circle } from 'react-native-svg';

/** Filled flame for the streak pill. */
export function FlameIcon({ size = 16, color = '#FF7A1A' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 23c4.4 0 8-3.1 8-7.5 0-2.6-1.4-4.9-2.9-6.5-.3 1.1-1.1 1.9-2.1 1.9 1.1-3.6-1.2-7.2-4.2-8.9.4 2.6-.6 5.2-2.3 7C5.3 11.4 4 13 4 15.5 4 19.9 7.6 23 12 23z"
        fill={color}
      />
    </Svg>
  );
}

/** Outline notification bell. */
export function BellIcon({ size = 20, color = '#FFFFFF' }: { size?: number; color?: string }) {
  const stroke = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6z" {...stroke} />
      <Path d="M10 19a2 2 0 0 0 4 0" {...stroke} />
    </Svg>
  );
}

/** Sliders / adjustments (settings) icon. */
export function SlidersIcon({ size = 20, color = '#FFFFFF' }: { size?: number; color?: string }) {
  const stroke = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={4} y1={8} x2={20} y2={8} {...stroke} />
      <Line x1={4} y1={16} x2={20} y2={16} {...stroke} />
      <Circle cx={15} cy={8} r={2.5} stroke={color} strokeWidth={2} fill="#2D6CA8" />
      <Circle cx={9} cy={16} r={2.5} stroke={color} strokeWidth={2} fill="#2D6CA8" />
    </Svg>
  );
}
