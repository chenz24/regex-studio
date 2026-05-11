import { useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { buildShareUrl } from '../lib/share';
import type { SharePayload } from '../lib/share';
import { useT } from '@/lib/i18n';

interface ShareButtonProps {
  payload: SharePayload;
}

export function ShareButton({ payload }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const t = useT();

  const handleClick = async () => {
    const url = buildShareUrl(payload);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard may be unavailable (e.g., insecure context). Fall back
      // to navigating to the URL so the user can copy from the address
      // bar at minimum.
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', url);
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleClick}
      title={t.share_title()}
      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-500" />
          <span className="hidden sm:inline text-emerald-600 dark:text-emerald-400">
            {t.share_copied()}
          </span>
        </>
      ) : (
        <>
          <Link2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t.share_label()}</span>
        </>
      )}
    </button>
  );
}
