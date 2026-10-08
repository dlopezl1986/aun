import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { makeStyles } from '@/theme';

/**
 * Cross-platform dialogs. `Alert.alert` is a no-op on react-native-web, so we
 * render our own accessible modal everywhere for consistent behaviour.
 */
interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface PromptOptions {
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  /** Red confirm button for irreversible actions. */
  destructive?: boolean;
}

interface DialogApi {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

type ActiveDialog =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'prompt'; options: PromptOptions; resolve: (v: string | null) => void };

const DialogContext = createContext<DialogApi | null>(null);

export function DialogProvider({ children }: PropsWithChildren) {
  const [active, setActive] = useState<ActiveDialog | null>(null);
  const [text, setText] = useState('');
  const styles = useStyles();
  const { t } = useTranslation();

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setActive({ kind: 'confirm', options, resolve })),
    [],
  );
  const prompt = useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setText(options.initialValue ?? '');
        setActive({ kind: 'prompt', options, resolve });
      }),
    [],
  );

  const close = (accepted: boolean) => {
    const current = active;
    if (!current) return;
    if (current.kind === 'confirm') current.resolve(accepted);
    else current.resolve(accepted && text.trim() ? text.trim() : null);
    setActive(null);
  };

  const api = useMemo(() => ({ confirm, prompt }), [confirm, prompt]);
  const options = active?.options;
  const destructive = !!active?.options.destructive;

  return (
    <DialogContext.Provider value={api}>
      {children}
      {/* Mounted only while open so it stacks ABOVE any sheet already on screen
          (on web each Modal is a portal: the last mounted one is on top). */}
      {active ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => close(false)} statusBarTranslucent>
          <View style={styles.backdrop}>
            <Pressable style={styles.scrim} onPress={() => close(false)} accessibilityLabel={t('common.cancel')} />
            {options ? (
              <View style={styles.dialog} accessibilityViewIsModal accessibilityRole="alert">
                <AppText variant="heading" accessibilityRole="header">
                  {options.title}
                </AppText>
                {options.message ? (
                  <AppText variant="body" tone="textMuted">
                    {options.message}
                  </AppText>
                ) : null}
                {active?.kind === 'prompt' ? (
                  <TextField
                    label={active.options.label}
                    placeholder={active.options.placeholder}
                    value={text}
                    onChangeText={setText}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={(e) => {
                      // On web the Enter keystroke would otherwise re-activate the
                      // button that opened the dialog once focus returns to it.
                      (e as unknown as { preventDefault?: () => void }).preventDefault?.();
                      setTimeout(() => close(true), 0);
                    }}
                  />
                ) : null}
                <View style={styles.actions}>
                  <Button
                    label={(active?.kind === 'confirm' && active.options.cancelLabel) || t('common.cancel')}
                    variant="ghost"
                    onPress={() => close(false)}
                  />
                  <Button
                    label={options.confirmLabel ?? t('common.accept')}
                    variant={destructive ? 'danger' : 'primary'}
                    onPress={() => close(true)}
                    disabled={active?.kind === 'prompt' && !text.trim()}
                  />
                </View>
              </View>
            ) : null}
          </View>
        </Modal>
      ) : null}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within DialogProvider');
  return ctx;
}

const useStyles = makeStyles((t) => ({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.spacing.xl },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.colors.overlay },
  dialog: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.xl,
    padding: t.spacing.xl,
    gap: t.spacing.md,
    boxShadow: t.shadow.raised,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: t.spacing.sm, marginTop: t.spacing.sm },
}));
