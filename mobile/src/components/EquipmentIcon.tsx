import Svg, { Path, Line, Circle, Rect } from 'react-native-svg';

export type EquipmentIconName =
  | 'none'
  | 'dumbbells'
  | 'barbell'
  | 'resistance_bands'
  | 'kettlebell'
  | 'pull_up_bar'
  | 'bench'
  | 'machines';

interface EquipmentIconProps {
  name: EquipmentIconName;
  size?: number;
  color?: string;
}

/**
 * Line icons for the equipment-access step, styled to match the rest of the
 * onboarding design (simple stroked glyphs in a tinted rounded square).
 */
export default function EquipmentIcon({ name, size = 20, color = '#4A90C2' }: EquipmentIconProps) {
  const stroke = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  const icon = () => {
    switch (name) {
      case 'none':
        // Bodyweight — simple standing figure
        return (
          <>
            <Circle cx={12} cy={5} r={2.5} {...stroke} />
            <Path d="M12 8V15M12 11L7 9M12 11L17 9M12 15L8 21M12 15L16 21" {...stroke} />
          </>
        );
      case 'dumbbells':
        return (
          <>
            <Line x1={9} y1={12} x2={15} y2={12} {...stroke} />
            <Line x1={6.5} y1={9.5} x2={6.5} y2={14.5} {...stroke} />
            <Line x1={9} y1={8.5} x2={9} y2={15.5} {...stroke} />
            <Line x1={15} y1={8.5} x2={15} y2={15.5} {...stroke} />
            <Line x1={17.5} y1={9.5} x2={17.5} y2={14.5} {...stroke} />
          </>
        );
      case 'barbell':
        return (
          <>
            <Line x1={3} y1={12} x2={21} y2={12} {...stroke} />
            <Line x1={6} y1={8} x2={6} y2={16} {...stroke} />
            <Line x1={9} y1={6.5} x2={9} y2={17.5} {...stroke} />
            <Line x1={15} y1={6.5} x2={15} y2={17.5} {...stroke} />
            <Line x1={18} y1={8} x2={18} y2={16} {...stroke} />
          </>
        );
      case 'resistance_bands':
        // Loop band
        return (
          <>
            <Path d="M7 6A5 8 0 1 0 7 18" {...stroke} />
            <Path d="M17 6A5 8 0 1 1 17 18" {...stroke} />
            <Line x1={7} y1={9} x2={17} y2={9} {...stroke} />
            <Line x1={7} y1={15} x2={17} y2={15} {...stroke} />
          </>
        );
      case 'kettlebell':
        return (
          <>
            <Path d="M9 7A3 3 0 0 1 15 7" {...stroke} />
            <Path d="M9 7C7 8 6 11 6 14A6 6 0 0 0 18 14C18 11 17 8 15 7" {...stroke} />
          </>
        );
      case 'pull_up_bar':
        return (
          <>
            <Line x1={4} y1={5} x2={20} y2={5} {...stroke} />
            <Line x1={7} y1={5} x2={7} y2={9} {...stroke} />
            <Line x1={17} y1={5} x2={17} y2={9} {...stroke} />
            <Line x1={10} y1={5} x2={10} y2={11} {...stroke} />
            <Line x1={14} y1={5} x2={14} y2={11} {...stroke} />
          </>
        );
      case 'bench':
        return (
          <>
            <Rect x={4} y={9} width={16} height={3.5} rx={1.5} {...stroke} />
            <Line x1={6} y1={12.5} x2={6} y2={18} {...stroke} />
            <Line x1={18} y1={12.5} x2={18} y2={18} {...stroke} />
          </>
        );
      case 'machines':
        return (
          <>
            <Rect x={4} y={4} width={16} height={16} rx={2} {...stroke} />
            <Line x1={9} y1={4} x2={9} y2={20} {...stroke} />
            <Line x1={9} y1={9} x2={15} y2={9} {...stroke} />
            <Line x1={9} y1={14} x2={15} y2={14} {...stroke} />
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
