'use client';

import { memo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, X, type LucideIcon } from 'lucide-react';
import type { BannerTone } from '@/lib/site-settings';

const TONES: Record<BannerTone, { box: string; Icon: LucideIcon }> = {
  info: { box: 'bg-blue-500/15 border-blue-500/30 text-blue-100', Icon: Info },
  success: { box: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-100', Icon: CheckCircle2 },
  warning: { box: 'bg-amber-500/15 border-amber-500/30 text-amber-100', Icon: AlertTriangle },
  danger: { box: 'bg-rose-500/15 border-rose-500/30 text-rose-100', Icon: ShieldAlert }
};

interface SiteBannerProps {
  text: string;
  tone: BannerTone;
  /** Можно ли скрыть баннер (служебные предупреждения скрывать не даём). */
  dismissible?: boolean;
}

/** Объявление над шапкой сайта. Текст выводится как обычный текст (React экранирует HTML). */
function SiteBanner({ text, tone, dismissible = true }: SiteBannerProps) {
  // Скрываем конкретный текст: новое объявление снова будет показано
  const [dismissedText, setDismissedText] = useState<string | null>(null);
  if (!text || dismissedText === text) return null;
  const { box, Icon } = TONES[tone] ?? TONES.info;

  return (
    <div role="status" className={`border-b ${box}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3 text-sm">
        <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        <p className="flex-1 min-w-0 break-words">{text}</p>
        {dismissible && (
          <button
            type="button"
            onClick={() => setDismissedText(text)}
            aria-label="Скрыть объявление"
            className="p-1 rounded-lg hover:bg-white/10 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(SiteBanner);
