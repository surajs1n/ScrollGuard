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
import { Overlay } from '../../modules/Overlay';
import { SG, SgFonts } from '../../theme';
import {
  SgScreen,
  SgButton,
  BackLink,
  StepPill,
  PermissionStatusPill,
} from '../../components/sg';

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
    <SgScreen>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <BackLink onPress={() => navigation.goBack()} />
        <View style={{ marginTop: 16 }}>
          <StepPill n={2} total={3} />
        </View>

        <Text style={styles.headline}>In-app{'\n'}nudges</Text>

        <Text style={styles.body}>
          When you've been on Instagram or YouTube for a while, ScrollGuard can gently tap you on the shoulder — without taking you out of the app.
        </Text>
        <Text style={[styles.body, { marginTop: 14 }]}>
          We use this only to show nudge cards. Nothing else is read or recorded.
        </Text>

        <View style={{ marginTop: 24 }}>
          <PermissionStatusPill granted={!checking && permGranted} />
        </View>

        <View style={{ flex: 1, minHeight: 32 }} />

        {!permGranted ? (
          <>
            <SgButton onPress={handleGrant} label="Open Settings →" />
            <View style={{ height: 12 }} />
            <SgButton onPress={handleContinue} label="Skip — use notification nudges" ghost />
          </>
        ) : (
          <SgButton onPress={handleContinue} label="Continue →" />
        )}

        <Text style={styles.finePrint}>
          Optional. You can skip this and only see the dashboard.
        </Text>
        <View style={{ height: 12 }} />
      </ScrollView>
    </SgScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 20, paddingBottom: 28 },
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
  finePrint: {
    fontFamily: SgFonts.ui,
    fontSize: 11.5,
    color: SG.fg4,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 14,
  },
});
