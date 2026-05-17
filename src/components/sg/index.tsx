import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Svg, {
  Defs,
  RadialGradient,
  Stop,
  Rect,
  Path,
  Line,
  Circle,
} from 'react-native-svg';
import { SG, SgFonts } from '../../theme';
import { useTheme } from '../../ThemeContext';

const { width: W, height: H } = Dimensions.get('window');

// ── ScrollGuard logomark ──────────────────────────────────────

interface SgMarkProps {
  size?: number;
  accent?: string;
  outline?: string;
}

export function SgMark({ size = 24, accent = SG.balanced, outline = SG.fg }: SgMarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Path
        d="M 512.0 89.6 C 665.6 89.6 793.6 117.8 896.0 161.3 C 896.0 460.8 870.4 716.8 512.0 934.4 C 153.6 716.8 128.0 460.8 128.0 161.3 C 230.4 117.8 358.4 89.6 512.0 89.6 Z"
        stroke={outline}
        strokeWidth={41}
        strokeLinejoin="round"
        fill="none"
      />
      <Line
        x1={230.4} y1={512} x2={793.6} y2={512}
        stroke={accent}
        strokeWidth={41}
        strokeLinecap="round"
      />
      <Circle cx={512} cy={384} r={43.52} fill={accent} />
    </Svg>
  );
}

// ── Radial gradient bloom (background layer) ──────────────────

const SgGradient = React.memo(function SgGradient({ accent }: { accent: string }) {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Svg width={W} height={H}>
        <Defs>
          <RadialGradient
            id="sgBloom"
            cx={W / 2}
            cy={0}
            rx={W * 1.2}
            ry={H * 0.55}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor={accent} stopOpacity="0.10" />
            <Stop offset="60%" stopColor={accent} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} fill="url(#sgBloom)" />
      </Svg>
    </View>
  );
});

// ── SgScreen — base screen wrapper ───────────────────────────

interface SgScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function SgScreen({ children, style }: SgScreenProps) {
  const { accent } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: SG.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={SG.bg} />
      <SgGradient accent={accent} />
      <SafeAreaView style={[{ flex: 1 }, style]}>
        {children}
      </SafeAreaView>
    </View>
  );
}

// ── SgButton — primary pill button ───────────────────────────

interface SgButtonProps {
  onPress: () => void;
  label: string;
  ghost?: boolean;
  disabled?: boolean;
  accentOverride?: string;
}

export function SgButton({ onPress, label, ghost, disabled, accentOverride }: SgButtonProps) {
  const { accent } = useTheme();
  const bg = accentOverride ?? accent;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[
        btnStyles.btn,
        ghost
          ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: SG.line }
          : { backgroundColor: bg },
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text style={[btnStyles.label, { color: ghost ? SG.fg2 : '#fff' }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const btnStyles = StyleSheet.create({
  btn: {
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  label: {
    fontFamily: SgFonts.uiMedium,
    fontSize: 15,
    letterSpacing: -0.1,
  },
});

// ── BackLink ──────────────────────────────────────────────────

interface BackLinkProps {
  onPress: () => void;
  label?: string;
}

export function BackLink({ onPress, label = 'Back' }: BackLinkProps) {
  const { accent } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} style={backStyles.btn} activeOpacity={0.7}>
      <Text style={[backStyles.chevron, { color: accent }]}>‹</Text>
      <Text style={[backStyles.label, { color: accent }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const backStyles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, alignSelf: 'flex-start' },
  chevron: { fontSize: 22, lineHeight: 24, fontWeight: '300' },
  label: { fontFamily: SgFonts.uiMedium, fontSize: 14 },
});

// ── StepPill — onboarding progress indicator ──────────────────

interface StepPillProps {
  n: number;
  total?: number;
}

export function StepPill({ n, total = 3 }: StepPillProps) {
  const { accent } = useTheme();
  return (
    <View style={stepStyles.row}>
      <View style={stepStyles.track}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[
              stepStyles.dot,
              { width: i < n ? 14 : 6, backgroundColor: i < n ? accent : SG.line },
            ]}
          />
        ))}
      </View>
      <Text style={stepStyles.label}>
        {'STEP ' + String(n).padStart(2, '0') + ' OF ' + String(total).padStart(2, '0')}
      </Text>
    </View>
  );
}

const stepStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderWidth: 1,
    borderColor: SG.line,
    borderRadius: 999,
  },
  dot: { height: 6, borderRadius: 999 },
  label: { fontFamily: SgFonts.mono, fontSize: 11, color: SG.fg3, letterSpacing: 0.5 },
});

// ── PrivacyFooter ─────────────────────────────────────────────

export function PrivacyFooter({ text = 'All data stays on your device. Nothing is sent anywhere.' }: { text?: string }) {
  return (
    <View style={privacyStyles.row}>
      <Text style={privacyStyles.lock}>🔒</Text>
      <Text style={privacyStyles.text}>{text}</Text>
    </View>
  );
}

const privacyStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24 },
  lock: { fontSize: 12, opacity: 0.6 },
  text: { fontFamily: SgFonts.ui, fontSize: 12, color: SG.fg4, lineHeight: 17, flex: 1 },
});

// ── PermissionStatusPill ──────────────────────────────────────

export function PermissionStatusPill({ granted }: { granted: boolean }) {
  return (
    <View style={[
      permStyles.pill,
      {
        backgroundColor: granted ? SG.gentleSoft : SG.surface,
        borderColor: granted ? SG.gentleLine : SG.lineSoft,
      },
    ]}>
      <View style={[permStyles.icon, { backgroundColor: granted ? SG.gentle : SG.surface2 }]}>
        <Text style={{ fontSize: 13, color: granted ? '#0a1f15' : SG.fg3, fontWeight: '700' }}>
          {granted ? '✓' : '!'}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={permStyles.title}>
          {granted ? 'Permission granted' : 'Permission required'}
        </Text>
        <Text style={permStyles.sub}>
          {granted
            ? "You're set — ScrollGuard can read your screen time."
            : 'Tap below to open Android settings.'}
        </Text>
      </View>
    </View>
  );
}

const permStyles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: SG.rMd, borderWidth: 1 },
  icon: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  title: { fontFamily: SgFonts.uiMedium, fontSize: 14, color: SG.fg, lineHeight: 18 },
  sub: { fontFamily: SgFonts.ui, fontSize: 12, color: SG.fg3, marginTop: 2 },
});

// ── SgCard ────────────────────────────────────────────────────

interface SgCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  overflow?: 'hidden' | 'visible';
}

export function SgCard({ children, style, overflow }: SgCardProps) {
  return (
    <View style={[cardStyles.card, overflow ? { overflow } : {}, style]}>
      {children}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: SG.surface,
    borderWidth: 1,
    borderColor: SG.lineSoft,
    borderRadius: SG.rLg,
  },
});

// ── SgEyebrow — uppercase mono label ─────────────────────────

interface EyebrowProps {
  children: React.ReactNode;
  color?: string;
  style?: TextStyle;
}

export function SgEyebrow({ children, color, style }: EyebrowProps) {
  return (
    <Text style={[eyebrowStyles.text, color ? { color } : {}, style]}>
      {String(children).toUpperCase()}
    </Text>
  );
}

const eyebrowStyles = StyleSheet.create({
  text: {
    fontFamily: SgFonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.2,
    color: SG.fg3,
  },
});
