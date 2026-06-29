import Svg, { Path, Line, Rect, Circle } from 'react-native-svg';

export type ChipIconName =
  | 'workout'
  | 'progress'
  | 'plan'
  | 'history'
  | 'badges'
  | 'recovery'
  | 'motivation';

interface ChipIconProps {
  name: ChipIconName;
  size?: number;
  color?: string;
}

/** Line icons for the home quick-action chips. */
export default function ChipIcon({ name, size = 16, color = '#FFFFFF' }: ChipIconProps) {
  const s = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  switch (name) {
    case 'workout': // dumbbell
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Line x1={9} y1={12} x2={15} y2={12} {...s} />
          <Line x1={6.5} y1={9.5} x2={6.5} y2={14.5} {...s} />
          <Line x1={9} y1={8.5} x2={9} y2={15.5} {...s} />
          <Line x1={15} y1={8.5} x2={15} y2={15.5} {...s} />
          <Line x1={17.5} y1={9.5} x2={17.5} y2={14.5} {...s} />
        </Svg>
      );
    case 'progress': // bar chart
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Line x1={6} y1={20} x2={6} y2={13} {...s} />
          <Line x1={12} y1={20} x2={12} y2={8} {...s} />
          <Line x1={18} y1={20} x2={18} y2={4} {...s} />
        </Svg>
      );
    case 'plan': // calendar
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x={4} y={5} width={16} height={16} rx={3} {...s} />
          <Line x1={4} y1={9} x2={20} y2={9} {...s} />
          <Line x1={8} y1={3} x2={8} y2={6} {...s} />
          <Line x1={16} y1={3} x2={16} y2={6} {...s} />
        </Svg>
      );
    case 'history': // clock with rewind arrow
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M3.5 8A9 9 0 1 1 3 12" {...s} />
          <Path d="M3 4v4h4" {...s} />
          <Path d="M12 8v4l3 2" {...s} />
        </Svg>
      );
    case 'badges': // trophy
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M7 4H17V8A5 5 0 0 1 7 8Z" {...s} />
          <Path d="M7 5H4V7A3 3 0 0 0 7 9" {...s} />
          <Path d="M17 5H20V7A3 3 0 0 1 17 9" {...s} />
          <Path d="M12 13V17M9 20H15M10.5 20V17H13.5V20" {...s} />
        </Svg>
      );
    case 'recovery': // leaf
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M5 19C5 11 11 5 19 5C19 13 13 19 5 19Z" {...s} />
          <Path d="M5 19L15 9" {...s} />
        </Svg>
      );
    case 'motivation': // flame
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 3c2 3 4.5 4.8 4.5 8.5a4.5 4.5 0 0 1-9 0c0-1.6.8-2.8 1.6-3.6 0 1.2.9 2 1.9 2-1-2.4.2-5 0-6.9z" {...s} />
        </Svg>
      );
    default:
      return null;
  }
}
