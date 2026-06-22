import { Pressable, StyleSheet, Text } from 'react-native';
import { borderRadius, colors, spacing, typography } from '../theme';

interface QuickButtonProps {
  label: string;
  onPress: () => void;
  selected?: boolean;
}

export default function QuickButton({ label, onPress, selected = false }: QuickButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.text, selected && styles.selectedText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  selected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pressed: {
    opacity: 0.8,
  },
  text: {
    ...typography.body,
    color: colors.text,
    textAlign: 'center',
    fontSize: 15,
  },
  selectedText: {
    color: colors.surface,
  },
});