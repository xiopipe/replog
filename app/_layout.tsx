// Polyfills must load before any other code (uuid + Supabase need these).
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/lib/auth';
import '@/lib/i18n';
import { colors } from '@/lib/theme';
import { OfflineBanner } from '@/features/sync/OfflineBanner';

function RootNavigator() {
  const { session, initializing } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, initializing, segments, router]);

  if (initializing) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.navigatorWrapper}>
      {/* TKT-0048: Global offline banner — shown below status bar on all screens */}
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="catalog/index" />
        <Stack.Screen name="catalog/[id]" />
        <Stack.Screen name="catalog/create" />
        <Stack.Screen name="routines/index" />
        <Stack.Screen name="routines/editor" />
        <Stack.Screen name="plan/index" />
        <Stack.Screen name="plan/templates" />
        {/* Session routes — tab bar intentionally hidden (not inside (tabs)) */}
        <Stack.Screen name="session/[id]" />
        <Stack.Screen name="session/summary/[id]" />
        <Stack.Screen name="session/retroactive" />
        {/* History detail route */}
        <Stack.Screen name="history/[id]" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  navigatorWrapper: {
    flex: 1,
  },
});
