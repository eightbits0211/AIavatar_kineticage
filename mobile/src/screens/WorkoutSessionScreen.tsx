import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import WorkoutDeck from '../components/WorkoutDeck';
import WorkoutSummaryModal, { type WorkoutSummary } from '../components/WorkoutSummaryModal';
import { apiPost, apiPut } from '../services/api';
import { useUIStore } from '../stores/uiStore';
import { colors, spacing, typography } from '../theme';
import type { ExerciseBundle } from '../../../shared/types';

/**
 * Guided workout session (Path B — reached from Bundle Detail → Start Workout).
 *
 * Mirrors the in-chat workout flow on the Home screen: it opens a backend
 * session (POST /api/session/start), logs each set/exercise as the user works
 * through the WorkoutDeck (PUT /api/session/:id/exercise), and ends the session
 * (POST /api/session/:id/end) to produce the post-workout report shown in the
 * WorkoutSummaryModal.
 */
export default function WorkoutSessionScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const bundle: ExerciseBundle | undefined = route.params?.bundle;

  const exercises = bundle?.exercises ?? [];

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [summary, setSummary] = useState<WorkoutSummary | null>(null);
  // The backend session id, resolved shortly after mount. Kept in a ref so the
  // async Done/Skip/End handlers always read the latest value.
  const sessionIdRef = useRef<string | null>(null);
  const endedRef = useRef(false);

  // Hide the floating tab bar while the session is active; restore on exit.
  const setHideTabBar = useUIStore((s) => s.setHideTabBar);
  useFocusEffect(
    useCallback(() => {
      setHideTabBar(true);
      return () => setHideTabBar(false);
    }, [setHideTabBar]),
  );

  // Open the backend session once, in the background, so logging works. The
  // deck is interactive immediately; if this fails, set logging is skipped but
  // the summary modal still appears at the end (best-effort, like Path A).
  useEffect(() => {
    let active = true;
    if (!bundle?._id) return;
    apiPost<{ session_id: string }>('/api/session/start', { bundle_id: bundle._id })
      .then((res) => {
        if (active) sessionIdRef.current = res.session_id;
      })
      .catch(() => {
        // Non-blocking — the workout still runs locally; summary falls back.
      });
    return () => {
      active = false;
    };
  }, [bundle?._id]);

  // End the session and show the post-workout summary. Always resolves to a
  // summary object so the modal appears even if /end fails.
  const finishSession = useCallback(async () => {
    if (endedRef.current) return;
    endedRef.current = true;
    const sid = sessionIdRef.current;
    const planned = exercises.length;

    let endRes: WorkoutSummary | null = null;
    if (sid) {
      try {
        endRes = await apiPost<WorkoutSummary>(`/api/session/${sid}/end`, {});
      } catch {
        endRes = null;
      }
    }

    setSummary(
      endRes ?? {
        status: 'complete',
        exercises_completed: planned,
        exercises_planned: planned,
        completion_ratio: planned > 0 ? 100 : 0,
      },
    );
  }, [exercises.length]);

  // Mark the current exercise complete with the reps logged, then advance.
  const handleDone = useCallback(
    async (reps: number) => {
      const ex = exercises[index];
      const isLast = index >= exercises.length - 1;
      if (!isLast) setIndex((i) => i + 1);

      const sid = sessionIdRef.current;
      if (sid && ex?.exercise_id) {
        try {
          const setCount = Math.max(1, ex.sets ?? 1);
          for (let i = 1; i <= setCount; i++) {
            await apiPut(`/api/session/${sid}/exercise`, {
              exercise_id: ex.exercise_id,
              action: 'complete_set',
              data: { set_number: i, actual_reps: reps },
            });
          }
          await apiPut(`/api/session/${sid}/exercise`, {
            exercise_id: ex.exercise_id,
            action: 'complete_exercise',
            data: { feedback: 'felt_normal' },
          });
        } catch {
          // Ignore logging failure for this exercise.
        }
      }

      if (isLast) await finishSession();
    },
    [exercises, index, finishSession],
  );

  // Skip the current exercise, then advance.
  const handleSkip = useCallback(async () => {
    const ex = exercises[index];
    const isLast = index >= exercises.length - 1;
    if (!isLast) setIndex((i) => i + 1);

    const sid = sessionIdRef.current;
    if (sid && ex?.exercise_id) {
      try {
        await apiPut(`/api/session/${sid}/exercise`, {
          exercise_id: ex.exercise_id,
          action: 'skip',
          data: { reason: 'user_skipped' },
        });
      } catch {
        // Ignore.
      }
    }

    if (isLast) await finishSession();
  }, [exercises, index, finishSession]);

  const togglePause = useCallback(() => {
    setPaused((p) => {
      const next = !p;
      const sid = sessionIdRef.current;
      if (next && sid) apiPost(`/api/session/${sid}/pause`, {}).catch(() => {});
      return next;
    });
  }, []);

  // End early — the backend saves whatever's been logged (≥50% → partial,
  // else abandoned) and returns the report. Confirm first.
  const confirmEnd = useCallback(() => {
    const doEnd = () => finishSession();
    if (Platform.OS === 'web') {
      const ok = (globalThis as any).confirm?.('End workout now? Your progress so far will be saved.');
      if (ok) doEnd();
    } else {
      Alert.alert('End workout?', 'Your progress so far will be saved.', [
        { text: 'Keep going', style: 'cancel' },
        { text: 'End workout', style: 'destructive', onPress: doEnd },
      ]);
    }
  }, [finishSession]);

  if (!bundle) {
    return (
      <View style={styles.center}>
        <Text style={styles.note}>No workout selected.</Text>
      </View>
    );
  }

  const currentEx = exercises[index];

  return (
    <View style={styles.container}>
      <View style={[styles.gifWrap, { marginTop: Math.max(insets.top, 24) + spacing.md }]}>
        {currentEx?.image_url ? (
          <Image source={{ uri: currentEx.image_url }} style={styles.gif} resizeMode="cover" />
        ) : (
          <View style={styles.gif} />
        )}
      </View>

      <View style={styles.deckWrap}>
        {exercises.length > 0 && currentEx ? (
          <WorkoutDeck
            key={index}
            exercise={currentEx}
            index={index}
            total={exercises.length}
            paused={paused}
            onDone={handleDone}
            onSkip={handleSkip}
            onPause={togglePause}
            onEnd={confirmEnd}
            hideImage
          />
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>

      <WorkoutSummaryModal
        visible={!!summary}
        summary={summary}
        onClose={() => {
          setSummary(null);
          navigation.popToTop?.();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  gifWrap: { paddingHorizontal: spacing.lg },
  gif: {
    width: '100%',
    height: 220,
    borderRadius: 20,
    backgroundColor: '#2C2C2E',
  },
  deckWrap: { paddingHorizontal: spacing.lg },
  note: { ...typography.body, color: colors.textSecondary },
});
