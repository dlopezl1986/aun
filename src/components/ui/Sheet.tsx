import type { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useBreakpoint } from '@/hooks/useBreakpoint';
import { makeStyles, SurfaceScope } from '@/theme';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  footer?: ReactNode;
}

/**
 * Adaptive modal: bottom sheet on phones, centred dialog on tablet/desktop.
 */
function SheetBase({ visible, onClose, title, subtitle, footer, children }: PropsWithChildren<SheetProps>) {
  const styles = useStyles();
  const { isCompact } = useBreakpoint();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType={isCompact ? 'slide' : 'fade'} onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.backdrop, isCompact ? styles.bottom : styles.center]}
      >
        <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} />
        <View
          style={[styles.panel, isCompact ? styles.panelSheet : styles.panelDialog, { paddingBottom: isCompact ? insets.bottom + 16 : 20 }]}
          accessibilityViewIsModal
        >
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <AppText variant="heading" accessibilityRole="header">
                {title}
              </AppText>
              {subtitle ? (
                <AppText variant="small" tone="textMuted">
                  {subtitle}
                </AppText>
              ) : null}
            </View>
            <IconButton icon="x" label={t('common.close')} onPress={onClose} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body} style={{ flexGrow: 0 }}>
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((t) => ({
  backdrop: { flex: 1 },
  bottom: { justifyContent: 'flex-end' },
  center: { justifyContent: 'center', alignItems: 'center', padding: t.spacing.xxl },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.colors.overlay },
  panel: { backgroundColor: t.colors.surface, boxShadow: t.shadow.raised, maxHeight: '90%' },
  panelSheet: { borderTopLeftRadius: t.radius.xl, borderTopRightRadius: t.radius.xl, paddingTop: t.spacing.md },
  panelDialog: { width: '100%', maxWidth: 520, borderRadius: t.radius.xl, paddingTop: t.spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, paddingHorizontal: t.spacing.xl, paddingBottom: t.spacing.sm },
  body: { paddingHorizontal: t.spacing.xl, paddingVertical: t.spacing.sm, gap: t.spacing.lg },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.xl,
    paddingTop: t.spacing.md,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
    marginTop: t.spacing.sm,
  },
}));

/** Sheets are their own surface: normal palette even when opened from the dark canvas. */
export function Sheet(props: PropsWithChildren<SheetProps>) {
  return (
    <SurfaceScope>
      <SheetBase {...props} />
    </SurfaceScope>
  );
}
