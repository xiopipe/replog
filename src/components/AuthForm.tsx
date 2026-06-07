import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { useAuth } from '@/lib/auth';
import { colors, radius, spacing, TOUCH_TARGET, typography } from '@/lib/theme';

type Props = {
  mode: 'login' | 'signup';
};

export function AuthForm({ mode }: Props) {
  const { t } = useTranslation();
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isLogin = mode === 'login';

  async function submit() {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
        setInfo(t('auth.check_email'));
      }
    } catch {
      setError(t(isLogin ? 'auth.error_invalid_credentials' : 'auth.error_signup_failed'));
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    setError(null);
    try {
      await signInWithGoogle();
    } catch {
      setError(t('common.error_generic'));
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Text style={styles.title}>{t(isLogin ? 'auth.login_title' : 'auth.signup_title')}</Text>

          <View style={styles.field}>
            <Text style={styles.label}>{t('auth.email')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder={t('auth.email_placeholder')}
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel={t('auth.email')}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('auth.password')}</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder={t('auth.password_placeholder')}
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel={t('auth.password')}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {info ? <Text style={styles.info}>{info}</Text> : null}

          <Button
            label={t(isLogin ? 'auth.login_button' : 'auth.signup_button')}
            onPress={submit}
            loading={loading}
            style={styles.action}
          />
          <Button
            label={t('auth.google_button')}
            onPress={google}
            variant="secondary"
            style={styles.action}
          />

          <Link href={isLogin ? '/(auth)/sign-up' : '/(auth)/login'} style={styles.link}>
            <Text style={styles.linkText}>{t(isLogin ? 'auth.to_signup' : 'auth.to_login')}</Text>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  title: { ...typography.title, color: colors.textPrimary, marginBottom: spacing.lg },
  field: { gap: spacing.xs },
  label: { ...typography.label, color: colors.textSecondary },
  input: {
    minHeight: TOUCH_TARGET,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    ...typography.body,
  },
  action: { marginTop: spacing.sm },
  error: { ...typography.label, color: colors.error },
  info: { ...typography.label, color: colors.success },
  link: { marginTop: spacing.lg, alignSelf: 'center' },
  linkText: { ...typography.body, color: colors.accent },
});
