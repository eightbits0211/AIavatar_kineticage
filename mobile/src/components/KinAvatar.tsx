import Svg, {
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  Ellipse,
  G,
  Rect,
  Circle,
  Path,
} from 'react-native-svg';

interface KinAvatarProps {
  size?: number;
}

/**
 * Kin — the AI fitness coach avatar.
 * Converted from Figma SVG export.
 */
export default function KinAvatar({ size = 40 }: KinAvatarProps) {
  return (
    <Svg width={size} height={size * 1.3} viewBox="0 0 100 130" fill="none">
      <Defs>
        <RadialGradient id="rg_body" cx="35%" cy="30%" r="70%">
          <Stop offset="0%" stopColor="#F07540" />
          <Stop offset="55%" stopColor="#E05818" />
          <Stop offset="100%" stopColor="#B83E08" />
        </RadialGradient>
        <RadialGradient id="rg_head" cx="30%" cy="25%" r="75%">
          <Stop offset="0%" stopColor="#F28050" />
          <Stop offset="50%" stopColor="#E06020" />
          <Stop offset="100%" stopColor="#C04810" />
        </RadialGradient>
        <RadialGradient id="rg_ear" cx="35%" cy="30%" r="70%">
          <Stop offset="0%" stopColor="#FFE040" />
          <Stop offset="100%" stopColor="#D4A000" />
        </RadialGradient>
        <RadialGradient id="rg_arm" cx="30%" cy="20%" r="80%">
          <Stop offset="0%" stopColor="#F07030" />
          <Stop offset="100%" stopColor="#C04810" />
        </RadialGradient>
        <RadialGradient id="rg_screen" cx="50%" cy="50%" r="60%">
          <Stop offset="0%" stopColor="#1A1200" />
          <Stop offset="100%" stopColor="#0A0800" />
        </RadialGradient>
        <LinearGradient id="rg_bar" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#666" />
          <Stop offset="100%" stopColor="#333" />
        </LinearGradient>
        <RadialGradient id="rg_plate" cx="35%" cy="30%" r="70%">
          <Stop offset="0%" stopColor="#555" />
          <Stop offset="100%" stopColor="#111" />
        </RadialGradient>
      </Defs>

      {/* Shadow */}
      <Ellipse cx={50} cy={104} rx={28} ry={3.5} fill="rgba(0,0,0,0.12)" />

      {/* Left arm */}
      <G>
        <Rect x={6} y={62} width={18} height={12} rx={6} fill="url(#rg_arm)" />
        <Rect x={6} y={74} width={16} height={22} rx={7} fill="url(#rg_arm)" />
        <Circle cx={18} cy={64} r={7} fill="url(#rg_arm)" />
        <Rect x={8} y={80} width={4} height={16} rx={2} fill="rgba(0,0,0,0.1)" />
      </G>

      {/* Right arm */}
      <G>
        <Rect x={76} y={62} width={18} height={12} rx={6} fill="url(#rg_arm)" />
        <Rect x={78} y={74} width={16} height={22} rx={7} fill="url(#rg_arm)" />
        <Circle cx={82} cy={64} r={7} fill="url(#rg_arm)" />
        <Rect x={88} y={80} width={4} height={16} rx={2} fill="rgba(0,0,0,0.1)" />
      </G>

      {/* Body */}
      <Rect x={20} y={56} width={60} height={46} rx={10} fill="url(#rg_body)" />
      <Rect x={24} y={58} width={24} height={14} rx={5} fill="rgba(255,255,255,0.12)" />
      <Rect x={26} y={80} width={48} height={3} rx={1.5} fill="rgba(0,0,0,0.12)" />
      <Rect x={26} y={88} width={48} height={3} rx={1.5} fill="rgba(0,0,0,0.08)" />

      {/* Neck */}
      <Rect x={37} y={49} width={26} height={12} rx={5} fill="url(#rg_body)" />
      <Rect x={41} y={51} width={18} height={4} rx={2} fill="rgba(0,0,0,0.12)" />

      {/* Head */}
      <Rect x={22} y={10} width={56} height={42} rx={9} fill="url(#rg_head)" />
      <Rect x={26} y={12} width={26} height={10} rx={4} fill="rgba(255,255,255,0.15)" />

      {/* Antenna */}
      <Rect x={44} y={4} width={12} height={8} rx={3} fill="url(#rg_head)" />
      <Rect x={47} y={1} width={6} height={5} rx={2.5} fill="#FFD020" />

      {/* Left ear */}
      <Ellipse cx={17} cy={30} rx={7} ry={9} fill="url(#rg_ear)" />
      <Ellipse cx={17} cy={30} rx={4} ry={5.5} fill="#B88000" opacity={0.6} />
      <Ellipse cx={16} cy={29} rx={2} ry={2.5} fill="rgba(255,255,255,0.3)" />

      {/* Right ear */}
      <Ellipse cx={83} cy={30} rx={7} ry={9} fill="url(#rg_ear)" />
      <Ellipse cx={83} cy={30} rx={4} ry={5.5} fill="#B88000" opacity={0.6} />
      <Ellipse cx={82} cy={29} rx={2} ry={2.5} fill="rgba(255,255,255,0.3)" />

      {/* Screen */}
      <Rect x={30} y={14} width={40} height={30} rx={5} fill="url(#rg_screen)" />
      <Rect x={30} y={14} width={40} height={30} rx={5} fill="none" stroke="#3A2800" strokeWidth={1.5} />
      <Rect x={31} y={15} width={38} height={28} rx={4} fill="rgba(255,200,0,0.04)" />

      {/* Face */}
      <G>
        {/* Left eye */}
        <Rect x={38} y={21} width={6} height={7} rx={1.5} fill="#FFD020" />
        <Rect x={39} y={22} width={2} height={2} rx={0.5} fill="#FFF8A0" />
        {/* Right eye */}
        <Rect x={56} y={21} width={6} height={7} rx={1.5} fill="#FFD020" />
        <Rect x={57} y={22} width={2} height={2} rx={0.5} fill="#FFF8A0" />
        {/* Smile */}
        <Path
          d="M39,34 Q50,39 61,34"
          stroke="#FFD020"
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
        />
      </G>
    </Svg>
  );
}
