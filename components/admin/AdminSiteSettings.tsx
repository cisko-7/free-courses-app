'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import { Save, Settings } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchSiteSettings, saveSiteSettings, type SiteSettings } from '@/lib/site-settings';
import { ErrorNote, inputClass, Loading, Panel, primaryButton, SuccessNote, Toggle } from './ui';

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
    void saveSiteSettings(supabase, settings).then((error) => {
      if (error) {
        setStatus('error');
        setErrorMsg(error);
      } else {
        setStatus('ready');
        setSuccessMsg('Настройки сохранены.');
      }
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
