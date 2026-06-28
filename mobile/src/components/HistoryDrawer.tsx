import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import KinAvatar from './KinAvatar';
import GoalIcon from './GoalIcon';
import ActivityIcon from './ActivityIcon';
import { colors, spacing, typography } from '../theme';

export interface HistoryItem {
  session_id: string;
  date: string;
  bundle_title: string;
  focus: string;
  duration_min: number;
  xp_awarded: number;
}

interface HistoryDrawerProps {
  visible: boolean;
  onClose: () => void;
  history: HistoryItem[];
  loading: boolean;
  userName: string;
  level: number;
  streak: number;
  onNewSession: () => void;
}

const PANEL_WIDTH = Math.min(320, Dimensions.get('window').width * 0.82);

// Pick an icon + colors from the workout title/focus keywords.
function iconFor(title: string, focus: string) {
  const s = `${title} ${focus}`.toLowerCase();
  if (/(hiit|fat|cardio|burn|power)/.test(s)) {
    return { node: <ActivityIcon name="bolt" size={18} color="#E8772E" />, tint: '#FDF0E6' };
  }
  if (/(mobility|flow|stretch|yoga)/.test(s)) {
    return { node: <ActivityIcon name="leaf" size={18} color="#34A853" />, tint: '#E8F6EE' };
  }
  return { node: <GoalIcon goal="strength" size={18} color="#4A90C2" />, tint: '#EAF2FB' };
}

// Bucket sessions by recency for the section headers.
function groupByRecency(history: HistoryItem[]): Array<{ label: string; items: HistoryItem[] }> {
  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday); startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate() - startOfToday.getDay());
  const startOfLastWeek = new Date(startOfWeek); startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  const buckets: Record<string, HistoryItem[]> = { TODAY: [], YESTERDAY: [], 'THIS WEEK': [], 'LAST WEEK': [], EARLIER: [] };
  for (const h of history) {
    const d = new Date(h.date);
    if (d >= startOfToday) buckets.TODAY.push(h);
    else if (d >= startOfYesterday) buckets.YESTERDAY.push(h);
    else if (d >= startOfWeek) buckets['THIS WEEK'].push(h);
    else if (d >= startOfLastWeek) buckets['LAST WEEK'].push(h);
    else buckets.EARLIER.push(h);
  }
  return Object.entries(buckets)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

export default function HistoryDrawer({
  visible,
  onClose,
  history,
  loading,
  userName,
  level,
  streak,
  onNewSession,
}: HistoryDrawerProps) {
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(-PANEL_WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, { toValue: visible ? 0 : -PANEL_WIDTH, duration: 220, useNativeDriver: true }),
      Animated.timing(fade, { toValue: visible ? 1 : 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [visible, slide, fade]);

  if (!visible) return null;

  const groups = groupByRecency(history);
  const initial = (userName || 'You').charAt(0).toUpperCase();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.panel, { width: PANEL_WIDTH, transform: [{ translateX: slide }], paddingTop: insets.top + spacing.md }]}>
        {/* Header */}
        <View style={styles.header}>
          <KinAvatar size={44} />
          <View style={styles.headerText}>
            <Text style={styles.brand}>Kinetic Age</Text>
            <Text style={styles.brandSub}>AI Coach</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        {/* New session */}
        <Pressable onPress={onNewSession} style={styles.newSession}>
          <View style={styles.newPlus}><Text style={styles.newPlusText}>＋</Text></View>
          <Text style={styles.newSessionText}>New Session</Text>
        </Pressable>

        {/* History list */}
        <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
          ) : history.length === 0 ? (
            <Text style={styles.empty}>No workouts yet. Start your first session!</Text>
          ) : (
            groups.map((group) => (
              <View key={group.label}>
                <Text style={styles.sectionLabel}>{group.label}</Text>
                {group.items.map((item) => {
                  const ic = iconFor(item.bundle_title, item.focus);
                  return (
                    <View key={item.session_id} style={styles.row}>
                      <View style={[styles.rowIcon, { backgroundColor: ic.tint }]}>{ic.node}</View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{item.bundle_title}</Text>
                        <Text style={styles.rowMeta}>⏱ {item.duration_min} min</Text>
                      </View>
                      <Text style={styles.rowXp}>✦ +{item.xp_awarded}</Text>
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerAvatar}><Text style={styles.footerInitial}>{initial}</Text></View>
          <View>
            <Text style={styles.footerName}>{userName || 'You'}</Text>
            <Text style={styles.footerSub}>Level {level} · {streak}-day streak</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.35)' },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#16304D',
    paddingHorizontal: spacing.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  headerText: { flex: 1, marginLeft: spacing.md },
  brand: { ...typography.h3, color: '#FFFFFF' },
  brandSub: { ...typography.caption, color: 'rgba(255,255,255,0.6)' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeText: { color: '#FFFFFF', fontSize: 14 },
  newSession: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(245,130,31,0.18)',
    borderWidth: 1, borderColor: 'rgba(245,130,31,0.5)',
    borderRadius: 14, padding: spacing.md, marginBottom: spacing.lg,
  },
  newPlus: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#F5821F',
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  newPlusText: { color: '#FFFFFF', fontSize: 18, lineHeight: 20, fontFamily: 'Inter_700Bold' },
  newSessionText: { ...typography.bodyBold, color: '#FFFFFF' },
  list: { flex: 1 },
  sectionLabel: {
    ...typography.small, color: 'rgba(255,255,255,0.45)',
    fontFamily: 'Inter_600SemiBold', letterSpacing: 1,
    marginTop: spacing.md, marginBottom: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  rowIcon: {
    width: 36, height: 36, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  rowTitle: { ...typography.bodyBold, fontSize: 15, color: '#FFFFFF' },
  rowMeta: { ...typography.small, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  rowXp: { ...typography.small, color: '#FFD54A', fontFamily: 'Inter_700Bold' },
  empty: { ...typography.body, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: spacing.xl },
  footer: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.15)',
    paddingVertical: spacing.md,
  },
  footerAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  footerInitial: { ...typography.bodyBold, color: '#FFFFFF' },
  footerName: { ...typography.bodyBold, color: '#FFFFFF' },
  footerSub: { ...typography.small, color: 'rgba(255,255,255,0.55)' },
});
