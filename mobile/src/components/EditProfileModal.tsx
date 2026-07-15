import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Line } from 'react-native-svg';

import { colors, spacing, typography } from '../theme';
import { useUserStore } from '../stores/userStore';
import { apiPut } from '../services/api';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_HEIGHT = Math.min(SCREEN_H * 0.82, 640);

const NAVY = '#16365A';

const GENDERS: Array<{ label: string; value: string }> = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
];

function CloseX({ size = 16, color = '#8A98A8' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={6} y1={6} x2={18} y2={18} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={18} y1={6} x2={6} y2={18} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function EditProfileModal({ visible, onClose }: EditProfileModalProps) {
  const [mounted, setMounted] = useState(visible);
  const fade = useRef(new Animated.Value(0)).current;

  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [gender, setGender] = useState('');
  const [saving, setSaving] = useState(false);

  // Seed fields from the saved profile each time the modal opens.
  useEffect(() => {
    if (!visible || !user) return;
    const u = user as any;
    setName(u.name && u.name !== 'Guest' ? u.name : '');
    setAge(u.age ? String(u.age) : '');
    setHeight(u.height_cm ? String(u.height_cm) : '');
    setGender(u.gender || '');
  }, [visible, user]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }).start(
        ({ finished }) => finished && setMounted(false)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;

  const handleSave = async () => {
    setSaving(true);
    // Build a payload with only valid values so we never push bad data.
    const payload: Record<string, unknown> = {};
    const trimmedName = name.trim();
    if (trimmedName) payload.name = trimmedName;
    const ageNum = parseInt(age, 10);
    if (ageNum >= 16 && ageNum <= 100) payload.age = ageNum;
    const heightNum = parseFloat(height);
    if (heightNum >= 100 && heightNum <= 250) payload.height_cm = heightNum;
    if (gender) payload.gender = gender;

    try {
      // PUT /api/profile persists these and recalculates BMI/metrics + persona,
      // so the numbers the onboarding captured (used to build workout bundles)
      // stay in sync. Same wiring the SettingsSheet uses.
      const updated = await apiPut<any>('/api/profile', payload);
      if (updated) setUser(updated);
    } catch {
      // Non-blocking — keep the edits so the user can retry.
    } finally {
      setSaving(false);
      onClose();
    }
  };

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        <BlurView intensity={26} tint="dark" style={[StyleSheet.absoluteFill, styles.scrim]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close edit profile" />
        </BlurView>
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            opacity: fade,
            transform: [{ scale: fade.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Edit Profile</Text>
          <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
            <CloseX />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator contentContainerStyle={styles.scroll} style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.textLight}
            returnKeyType="next"
          />

          <Text style={styles.fieldLabel}>Age</Text>
          <TextInput
            style={styles.input}
            value={age}
            onChangeText={setAge}
            placeholder="Age (16–100)"
            placeholderTextColor={colors.textLight}
            keyboardType="number-pad"
            maxLength={3}
          />

          <Text style={styles.fieldLabel}>Height (cm)</Text>
          <TextInput
            style={styles.input}
            value={height}
            onChangeText={setHeight}
            placeholder="Height in cm"
            placeholderTextColor={colors.textLight}
            keyboardType="numeric"
            maxLength={5}
          />

          <Text style={styles.fieldLabel}>Gender</Text>
          <View style={styles.genderWrap}>
            {GENDERS.map((g) => {
              const sel = gender === g.value;
              return (
                <Pressable key={g.value} onPress={() => setGender(g.value)} style={[styles.genderChip, sel && styles.genderChipSel]}>
                  <Text style={[styles.genderText, sel && styles.genderTextSel]}>{g.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable onPress={handleSave} disabled={saving} style={styles.saveBtn} accessibilityLabel="Save profile">
            {saving ? <ActivityIndicator color="#F5821F" /> : <Text style={styles.saveText}>Save Changes</Text>}
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  scrim: { backgroundColor: 'rgba(24,24,26,0.5)' },
  sheet: {
    width: '100%',
    // Definite height (not just maxHeight): a flex:1 ScrollView inside a
    // maxHeight-only parent collapses to ~0 height on Android, which hid all
    // the fields/gender options (only the header + Save button showed). A fixed
    // height gives the ScrollView bounded space so the fields render + scroll.
    height: SHEET_HEIGHT,
    backgroundColor: '#1C1C1E',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  title: { ...typography.h3, color: '#FFFFFF', flex: 1, fontFamily: 'Inter_700Bold' },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.sm },

  fieldLabel: { ...typography.bodyBold, color: '#FFFFFF', marginTop: spacing.md, marginBottom: spacing.sm },
  input: {
    height: 48,
    backgroundColor: '#2C2C2E',
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    ...typography.body,
    color: '#FFFFFF',
  },

  genderWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  genderChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: '#2C2C2E',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  genderChipSel: { backgroundColor: NAVY, borderColor: NAVY },
  genderText: { ...typography.caption, color: '#FFFFFF', fontFamily: 'Inter_600SemiBold' },
  genderTextSel: { color: '#FFFFFF' },

  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: '#1C1C1E',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2C2C2E',
  },
  saveBtn: {
    alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(245,130,31,0.16)',
    borderRadius: 22, paddingHorizontal: spacing.lg, paddingVertical: 12,
  },
  saveText: { ...typography.caption, color: '#F5821F', fontFamily: 'Inter_600SemiBold', fontSize: 15 },
});
