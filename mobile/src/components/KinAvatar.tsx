import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

interface KinAvatarProps {
  size?: number;
}

export default function KinAvatar({ size = 40 }: KinAvatarProps) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]} />
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: colors.secondary, // Orange color for Kin
    borderWidth: 2,
    borderColor: colors.background,
  },
});