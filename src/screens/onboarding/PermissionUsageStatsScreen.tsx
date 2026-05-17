import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  AppState,
  AppStateStatus,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { UsageStats } from '../../modules/UsageStats';
import { SG, SgFonts } from '../../theme';
import {
  SgScreen,
  SgButton,
  StepPill,
  PermissionStatusPill,
} from '../../components/sg';

type Props = NativeStackScreenProps<RootStackParamList, 'PermissionUsageStats'>;

export default function PermissionUsageStatsScreen({ navigation }: Props) {
  const [permGranted, setPermGranted] = useState(false);
  const [checking, setChecking] = useState(true);

  const checkPerm = async () => {
    const granted = await UsageStats.hasPermission();
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
    await UsageStats.openPermissionSettings();
  };

  const handleContinue = () => {
    navigation.navigate('PermissionOverlay');
  };

  return (
    <SgScreen>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: 32 }} />
        <StepPill n={1} total={3} />

        <Text style={styles.headline}>Screen-time{'\n'}access</Text>

        <Text style={styles.body}>
          ScrollGuard reads how much time you spend in each app. The data never leaves your phone — it's stored only on your device and used to show you your own progress.
        </Text>

        {/* Pathway block */}
        <View style={styles.pathwayBox}>
          <Text style={styles.pathwayLabel}>WHERE TO ENABLE</Text>
          <Text style={styles.pathwayText}>
            Settings → Digital Wellbeing → Apps with Usage Access → ScrollGuard
          </Text>
        </View>

        <View style={{ marginTop: 24 }}>
          <PermissionStatusPill granted={!checking && permGranted} />
        </View>

        <View style={{ flex: 1, minHeight: 32 }} />

        {!permGranted ? (
          <>
            <SgButton onPress={handleGrant} label="Open Settings →" />
            <View style={{ height: 12 }} />
            <SgButton onPress={handleContinue} label="Skip for now" ghost />
          </>
        ) : (
          <SgButton onPress={handleContinue} label="Continue →" />
        )}

        <Text style={styles.finePrint}>
          Required. ScrollGuard can't see anything else — only time per app.
        </Text>
        <View style={{ height: 12 }} />
      </ScrollView>
    </SgScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 28, paddingBottom: 28 },
  headline: {
    fontFamily: SgFonts.display,
    fontSize: 40,
    color: SG.fg,
    letterSpacing: -0.8,
    lineHeight: 44,
    marginTop: 20,
  },
  body: {
    fontFamily: SgFonts.ui,
    fontSize: 15,
    color: SG.fg2,
    lineHeight: 23,
    letterSpacing: -0.1,
    marginTop: 20,
  },
  pathwayBox: {
    marginTop: 20,
    padding: 16,
    backgroundColor: SG.bg2,
    borderWidth: 1,
    borderColor: SG.lineSoft,
    borderRadius: SG.rMd,
  },
  pathwayLabel: {
    fontFamily: SgFonts.mono,
    fontSize: 10,
    color: SG.fg3,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  pathwayText: {
    fontFamily: SgFonts.mono,
    fontSize: 12.5,
    color: SG.fg2,
    lineHeight: 20,
  },
  finePrint: {
    fontFamily: SgFonts.ui,
    fontSize: 11.5,
    color: SG.fg4,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 14,
  },
});
