import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

import AppButton from '../components/AppButton';
import GoogleLogo from '../components/GoogleLogo';
import AppleLogo from '../components/AppleLogo';
import { colors, spacing, typography, borderRadius } from '../theme';
import { googleConfig } from '../config/google';
import {
  friendlyAuthError,
  signInWithEmail,
  signInWithGoogleIdToken,
  registerWithEmail,
} from '../services/auth';

// Required for the OAuth popup to dismiss correctly.
WebBrowser.maybeCompleteAuthSession();

type AuthMode = 'login' | 'signup';

export default function AuthScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const initialMode: AuthMode = route.params?.mode === 'login' ? 'login' : 'signup';

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: googleConfig.webClientId,
    iosClientId: googleConfig.iosClientId,
    androidClientId: googleConfig.androidClientId || undefined,
  });

  // Native Google Sign-In (Android/iOS) uses the native SDK — no fragile web
  // redirect (which is the usual cause of redirect_uri/DEVELOPER_ERROR on
  // standalone builds). It needs the WEB client ID to mint a Firebase-usable
  // idToken; the Android OAuth client + SHA-1 handle the native handshake.
  useEffect(() => {
    if (Platform.OS !== 'web') {
      GoogleSignin.configure({ webClientId: googleConfig.webClientId });
    }
  }, []);

  // Debug: log the exact OAuth client ID and redirect URI being sent to Google.
  // If sign-in fails with "invalid_client / OAuth client was not found", this
  // tells you which client ID to verify in Google Cloud Console and which
  // redirect URI must be whitelisted on that client.
  useEffect(() => {
    if (request) {
      console.log('[GoogleAuth] clientId:', request.clientId);
      console.log('[GoogleAuth] redirectUri:', request.redirectUri);
    }
  }, [request]);

  // Handle the Google OAuth response.
  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params?.id_token;
      if (idToken) {
        setBusy(true);
        signInWithGoogleIdToken(idToken)
          .catch((e) => setError(friendlyAuthError(e)))
          .finally(() => setBusy(false));
      }
    } else if (response?.type === 'error') {
      const detail =
        response.error?.code ||
        response.params?.error_description ||
        response.params?.error ||
        '';
      setError(
        detail
          ? `Google sign-in failed: ${detail}`
          : 'Google sign-in was cancelled or failed.'
      );
    }
  }, [response]);

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

  const handleGoogle = async () => {
    setError('');

    // Web keeps the expo-auth-session redirect flow.
    if (Platform.OS === 'web') {
      if (!request) {
        Alert.alert('Google sign-in unavailable', 'Google client IDs are not configured yet.');
        return;
      }
      await promptAsync();
      return;
    }

    // Native: use the Google Sign-In SDK directly (Android OAuth client + SHA-1,
    // no web redirect). signInWithGoogleIdToken handles Firebase + backend and
    // is shared with the web flow, so nothing downstream changes.
    try {
      setBusy(true);
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result: any = await GoogleSignin.signIn();
      // v13+: { type: 'success', data: { idToken } }. Older: { idToken }.
      let idToken: string | null = result?.data?.idToken ?? result?.idToken ?? null;
      if (!idToken) {
        try {
          idToken = (await GoogleSignin.getTokens())?.idToken ?? null;
        } catch {
          /* no token available */
        }
      }
      if (!idToken) return; // user cancelled or dismissed the picker
      await signInWithGoogleIdToken(idToken);
    } catch (e: any) {
      // Silently ignore explicit cancellations / in-progress taps.
      if (e?.code === statusCodes?.SIGN_IN_CANCELLED || e?.code === statusCodes?.IN_PROGRESS) return;
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleApple = () => {
    // Apple Sign In requires an Apple Developer account + expo-apple-authentication
    // and only works on iOS devices. Wire it up once those are set up.
    Alert.alert('Apple Sign In', 'Apple sign-in isn\'t set up yet.');
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
            <Pressable
              style={[styles.socialButton, busy && styles.socialButtonDisabled]}
              onPress={handleGoogle}
              disabled={busy}
            >
              <GoogleLogo size={18} />
              <Text style={styles.socialButtonText}>Google</Text>
            </Pressable>
            <Pressable
              style={[styles.socialButtonDark, busy && styles.socialButtonDisabled]}
              onPress={handleApple}
              disabled={busy}
            >
              <AppleLogo size={18} color={colors.surface} />
              <Text style={styles.socialButtonDarkText}>Apple</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.text,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  socialButtonDarkText: {
    ...typography.bodyBold,
    color: colors.surface,
  },
  socialButtonDisabled: {
    opacity: 0.5,
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
