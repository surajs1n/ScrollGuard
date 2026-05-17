import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { SG, SgFonts } from '../../theme';
import { useTheme } from '../../ThemeContext';
import {
  SgScreen,
  SgMark,
  SgButton,
  PrivacyFooter,
} from '../../components/sg';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

const BEATS = [
  { dot: SG.gentle,   tag: '01', title: 'Observes silently', sub: 'For a few days. No nudges.' },
  { dot: SG.balanced, tag: '02', title: 'Nudges gently',     sub: 'A tap on the shoulder — never a block.' },
  { dot: SG.strict,   tag: '03', title: 'Redirects attention', sub: 'Toward offline things you chose.' },
];

export default function WelcomeScreen({ navigation }: Props) {
  const { accent } = useTheme();

  return (
    <SgScreen>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <View style={styles.brand}>
          <SgMark size={34} accent={accent} />
          <Text style={styles.wordmark}>ScrollGuard</Text>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>A QUIET COMPANION FOR YOUR ATTENTION</Text>
          <Text style={styles.headline}>
            {'Not a blocker.\n'}
            <Text style={[styles.headlineItalic, { color: SG.fg2 }]}>A companion.</Text>
          </Text>
        </View>

        {/* Body copy */}
        <Text style={styles.body}>
          Most apps punish you for scrolling. ScrollGuard earns your trust first — watching quietly for a few days, then nudging gently, then helping you redirect attention to things that actually matter.
        </Text>
        <Text style={[styles.body, { color: SG.fg3, marginTop: 14 }]}>
          No hard stops. No guilt trips. Just honest progress.
        </Text>

        {/* Three-beat preview */}
        <View style={styles.beats}>
          {BEATS.map((row) => (
            <View key={row.tag} style={styles.beatRow}>
              <View style={[styles.beatDot, { backgroundColor: row.dot }]} />
              <Text style={styles.beatTag}>{row.tag}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.beatTitle}>{row.title}</Text>
                <Text style={styles.beatSub}>{row.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ flex: 1, minHeight: 28 }} />

        {/* CTA */}
        <SgButton
          onPress={() => navigation.navigate('PermissionUsageStats')}
          label="Get started →"
        />

        <View style={{ height: 16 }} />
        <PrivacyFooter text="Everything stays on your device. No account. No server." />
        <View style={{ height: 8 }} />
      </ScrollView>
    </SgScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    padding: 26,
    paddingTop: 32,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  wordmark: {
    fontFamily: SgFonts.uiSemiBold,
    fontSize: 19,
    color: SG.fg,
    letterSpacing: -0.5,
  },
  hero: { marginTop: 48 },
  eyebrow: {
    fontFamily: SgFonts.mono,
    fontSize: 10.5,
    color: SG.fg3,
    letterSpacing: 1.2,
  },
  headline: {
    fontFamily: SgFonts.display,
    fontSize: 50,
    color: SG.fg,
    letterSpacing: -1.2,
    lineHeight: 52,
    marginTop: 18,
  },
  headlineItalic: {
    fontFamily: SgFonts.displayItalic,
    fontSize: 50,
    letterSpacing: -1.2,
    lineHeight: 52,
  },
  body: {
    fontFamily: SgFonts.ui,
    fontSize: 14.5,
    color: SG.fg2,
    lineHeight: 22,
    letterSpacing: -0.1,
    marginTop: 28,
  },
  beats: {
    marginTop: 28,
    gap: 12,
  },
  beatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  beatDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    flexShrink: 0,
  },
  beatTag: {
    fontFamily: SgFonts.mono,
    fontSize: 10.5,
    color: SG.fg4,
    width: 18,
  },
  beatTitle: {
    fontFamily: SgFonts.uiMedium,
    fontSize: 13.5,
    color: SG.fg,
  },
  beatSub: {
    fontFamily: SgFonts.ui,
    fontSize: 12,
    color: SG.fg3,
    marginTop: 1,
  },
});
