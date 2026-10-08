import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { useTranslation } from 'react-i18next';

import { makeStyles, SurfaceScope, useTheme } from '@/theme';
import { AppText } from './AppText';
import { interaction } from './interaction';
import { Icon, type IconName } from './Icon';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string | null;
  hint?: string;
  leftIcon?: IconName;
  /** Makes the left icon a button (e.g. the calendar of a date field). */
  onLeftIconPress?: () => void;
  leftIconLabel?: string;
  /** Shows an eye toggle for password fields. */
  revealable?: boolean;
  compact?: boolean;
}

const TextFieldBase = forwardRef<TextInput, TextFieldProps>(function TextFieldBase(
  {
    label,
    error,
    hint,
    leftIcon,
    onLeftIconPress,
    leftIconLabel,
    revealable,
    secureTextEntry,
    compact,
    onFocus,
    onBlur,
    autoFocus,
    ...input
  },
  ref,
) {
  const inputRef = useRef<TextInput>(null);
  useImperativeHandle(ref, () => inputRef.current as TextInput);
  // Native `autoFocus` is unreliable inside modals (esp. on web, where the
  // modal mounts before it becomes visible), so focus after mount instead.
  useEffect(() => {
    if (!autoFocus) return;
    const id = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(id);
  }, [autoFocus]);
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.borderStrong;

  return (
    <View style={styles.wrapper}>
      {label ? (
        <AppText variant="smallStrong" tone="text" style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <View style={[styles.field, compact && styles.compact, { borderColor }, focused && styles.focused]}>
        {leftIcon && onLeftIconPress ? (
          <Pressable
            onPress={onLeftIconPress}
            accessibilityRole="button"
            accessibilityLabel={leftIconLabel}
            hitSlop={10}
            style={(s) => ({
              width: 30,
              height: 30,
              marginLeft: -6,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: interaction(s).hovered || interaction(s).pressed ? colors.primarySoft : 'transparent',
            })}
          >
            <Icon name={leftIcon} size={19} color={colors.primary} />
          </Pressable>
        ) : leftIcon ? (
          <Icon name={leftIcon} size={18} color={colors.textSubtle} />
        ) : null}
        <TextInput
          ref={inputRef}
          placeholderTextColor={colors.textSubtle}
          secureTextEntry={secureTextEntry && !revealed}
          accessibilityLabel={label ?? input.placeholder}
          accessibilityHint={error ?? hint}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={styles.input}
          {...input}
        />
        {revealable && secureTextEntry ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? t('common.hidePassword') : t('common.showPassword')}
            hitSlop={10}
          >
            <Icon name={revealed ? 'eye-off' : 'eye'} size={18} color={colors.textSubtle} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="small" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="small" tone="textSubtle">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

const useStyles = makeStyles((t) => ({
  wrapper: { gap: t.spacing.xs, alignSelf: 'stretch' },
  label: { marginBottom: t.spacing.xxs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    minHeight: 46,
    paddingHorizontal: t.spacing.md,
    borderWidth: 1,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.surface,
  },
  compact: { minHeight: 40 },
  focused: { boxShadow: `0px 0px 0px 3px ${t.colors.primarySoft}` },
  input: {
    flex: 1,
    alignSelf: 'stretch',
    fontFamily: t.fontFamily.regular,
    fontSize: 15,
    color: t.colors.text,
    paddingVertical: t.spacing.sm,
    outlineStyle: 'none',
  } as object,
}));

/** Fields have their own background: always drawn with the normal (non-canvas) palette. */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(props, ref) {
  return (
    <SurfaceScope>
      <TextFieldBase ref={ref} {...props} />
    </SurfaceScope>
  );
});
