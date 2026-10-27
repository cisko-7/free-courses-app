'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import { RotateCcw, Save, Settings } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  clearSiteSettingsCache,
  fetchSiteSettings,
  saveSiteSettings,
  type SiteSettings
} from '@/lib/site-settings';
import { refreshSiteSettings, setSiteSettingsLocal } from '@/hooks/useSiteSettings';
import { dangerButton, ErrorNote, inputClass, Loading, Panel, primaryButton, SuccessNote, Toggle } from './ui';

/** Активна ли сессия Supabase прямо сейчас. */
async function hasSession(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    return Boolean(data.session);
  } catch {
    return false;
  }
}

const TONE_OPTIONS: Array<{ value: SiteSettings['bannerTone']; label: string }> = [
  { value: 'info', label: 'Инфо (синий)' },
  { value: 'success', label: 'Успех (зелёный)' },
  { value: 'warning', label: 'Внимание (жёлтый)' },
  { value: 'danger', label: 'Опасность (красный)' }
];

/** Настройки сайта: техработы, регистрация, баннер. */
function AdminSiteSettings() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    let alive = true;
    void fetchSiteSettings(supabase).then((s) => {
      if (!alive) return;
      setSettings(s);
      setStatus('ready');
    });
    return () => {
      alive = false;
    };
  }, []);

  const handleSave = useCallback(() => {
    if (!settings) return;
    setStatus('saving');
    setErrorMsg('');
    setSuccessMsg('');
    void hasSession().then((active) => {
      if (!active) {
        setStatus('error');
        setErrorMsg('Сессия истекла. Пожалуйста, войдите в аккаунт администратора заново.');
        return;
      }
      void saveSiteSettings(supabase, settings).then((error) => {
        if (error) {
          setStatus('error');
          setErrorMsg(error);
        } else {
          setStatus('ready');
          setSuccessMsg('Настройки сохранены.');
          // Применяем мгновенно на клиенте и перечитываем с сервера
          setSiteSettingsLocal(settings);
          void refreshSiteSettings();
        }
      });
    });
  }, [settings]);

  /** Экстренно выключает техработы и очищает локальный кэш настроек. */
  const handleEmergencyReset = useCallback(() => {
    if (!settings) return;
    const next: SiteSettings = { ...settings, maintenanceMode: false };
    setStatus('saving');
    setErrorMsg('');
    setSuccessMsg('');
    // Сразу чистим кэш и применяем локально — тумблер мгновенно отпускает клиент
    clearSiteSettingsCache();
    setSettings(next);
    setSiteSettingsLocal(next);
    void hasSession().then((active) => {
      if (!active) {
        setStatus('error');
        setErrorMsg('Сессия истекла. Пожалуйста, войдите в аккаунт администратора заново.');
        return;
      }
      void saveSiteSettings(supabase, next).then((error) => {
        if (error) {
          setStatus('error');
          setErrorMsg(error);
        } else {
          setStatus('ready');
          setSuccessMsg('Техработы экстренно отключены, локальный кэш очищен.');
          void refreshSiteSettings();
        }
      });
    });
  }, [settings]);

  if (status === 'loading') return <Loading label="Загрузка настроек…" />;
  if (!settings) return <ErrorNote message="Не удалось загрузить настройки." />;

  return (
    <Panel
      title="Настройки сайта"
      icon={<Settings className="w-4 h-4 text-blue-400" />}
      actions={
        <button type="button" onClick={handleSave} disabled={status === 'saving'} className={primaryButton}>
          <Save className="w-4 h-4" aria-hidden="true" />
          {status === 'saving' ? 'Сохранение…' : 'Сохранить'}
        </button>
      }
    >
      {errorMsg && <ErrorNote message={errorMsg} />}
      {successMsg && <SuccessNote message={successMsg} />}

      <div className="space-y-5">
        <Toggle
          checked={settings.maintenanceMode}
          onChange={(v) => setSettings({ ...settings, maintenanceMode: v })}
          label="Режим технических работ"
          description="Все пользователи (кроме админа) увидят экран техработ. Запись в БД заблокирована триггером."
        />
        {settings.maintenanceMode && (
          <div className="space-y-2">
            <label htmlFor="maintenance-msg" className="block text-xs font-semibold text-slate-400">
              Сообщение на экране техработ
            </label>
            <textarea
              id="maintenance-msg"
              value={settings.maintenanceMessage}
              onChange={(e) => setSettings({ ...settings, maintenanceMessage: e.target.value })}
              rows={3}
              placeholder="Сайт временно недоступен. Возвращаемся через час."
              className={inputClass}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={handleEmergencyReset} disabled={status === 'saving'} className={dangerButton}>
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            🔄 Сбросить техработы экстренно
          </button>
          <span className="text-xs text-slate-500">
            Принудительно выключает режим техработ и очищает локальный кэш настроек.
          </span>
        </div>

        <hr className="border-slate-800" />

        <Toggle
          checked={settings.registrationOpen}
          onChange={(v) => setSettings({ ...settings, registrationOpen: v })}
          label="Регистрация новых пользователей"
          description="Если выключено, signUp вернёт ошибку с маркером DC_REGISTRATION_CLOSED (триггер БД)."
        />

        <hr className="border-slate-800" />

        <div className="space-y-3">
          <Toggle
            checked={settings.bannerEnabled}
            onChange={(v) => setSettings({ ...settings, bannerEnabled: v })}
            label="Показывать баннер-объявление"
            description="Объявление над шапкой сайта (можно скрыть)."
          />
          {settings.bannerEnabled && (
            <>
              <div className="space-y-2">
                <label htmlFor="banner-text" className="block text-xs font-semibold text-slate-400">
                  Текст объявления
                </label>
                <textarea
                  id="banner-text"
                  value={settings.bannerText}
                  onChange={(e) => setSettings({ ...settings, bannerText: e.target.value })}
                  rows={2}
                  placeholder="Новый курс по алгоритмам уже доступен!"
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="banner-tone" className="block text-xs font-semibold text-slate-400">
                  Тон баннера
                </label>
                <select
                  id="banner-tone"
                  value={settings.bannerTone}
                  onChange={(e) => setSettings({ ...settings, bannerTone: e.target.value as SiteSettings['bannerTone'] })}
                  className={inputClass}
                >
                  {TONE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

export default memo(AdminSiteSettings);
