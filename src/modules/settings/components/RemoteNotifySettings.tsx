import { useState } from 'react';
import { Linking, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import * as Clipboard from 'expo-clipboard';

import { TimeField } from '@/components/forms/DateTimeFields';
import { useToast } from '@/components/feedback/ToastProvider';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { InfoNote } from '@/components/ui/InfoNote';
import { LoadingState } from '@/components/ui/States';
import { TextField } from '@/components/ui/TextField';
import { Toggle } from '@/components/ui/Toggle';
import { appConfig } from '@/config/featureFlags';
import { useNotifySettings, useSaveNotifySettings } from '@/services/remoteNotify/hooks';
import { useServices } from '@/services/ServicesProvider';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/theme';
import type { NotifySettings } from '@/services/remoteNotify/firebaseNotify';

function Row({ title, hint, value, onChange }: { title: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const { spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 }}>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong">{title}</AppText>
        {hint ? (
          <AppText variant="caption" tone="textMuted">
            {hint}
          </AppText>
        ) : null}
      </View>
      <Toggle value={value} onValueChange={onChange} label={title} />
    </View>
  );
}

/** Settings body, inside the card (reads the card palette). */
function Body({ settings }: { settings: NotifySettings }) {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
  const services = useServices();
  const client = useQueryClient();
  const save = useSaveNotifySettings();
  const [waiting, setWaiting] = useState(false);
  const toast = useToast();
  const linked = !!settings.telegramChatId;
  const bot = appConfig.telegramBot;
  const refresh = () => client.invalidateQueries({ queryKey: ['u', services.userId, 'notify'] });

  const connectTelegram = async () => {
    if (!services.notify) return;
    const code = await services.notify.startTelegramLink(i18n.language);
    setWaiting(true);
    await Linking.openURL(`https://t.me/${bot}?start=${code}`);
    void refresh();
  };
  const disconnectTelegram = async () => {
    await services.notify?.disconnectTelegram(i18n.language);
    setWaiting(false);
    void refresh();
  };

  return (
    <View style={{ gap: spacing.md }}>
      <AppText variant="small" tone="textMuted">
        {t('remote.settings.intro')}
      </AppText>

      {/* E-mail */}
      <Row
        title={t('remote.settings.emailDaily')}
        hint={settings.email ? t('remote.settings.emailTo', { email: settings.email }) : t('remote.settings.noEmail')}
        value={settings.emailDaily}
        onChange={(v) => save.mutate({ emailDaily: v })}
      />
      {settings.emailDaily ? (
        <TimeField
          label={t('remote.settings.emailTime')}
          value={settings.emailTime}
          onChange={(time) => time !== settings.emailTime && save.mutate({ emailTime: time })}
        />
      ) : null}

      <Divider />

      {/* Telegram */}
      <AppText variant="bodyStrong">Telegram</AppText>
      {!bot ? (
        <InfoNote icon="send" title={t('remote.settings.botPendingTitle')} description={t('remote.settings.botPending')} />
      ) : linked ? (
        <>
          <AppText variant="small" tone="success">
            {t('remote.settings.telegramLinked', { name: settings.telegramName || 'Telegram' })}
          </AppText>
          <Row
            title={t('remote.settings.telegramAlerts')}
            hint={t('remote.settings.telegramAlertsHint')}
            value={settings.telegramAlerts}
            onChange={(v) => save.mutate({ telegramAlerts: v })}
          />
          <Row
            title={t('remote.settings.telegramDaily')}
            value={settings.telegramDaily}
            onChange={(v) => save.mutate({ telegramDaily: v })}
          />
          {settings.telegramDaily ? (
            <TimeField
              label={t('remote.settings.telegramTime')}
              value={settings.telegramTime}
              onChange={(time) => time !== settings.telegramTime && save.mutate({ telegramTime: time })}
            />
          ) : null}
          <Button label={t('remote.settings.disconnect')} icon="x" variant="ghost" onPress={() => void disconnectTelegram()} />
        </>
      ) : (
        <>
          <AppText variant="small" tone="textMuted">
            {waiting ? t('remote.settings.telegramWaiting') : t('remote.settings.telegramHint')}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Button label={t('remote.settings.connectTelegram')} icon="send" onPress={() => void connectTelegram()} />
            {waiting || settings.telegramLinkCode ? (
              <Button label={t('remote.settings.check')} icon="refresh-cw" variant="secondary" onPress={() => void refresh()} />
            ) : null}
          </View>
          {settings.telegramLinkCode ? (
            // Backup: if Telegram opened the chat without sending the code (chat already open), send it by hand.
            <View style={{ gap: spacing.sm }}>
              <AppText variant="small" tone="textMuted">
                {t('remote.settings.manualHint', { bot: `@${bot}` })}
              </AppText>
              <TextField value={`/start ${settings.telegramLinkCode}`} editable={false} selectTextOnFocus />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                <Button
                  label={t('remote.settings.copyCode')}
                  icon="copy"
                  variant="secondary"
                  onPress={() =>
                    void Clipboard.setStringAsync(`/start ${settings.telegramLinkCode}`).then(() => toast.show(t('remote.settings.copied')))
                  }
                />
                <Button
                  label={t('remote.settings.openBot')}
                  icon="send"
                  variant="ghost"
                  onPress={() => void Linking.openURL(`https://t.me/${bot}`)}
                />
              </View>
            </View>
          ) : null}
        </>
      )}

      <InfoNote icon="clock" title={t('remote.settings.timingTitle')} description={t('remote.settings.timing')} />
    </View>
  );
}

/** Settings → Notificaciones → "Avisos fuera de la app" (e-mail and Telegram). */
export function RemoteNotifySettings() {
  const { t } = useTranslation();
  const services = useServices();
  const settings = useNotifySettings();
  return (
    <Card>
      <CardHeader title={t('remote.settings.title')} icon="send" accent="#0891B2" />
      {!services.notify ? (
        <InfoNote icon="cloud" title={t('remote.settings.cloudOnlyTitle')} description={t('remote.settings.cloudOnly')} />
      ) : !settings.data ? (
        <LoadingState />
      ) : (
        <Body settings={settings.data} />
      )}
    </Card>
  );
}
