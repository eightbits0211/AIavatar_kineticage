import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../theme';
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
      <View style={[styles.bubble, isKin ? styles.kinBubble : styles.userBubble]}>
        <Text style={[styles.text, isKin ? styles.kinText : styles.userText]}>
          {content}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: spacing.xs,
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
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  kinBubble: {
    backgroundColor: colors.companionBubble,
    borderBottomLeftRadius: 6,
  },
  userBubble: {
    backgroundColor: colors.userBubble,
    borderBottomRightRadius: 6,
  },
  text: {
    ...typography.body,
    fontSize: 15,
  },
  kinText: {
    color: colors.text,
  },
  userText: {
    color: colors.surface,
  },
});