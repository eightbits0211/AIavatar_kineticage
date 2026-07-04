import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import KinAvatar from './KinAvatar';
import { colors, spacing, typography } from '../theme';

const NAVY = '#16365A';
const ORANGE = '#F5821F';

/**
 * Curated avatar choices from DiceBear's free HTTP API (no auth, direct PNGs).
 * A uniform light background keeps them consistent inside the circular frame.
 * Docs: https://www.dicebear.com/how-to-use/http-api
 */
const DICEBEAR = 'https://api.dicebear.com/9.x';
const BG = 'eaf2fb,d1e3f6,e8f6ee,fdf0e6,f3eefb';
const seededUrl = (style: string, seed: string) =>
  `${DICEBEAR}/${style}/png?seed=${encodeURIComponent(seed)}&backgroundColor=${BG}&radius=50`;

export const AVATAR_OPTIONS: string[] = [
  // adventurer — illustrated people, lots of character
  seededUrl('adventurer', 'Milo'),
  seededUrl('adventurer', 'Zoe'),
  seededUrl('adventurer', 'Kai'),
  // avataaars — the classic colorful cartoon people
  seededUrl('avataaars', 'Max'),
  seededUrl('avataaars', 'Aria'),
  seededUrl('avataaars', 'Jordan'),
  // big-smile — bold, happy, colorful
  seededUrl('big-smile', 'Leo'),
  seededUrl('big-smile', 'Mia'),
  // open-peeps — hand-drawn, expressive
  seededUrl('open-peeps', 'Sunny'),
  seededUrl('open-peeps', 'River'),
  seededUrl('open-peeps', 'Ash'),
  // notionists — clean modern people
  seededUrl('notionists', 'Remy'),
  seededUrl('notionists', 'Lux'),
  // micah — smooth illustrated portraits
  seededUrl('micah', 'Finn'),
  seededUrl('micah', 'Nina'),
  // fun-emoji — playful emoji faces
  seededUrl('fun-emoji', 'Nova'),
  seededUrl('fun-emoji', 'Sky'),
  // bottts — energetic robots (on-brand for an AI app)
  seededUrl('bottts', 'Volt'),
  seededUrl('bottts', 'Circuit'),
  seededUrl('bottts', 'Titan'),
  // pixel-art — retro gamer vibe
  seededUrl('pixel-art', 'Blit'),
  seededUrl('pixel-art', 'Byte'),
  // personas — friendly flat illustrations
  seededUrl('personas', 'Ravi'),
  seededUrl('personas', 'Sara'),
];

interface Props {
  visible: boolean;
  current: string | null;
  onSelect: (url: string | null) => void;
  onClose: () => void;
}

/** Floating avatar picker — same style as the badges/levels popups. */
export default function AvatarPickerModal({ visible, current, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Choose your avatar</Text>
              <Text style={styles.subtitle}>Tap one to set it as your profile picture</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={styles.closeX}>✕</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            {/* Kin default option */}
            <Pressable
              onPress={() => {
                onSelect(null);
                onClose();
              }}
              style={[styles.cell, !current && styles.cellSel]}
              accessibilityRole="button"
              accessibilityLabel="Use default Kin avatar"
            >
              <View style={styles.avatarWrap}>
                <KinAvatar size={64} />
              </View>
              <Text style={styles.cellLabel}>Kin</Text>
            </Pressable>

            {AVATAR_OPTIONS.map((url) => {
              const sel = current === url;
              return (
                <Pressable
                  key={url}
                  onPress={() => {
                    onSelect(url);
                    onClose();
                  }}
                  style={[styles.cell, sel && styles.cellSel]}
                  accessibilityRole="button"
                  accessibilityLabel="Select avatar"
                >
                  <Image source={{ uri: url }} style={styles.avatarImg} resizeMode="cover" />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(16,32,54,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  sheet: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: colors.background,
    borderRadius: 24,
    overflow: 'hidden',
    paddingBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { ...typography.h2, color: NAVY, fontFamily: 'Inter_700Bold' },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5EAF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeX: { fontSize: 16, color: '#8A98A8', fontFamily: 'Inter_700Bold' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  cell: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 16,
    marginBottom: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cellSel: { borderColor: ORANGE, backgroundColor: '#FFF6EE' },
  avatarWrap: { alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#EAF2FB' },
  cellLabel: { ...typography.small, color: colors.textSecondary, marginTop: 4 },
});
