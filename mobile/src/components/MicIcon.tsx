import Svg, { Path } from 'react-native-svg';

interface MicIconProps {
  size?: number;
  color?: string;
}

/** Simple microphone glyph for the "Ask Kin" voice button. */
export default function MicIcon({ size = 22, color = '#4A90C2' }: MicIconProps) {
  const stroke = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" {...stroke} />
      <Path d="M6 11a6 6 0 0 0 12 0" {...stroke} />
      <Path d="M12 17v4" {...stroke} />
      <Path d="M8.5 21h7" {...stroke} />
    </Svg>
  );
}
