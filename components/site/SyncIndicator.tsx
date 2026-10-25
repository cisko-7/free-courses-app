'use client';

import { memo } from 'react';
import { Cloud, CloudOff, CloudUpload, RefreshCw } from 'lucide-react';
import type { SyncStatus } from '@/lib/auth-utils';

interface SyncIndicatorProps {
  status: SyncStatus;
  onRetry: () => void;
}

const TITLES: Partial<Record<SyncStatus, string>> = {
  'offline-pending': 'Изменения сохранены на устройстве и отправятся при появлении сети',
  error: 'Не удалось сохранить в облако'
};

/** Индикатор синхронизации с облаком в шапке. */
function SyncIndicator({ status, onRetry }: SyncIndicatorProps) {
  if (status === 'idle') return null;
  return (
    <div
      role="status"
      aria-live="polite"
      title={TITLES[status]}
      className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs"
    >
      {status === 'syncing' && (
        <>
          <CloudUpload className="w-3.5 h-3.5 text-blue-400 animate-pulse" aria-hidden="true" />
          <span className="text-slate-400">Сохранение…</span>
        </>
      )}
      {status === 'synced' && (
        <>
          <Cloud className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
          <span className="text-slate-300">В облаке</span>
        </>
      )}
      {status === 'offline-pending' && (
        <>
          <CloudOff className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
          <span className="text-slate-300">Офлайн</span>
        </>
      )}
      {status === 'error' && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 text-rose-300 hover:text-rose-200 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Повторить</span>
        </button>
      )}
    </div>
  );
}

export default memo(SyncIndicator);
