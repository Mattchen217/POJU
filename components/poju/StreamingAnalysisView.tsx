'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

import { stripMetaSection } from '@/lib/base-analysis/useStreamingAnalysis';

interface Props {
  content: string;
  status: 'idle' | 'connecting' | 'streaming' | 'completed' | 'failed';
  bytes_received: number;
}

export function StreamingAnalysisView({ content, status, bytes_received }: Props) {
  const t = useTranslations('analysis_loader');
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content]);

  const visibleContent = stripMetaSection(content);

  return (
    <div className="streaming-analysis">
      <div className="status-line">
        {status === 'connecting' && (
          <>
            <span className="status-dot connecting" />
            <span>{t('connecting')}</span>
          </>
        )}
        {status === 'streaming' && (
          <>
            <span className="status-dot streaming" />
            <span>{t('reading_chart')}</span>
            <span className="bytes">· {bytes_received} chars</span>
          </>
        )}
        {status === 'completed' && (
          <>
            <span className="status-dot done" />
            <span>{t('complete')}</span>
          </>
        )}
      </div>

      <div ref={contentRef} className="streaming-content">
        {visibleContent ? (
          <>
            <pre className="content-text">{visibleContent}</pre>
            {status === 'streaming' && <span className="cursor">▊</span>}
          </>
        ) : (
          <div className="placeholder">{t('warming_up')}</div>
        )}
      </div>

      {status === 'streaming' && (
        <div className="bottom-hint">{t('keep_screen_on')}</div>
      )}
    </div>
  );
}
