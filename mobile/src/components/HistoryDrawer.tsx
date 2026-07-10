import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';

import TabBarIcon from './TabBarIcon';
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
    return { node: <ActivityIcon name="bolt" size={18} color="#E8772E" />, tint: 'rgba(232,119,46,0.18)' };
  }
  if (/(mobility|flow|stretch|yoga)/.test(s)) {
    return { node: <ActivityIcon name="leaf" size={18} color="#34A853" />, tint: 'rgba(52,168,83,0.18)' };
  }
  return { node: <GoalIcon goal="strength" size={18} color="#4A90C2" />, tint: 'rgba(74,144,194,0.18)' };
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
  const [mounted, setMounted] = useState(visible);
  const slide = useRef(new Animated.Value(-PANEL_WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;

  // Keep the drawer mounted through the close animation so both the open
  // (slide-in) and close (slide-out) transitions actually play. Native driver
  // keeps them off the JS thread so the list rendering can't cause jank.
  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    if (visible) {
      setMounted(true);
      // Reset to the off-screen start, then begin the slide-in a couple of
      // frames later — after React has committed the freshly-mounted subtree.
      // Starting on the same frame as the mount is what made opening feel janky.
      slide.setValue(-PANEL_WIDTH);
      fade.setValue(0);
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          Animated.parallel([
            Animated.timing(slide, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
          ]).start();
        });
      });
    } else {
      Animated.parallel([
        Animated.timing(slide, { toValue: -PANEL_WIDTH, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    return () => {
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [visible, slide, fade]);

  if (!mounted) return null;

  const groups = groupByRecency(history);
  const initial = (userName || 'You').charAt(0).toUpperCase();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        <BlurView intensity={26} tint="dark" style={[StyleSheet.absoluteFill, styles.scrim]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </BlurView>
      </Animated.View>

      <Animated.View style={[styles.panel, { width: PANEL_WIDTH, transform: [{ translateX: slide }], paddingTop: Math.max(insets.top, 24) + spacing.md }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.kinLogo}>
            <TabBarIcon name="coach" color="rgb(166, 250, 4)" size={26} />
          </View>
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
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) + 74 }]}>
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
  scrim: { backgroundColor: 'rgba(24,24,26,0.5)' },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#0E0E10',
    borderRightWidth: 1,
    borderRightColor: '#1F1F22',
    paddingHorizontal: spacing.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  kinLogo: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1C1C1E',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
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
    alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(245,130,31,0.16)',
    borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: 8, marginBottom: spacing.lg,
  },
  newPlus: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#F5821F',
    alignItems: 'center', justifyContent: 'center',
  },
  newPlusText: { color: '#000000', fontSize: 14, lineHeight: 16, fontFamily: 'Inter_700Bold' },
  newSessionText: { ...typography.caption, color: '#F5821F', fontFamily: 'Inter_600SemiBold' },
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
  rowXp: { ...typography.small, color: 'rgb(246, 208, 0)', fontFamily: 'Inter_700Bold' },
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
