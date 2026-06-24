import Svg, { Path } from 'react-native-svg';

export type ActivityIconName = 'leaf' | 'pulse' | 'bolt' | 'trophy';

interface ActivityIconProps {
  name: ActivityIconName;
  size?: number;
  color?: string;
}

/**
 * Line icons for the activity-level step, matching the onboarding design:
 * leaf (just starting), pulse (occasionally active), bolt (active),
 * trophy (very active).
 */
export default function ActivityIcon({ name, size = 20, color = '#4A90C2' }: ActivityIconProps) {
  const stroke = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  const icon = () => {
    switch (name) {
      case 'leaf':
        return (
          <>
            <Path d="M5 19C5 11 11 5 19 5C19 13 13 19 5 19Z" {...stroke} />
            <Path d="M5 19L15 9" {...stroke} />
          </>
        );
      case 'pulse':
        return <Path d="M3 12H7L10 19L14 5L17 12H21" {...stroke} />;
      case 'bolt':
        return <Path d="M13 2L5 13H11L10 22L19 10H13L13 2Z" {...stroke} />;
      case 'trophy':
        return (
          <>
            <Path d="M7 4H17V8A5 5 0 0 1 7 8Z" {...stroke} />
            <Path d="M7 5H4V7A3 3 0 0 0 7 9" {...stroke} />
            <Path d="M17 5H20V7A3 3 0 0 1 17 9" {...stroke} />
            <Path d="M12 13V17" {...stroke} />
            <Path d="M9 20H15M10.5 20V17H13.5V20" {...stroke} />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {icon()}
    </Svg>
  );
}
