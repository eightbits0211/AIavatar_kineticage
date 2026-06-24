import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography } from '../theme';
import KinAvatar from './KinAvatar';

interface ChatMessageProps {
  role: 'kin' | 'user';
  content: string;
}

export default function ChatMessage({ role, content }: ChatMessageProps) {
  const isKin = role === 'kin';

  return (
    <View style={[styles.container, isKin ? styles.kinMessage : styles.userMessage]}>
      {isKin && (
        <View style={styles.avatarContainer}>
          <KinAvatar size={32} />
        </View>
      )}
      {isKin ? (
        <View style={styles.kinBubble}>
          <Text style={styles.kinText}>{content}</Text>
        </View>
      ) : (
        <LinearGradient
          colors={['#3A7CA8', '#4A90C2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.userBubble}
        >
          <Text style={styles.userText}>{content}</Text>
        </LinearGradient>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  kinMessage: {
    justifyContent: 'flex-start',
  },
  userMessage: {
    justifyContent: 'flex-end',
  },
  avatarContainer: {
    marginRight: spacing.sm,
    marginTop: spacing.xs,
    alignSelf: 'flex-end',
  },
  kinBubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  userBubble: {
    maxWidth: '75%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 18,
    shadowColor: '#3A7CA8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  kinText: {
    ...typography.body,
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  userText: {
    ...typography.body,
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 22,
  },
});
