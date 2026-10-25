'use client';

import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { Send, Settings, Zap } from 'lucide-react';
import { callGeminiAPI, ADMIN_COMMANDER_PROMPT, AUTO_HEALER_PROMPT, getGeminiApiKey, setGeminiApiKey, type AIMessage, type AIAction } from '@/lib/ai-autopilot';
import { supabase } from '@/lib/supabase';
import { fetchSiteSettings, saveSiteSettings, type SiteSettings } from '@/lib/site-settings';
import { refreshSiteSettings } from '@/hooks/useSiteSettings';
import { Panel, ErrorNote, SuccessNote, inputClass, primaryButton } from './ui';

interface ChatMessage extends AIMessage {
  timestamp: string;
}

function AdminAI() {
  const [apiKey, setApiKeyLocal] = useState('');
  const [keyEditing, setKeyEditing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSaveApiKey = useCallback(() => {
    if (!apiKey.trim()) {
      setError('Ключ не может быть пустым');
      return;
    }
    setGeminiApiKey(apiKey);
    setSuccess('API-ключ сохранён');
    setKeyEditing(false);
    setTimeout(() => setSuccess(''), 3000);
  }, [apiKey]);

  const executeAction = useCallback(async (action: AIAction) => {
    try {
      switch (action.type) {
        case 'TOGGLE_MAINTENANCE': {
          const settings = await fetchSiteSettings(supabase);
          if (!settings) throw new Error('Не удалось загрузить настройки');
          
          const maintenance = action.params.maintenance as boolean;
          const message = (action.params.message as string | undefined) || settings.maintenanceMessage;
          
          const updated: SiteSettings = {
            ...settings,
            maintenanceMode: maintenance,
            maintenanceMessage: message
          };
          
          const error = await saveSiteSettings(supabase, updated);
          if (error) throw new Error(error);
          
          await refreshSiteSettings();
          setSuccess(`✅ Режим техработ ${maintenance ? 'включен' : 'выключен'}`);
          break;
        }

        case 'UPDATE_BANNER': {
          const settings = await fetchSiteSettings(supabase);
          if (!settings) throw new Error('Не удалось загрузить настройки');
          
          const enabled = action.params.enabled as boolean;
          const text = (action.params.text as string | undefined) || settings.bannerText;
          const tone = (action.params.tone as SiteSettings['bannerTone'] | undefined) || settings.bannerTone;
          
          const updated: SiteSettings = {
            ...settings,
            bannerEnabled: enabled,
            bannerText: text,
            bannerTone: tone
          };
          
          const error = await saveSiteSettings(supabase, updated);
          if (error) throw new Error(error);
          
          await refreshSiteSettings();
          setSuccess(`✅ Баннер ${enabled ? 'включен' : 'выключен'}`);
          break;
        }

        case 'TOGGLE_REGISTRATION': {
          const settings = await fetchSiteSettings(supabase);
          if (!settings) throw new Error('Не удалось загрузить настройки');
          
          const open = action.params.open as boolean;
          const updated: SiteSettings = {
            ...settings,
            registrationOpen: open
          };
          
          const error = await saveSiteSettings(supabase, updated);
          if (error) throw new Error(error);
          
          await refreshSiteSettings();
          setSuccess(`✅ Регистрация ${open ? 'открыта' : 'закрыта'}`);
          break;
        }

        default:
          setError(`Действие ${action.type} пока не реализовано`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка выполнения действия');
    }
  }, []);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setError('');
    setSuccess('');

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: userMessage, timestamp: new Date().toISOString() }
    ];
    setMessages(newMessages);
    setLoading(true);

    try {
      const response = await callGeminiAPI(userMessage, ADMIN_COMMANDER_PROMPT, messages);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response.text, timestamp: response.timestamp }
      ]);
      
      // Выполнить действие, если ИИ его вернул
      if (response.action && response.action.type !== 'NONE') {
        await executeAction(response.action);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, executeAction]);

  const runDiagnosis = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const response = await callGeminiAPI('Диагностика', AUTO_HEALER_PROMPT);
      setMessages((prev) => [...prev, { role: 'assistant', content: response.text, timestamp: response.timestamp }]);
      setSuccess('Диагностика завершена');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка диагностики');
    } finally {
      setLoading(false);
    }
  }, []);

  const key = apiKey || getGeminiApiKey() || '';

  return (
    <div className="space-y-6">
      <Panel title="🔑 Gemini API" icon={<Settings className="w-4 h-4 text-blue-400" />}>
        {keyEditing ? (
          <div className="space-y-3">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKeyLocal(e.target.value)}
              placeholder="API ключ"
              className={inputClass}
            />
            <button onClick={handleSaveApiKey} className={primaryButton}>
              Сохранить
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">{key ? '✅ Ключ настроен' : '⚠️ Нет ключа'}</span>
            <button
              onClick={() => { setKeyEditing(true); setApiKeyLocal(key || ''); }}
              className="text-xs px-3 py-1.5 rounded bg-slate-800"
            >
              Изменить
            </button>
          </div>
        )}
      </Panel>

      <Panel title="💬 Admin Commander" icon={<Send className="w-4 h-4 text-blue-400" />}>
        <div className="space-y-3">
          <div className="h-64 rounded-lg bg-slate-950 border border-slate-800 overflow-y-auto p-3 space-y-3">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`text-xs rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-600/20 text-blue-200 ml-8'
                    : 'bg-slate-900 text-slate-300 mr-8'
                }`}
              >
                {msg.content}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Команда..."
              disabled={loading}
              className={inputClass}
            />
            <button onClick={sendMessage} disabled={loading} className={primaryButton}>
              📤
            </button>
          </div>
        </div>
      </Panel>

      <Panel title="🏥 Auto-Healer" icon={<Zap className="w-4 h-4 text-emerald-400" />}>
        <button onClick={runDiagnosis} disabled={loading} className={primaryButton}>
          🔍 Диагностика
        </button>
      </Panel>

      {error && <ErrorNote message={error} />}
      {success && <SuccessNote message={success} />}
    </div>
  );
}

export default memo(AdminAI);
