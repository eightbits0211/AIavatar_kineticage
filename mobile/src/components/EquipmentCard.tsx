import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';
import EquipmentIcon, { type EquipmentIconName } from './EquipmentIcon';

interface EquipmentCardProps {
  value: EquipmentIconName;
  label: string;
  tint: string;
  iconColor: string;
  selected: boolean;
  onPress: () => void;
}

/**
 * 2-column selectable card (icon + label) for the equipment-access step.
 * Highlights with a primary border + tint when selected (multi-select).
 */
export default function EquipmentCard({
  value,
  label,
  tint,
  iconColor,
  selected,
  onPress,
}: EquipmentCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: selected ? colors.primary : tint }]}>
        <EquipmentIcon name={value} size={18} color={selected ? colors.surface : iconColor} />
      </View>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    // Constant border width so selecting never shifts layout — only color/fill change.
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#EAF2FB',
  },
  pressed: {
    opacity: 0.7,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  label: {
    ...typography.bodyBold,
    fontSize: 14,
    lineHeight: 18,
    color: colors.text,
    flex: 1,
  },
});
