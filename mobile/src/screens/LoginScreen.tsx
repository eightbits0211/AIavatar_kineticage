import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import AppButton from '../components/AppButton';
import { colors, spacing, typography, borderRadius } from '../theme';
import {
  friendlyAuthError,
  signInAsGuest,
  signInWithEmail,
  registerWithEmail,
} from '../services/auth';

type AuthMode = 'login' | 'signup';

export default function AuthScreen() {
  const navigation = useNavigation<any>();

  const [mode, setMode] = useState<AuthMode>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setBusy(true);

    try {
      if (mode === 'signup') {
        if (!name.trim()) {
          setError('Please enter your name.');
          return;
        }
        if (!email.trim()) {
          setError('Please enter your email.');
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters.');
          return;
        }
        await registerWithEmail(name, email, password);
      } else {
        if (!email.trim() || !password) {
          setError('Please enter your email and password.');
          return;
        }
        await signInWithEmail(email, password);
      }
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleGuest = async () => {
    setError('');
    setBusy(true);
    try {
      await signInAsGuest();
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {mode === 'signup' ? 'Create Account' : 'Welcome Back'}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'signup' ? 'Start your fitness journey today' : 'Continue your progress'}
          </Text>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <Pressable
            style={[styles.tab, mode === 'signup' && styles.activeTab]}
            onPress={() => setMode('signup')}
          >
            <Text style={[styles.tabText, mode === 'signup' && styles.activeTabText]}>
              Sign Up
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, mode === 'login' && styles.activeTab]}
            onPress={() => setMode('login')}
          >
            <Text style={[styles.tabText, mode === 'login' && styles.activeTabText]}>
              Log In
            </Text>
          </Pressable>
        </View>

        {/* Error Message */}
        {!!error && <Text style={styles.error}>{error}</Text>}

        {/* Form Fields */}
        <View style={styles.formContainer}>
          {mode === 'signup' && (
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>👤</Text>
                <TextInput
                  style={styles.textInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Alex Johnson"
                  placeholderTextColor={colors.textLight}
                  autoCapitalize="words"
                  autoComplete="name"
                />
              </View>
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>📧</Text>
              <TextInput
                style={styles.textInput}
                value={email}
                onChangeText={setEmail}
                placeholder="alex@example.com"
                placeholderTextColor={colors.textLight}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.textInput}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textLight}
                secureTextEntry={!showPassword}
                autoComplete={mode === 'signup' ? 'password-new' : 'password'}
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Social Login */}
        <View style={styles.socialContainer}>
          <Text style={styles.socialText}>or continue with</Text>
          <View style={styles.socialButtons}>
            <Pressable style={styles.socialButton} onPress={handleGuest}>
              <Text style={styles.socialButtonText}>🔓 Guest</Text>
            </Pressable>
            <Pressable style={styles.socialButtonDark}>
              <Text style={styles.socialButtonDarkText}>🍎 Apple</Text>
            </Pressable>
          </View>
        </View>

        {/* Submit Button */}
        <AppButton
          label={mode === 'signup' ? 'Create Account →' : 'Sign In →'}
          onPress={handleSubmit}
          loading={busy}
          disabled={busy}
          variant="gradient"
          style={styles.submitButton}
        />

        {/* Terms */}
        {mode === 'signup' && (
          <Text style={styles.terms}>
            By signing up you agree to our Terms & Privacy Policy
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: 25,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: 21,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    ...typography.bodyBold,
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.surface,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  formContainer: {
    marginBottom: spacing.xl,
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  textInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    fontSize: 16,
  },
  eyeButton: {
    padding: spacing.xs,
  },
  eyeIcon: {
    fontSize: 16,
  },
  socialContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  socialText: {
    ...typography.caption,
    color: colors.textLight,
    marginBottom: spacing.md,
  },
  socialButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  socialButton: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  socialButtonText: {
    ...typography.bodyBold,
    color: colors.text,
  },
  socialButtonDark: {
    backgroundColor: colors.text,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  socialButtonDarkText: {
    ...typography.bodyBold,
    color: colors.surface,
  },
  submitButton: {
    marginBottom: spacing.lg,
  },
  terms: {
    ...typography.small,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 18,
  },
});
