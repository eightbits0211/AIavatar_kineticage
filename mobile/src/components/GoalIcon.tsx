import Svg, { Path, Line } from 'react-native-svg';
import type { FitnessGoal } from '../../../shared/types';

interface GoalIconProps {
  goal: FitnessGoal;
  size?: number;
  color?: string;
}

/**
 * Line icons for the six fitness goals, styled to match the onboarding design
 * (simple stroked glyphs). Mobility=leaf, General Fitness=pulse,
 * Weight Loss=down-trend, etc.
 */
export default function GoalIcon({ goal, size = 22, color = '#4A90C2' }: GoalIconProps) {
  const stroke = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  const icon = () => {
    switch (goal) {
      case 'strength':
        // Barbell (wide bar + plates at the ends)
        return (
          <>
            <Line x1={3} y1={12} x2={21} y2={12} {...stroke} />
            <Line x1={6} y1={8} x2={6} y2={16} {...stroke} />
            <Line x1={9} y1={6.5} x2={9} y2={17.5} {...stroke} />
            <Line x1={15} y1={6.5} x2={15} y2={17.5} {...stroke} />
            <Line x1={18} y1={8} x2={18} y2={16} {...stroke} />
          </>
        );
      case 'hypertrophy':
        // Dumbbell (compact bar + clustered plates)
        return (
          <>
            <Line x1={9} y1={12} x2={15} y2={12} {...stroke} />
            <Line x1={6.5} y1={9.5} x2={6.5} y2={14.5} {...stroke} />
            <Line x1={9} y1={8.5} x2={9} y2={15.5} {...stroke} />
            <Line x1={15} y1={8.5} x2={15} y2={15.5} {...stroke} />
            <Line x1={17.5} y1={9.5} x2={17.5} y2={14.5} {...stroke} />
          </>
        );
      case 'mobility':
        // Leaf
        return (
          <>
            <Path d="M5 19C5 11 11 5 19 5C19 13 13 19 5 19Z" {...stroke} />
            <Path d="M5 19L15 9" {...stroke} />
          </>
        );
      case 'general_fitness':
        // Heartbeat / activity line
        return <Path d="M3 12H7L10 19L14 5L17 12H21" {...stroke} />;
      case 'weight_loss':
        // Downward trend with arrowhead
        return (
          <>
            <Path d="M4 7L10 13L13 10L20 17" {...stroke} />
            <Path d="M20 12V17H15" {...stroke} />
          </>
        );
      case 'home_workout':
        // House
        return (
          <>
            <Path d="M4 11L12 4L20 11" {...stroke} />
            <Path d="M6 10V19H18V10" {...stroke} />
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
