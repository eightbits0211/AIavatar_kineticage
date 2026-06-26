import { ScrollView, StyleSheet, View } from 'react-native';
import { spacing } from '../theme';
import QuickButton from './QuickButton';

interface HorizontalButtonsProps {
  buttons: Array<{ label: string; value: string }>;
  onPress: (value: string) => void;
  selectedValues?: string[];
  multiSelect?: boolean;
}

export default function HorizontalButtons({ 
  buttons, 
  onPress, 
  selectedValues = [],
  multiSelect = false 
}: HorizontalButtonsProps) {
  return (
    <View style={styles.container}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {buttons.map((button) => (
          <QuickButton
            key={button.value}
            label={button.label}
            onPress={() => onPress(button.value)}
            selected={multiSelect ? selectedValues.includes(button.value) : false}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
  },
});