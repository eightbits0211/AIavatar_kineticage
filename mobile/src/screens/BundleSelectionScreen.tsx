import { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BundleCard from '../components/BundleCard';
import { apiGet, apiPost } from '../services/api';
import { colors, spacing, typography } from '../theme';
import type { ExerciseBundle } from '../../../shared/types';

interface BundlesResponse {
  bundles: ExerciseBundle[];
}

export default function BundleSelectionScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [bundles, setBundles] = useState<ExerciseBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const generate = useCallback(async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await apiPost<BundlesResponse>('/api/bundles/generate', {});
      setBundles(sortRecommended(res.bundles));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate workouts.');
    } finally {
      setGenerating(false);
      setLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiGet<BundlesResponse>('/api/bundles/active');
      setBundles(sortRecommended(res.bundles));
      setLoading(false);
    } catch {
      // No active set yet — generate a fresh one.
      await generate();
    }
  }, [generate]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Today's Workouts</Text>
        <Text style={styles.subtitle}>Pick one — the recommended is tailored to you.</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Building your options…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={generating} onRefresh={generate} tintColor={colors.primary} />}
        >
          {!!error && <Text style={styles.error}>{error}</Text>}

          {bundles.map((bundle) => (
            <BundleCard
              key={bundle._id}
              bundle={bundle}
              onPress={() => navigation.navigate('BundleDetail', { bundle })}
            />
          ))}

          <Pressable
            onPress={generate}
            disabled={generating}
            style={({ pressed }) => [styles.regenerate, pressed && styles.regeneratePressed]}
          >
            <Text style={styles.regenerateText}>
              {generating ? 'Regenerating…' : '↻  Regenerate options'}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function sortRecommended(bundles: ExerciseBundle[]): ExerciseBundle[] {
  return [...bundles].sort((a, b) => Number(b.is_recommended) - Number(a.is_recommended));
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  regenerate: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  regeneratePressed: {
    opacity: 0.6,
  },
  regenerateText: {
    ...typography.bodyBold,
    color: colors.primary,
  },
});
