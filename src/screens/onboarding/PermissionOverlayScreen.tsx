import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  AppState,
  AppStateStatus,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Overlay } from '../../modules/Overlay';
import { colors, spacing, font } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PermissionOverlay'>;

export default function PermissionOverlayScreen({ navigation }: Props) {
  const [permGranted, setPermGranted] = useState(false);
  const [checking, setChecking] = useState(true);

  const checkPerm = async () => {
    const granted = await Overlay.hasOverlayPermission();
    setPermGranted(granted);
    setChecking(false);
  };

  useEffect(() => {
    checkPerm();
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') checkPerm();
    });
    return () => sub.remove();
  }, []);

  const handleGrant = async () => {
    await Overlay.requestOverlayPermission();
  };

  const handleContinue = () => {
    navigation.navigate('AppSelection');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.step}>Step 2 of 3</Text>
        <Text style={styles.title}>In-app nudges</Text>
        <Text style={styles.description}>
          When you've been on Instagram or YouTube for a while, ScrollGuard can
          gently tap you on the shoulder — without taking you out of the app.
          {'\n\n'}
          To do this, Android needs to allow ScrollGuard to draw a small card
          on top of other apps.
          {'\n\n'}
          This permission is used only to show nudge cards — nothing else is
          read or recorded.
        </Text>

        <View style={styles.permBox}>
          <Text style={styles.permIcon}>{permGranted ? '✅' : '⏳'}</Text>
          <Text style={styles.permStatus}>
            {checking ? 'Checking…' : permGranted ? 'Permission granted' : 'Not granted yet'}
          </Text>
        </View>

        {!permGranted && (
          <View style={styles.noteBox}>
            <Text style={styles.noteText}>
              You can still use ScrollGuard without this. Nudges will appear as
              notifications instead of overlay cards.
            </Text>
          </View>
        )}

        <View style={styles.footer}>
          {!permGranted ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={handleGrant} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Open Settings</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.primaryBtn} onPress={handleContinue} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Continue →</Text>
            </TouchableOpacity>
          )}
          {!permGranted && (
            <TouchableOpacity style={styles.skipBtn} onPress={handleContinue}>
              <Text style={styles.skipText}>Skip — use notification nudges instead</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
  backBtn: { marginBottom: spacing.md },
  backText: { color: colors.accent, fontSize: font.md, fontWeight: '600' },
  step: { color: colors.accent, fontSize: font.sm, fontWeight: '600', marginBottom: spacing.sm },
  title: { fontSize: font.xl, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.lg },
  description: { fontSize: font.md, color: colors.textSecondary, lineHeight: 26 },
  permBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  permIcon: { fontSize: font.lg },
  permStatus: { fontSize: font.md, color: colors.textPrimary },
  noteBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  noteText: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 20 },
  footer: { marginTop: spacing.xl, paddingBottom: spacing.sm },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  primaryBtnText: { color: '#fff', fontSize: font.md, fontWeight: '600' },
  skipBtn: { paddingVertical: spacing.sm, alignItems: 'center' },
  skipText: { color: colors.textSecondary, fontSize: font.sm },
});
