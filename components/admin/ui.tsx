'use client';

/** Общие элементы интерфейса админ-дашборда. */
import { useId, type ReactNode } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}

export const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none disabled:opacity-60';

export const primaryButton =
  'px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors';

export const secondaryButton =
  'px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors';

export const dangerButton =
  'px-3 py-2 rounded-xl bg-rose-950/40 border border-rose-800/50 hover:bg-rose-900/50 disabled:opacity-50 disabled:cursor-not-allowed text-rose-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors';

interface PanelProps {
  title: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function Panel({ title, icon, actions, children }: PanelProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={id} className="text-sm font-bold text-white flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div role="alert" className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2">
      <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <span className="whitespace-pre-line break-words">{message}</span>
    </div>
  );
}

export function SuccessNote({ message }: { message: string }) {
  return (
    <p role="status" className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs">
      {message}
    </p>
  );
}

export function Loading({ label = 'Загрузка…' }: { label?: string }) {
  return (
    <p role="status" className="py-6 text-xs text-slate-400 flex items-center justify-center gap-2">
      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      {label}
    </p>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

/** Переключатель с role="switch" (доступен с клавиатуры и для скринридеров). */
export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  const labelId = useId();
  const descId = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <span id={labelId} className="block text-sm font-semibold text-white">
          {label}
        </span>
        {description && (
          <p id={descId} className="text-xs text-slate-400 mt-0.5">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description ? descId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
          checked ? 'bg-blue-600' : 'bg-slate-700'
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}
