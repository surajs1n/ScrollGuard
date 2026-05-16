import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { colors, spacing, font } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <View style={styles.hero}>
        <Text style={styles.emoji}>🛡️</Text>
        <Text style={styles.title}>ScrollGuard</Text>
        <Text style={styles.tagline}>
          Not a blocker.{'\n'}A companion.
        </Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.bodyText}>
          Most apps punish you for scrolling.{'\n\n'}
          ScrollGuard earns your trust first — watching silently for a week,
          then nudging gently, then helping you redirect your attention to
          things that actually matter.{'\n\n'}
          No hard stops. No guilt trips. Just honest progress.
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('PermissionUsageStats')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Get started →</Text>
        </TouchableOpacity>
        <Text style={styles.privacyNote}>
          Everything stays on your device. No account. No server.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  hero: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 56,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: font.xxl,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: font.lg,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 28,
  },
  body: {
    flex: 3,
    justifyContent: 'center',
  },
  bodyText: {
    fontSize: font.md,
    color: colors.textSecondary,
    lineHeight: 26,
    textAlign: 'left',
  },
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: spacing.xl,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: font.md,
    fontWeight: '600',
  },
  privacyNote: {
    color: colors.textSecondary,
    fontSize: font.xs,
    textAlign: 'center',
  },
});
