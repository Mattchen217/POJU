'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { stripMetaSection } from '@/lib/base-analysis/useStreamingAnalysis';

interface Props {
  content: string;
  status: 'idle' | 'connecting' | 'streaming' | 'completed' | 'failed';
  bytes_received: number;
  /** Preparing pages: keep thinking animation only — never render growing stream text. */
  thinkingOnly?: boolean;
  /** overlay = fixed bottom panel (preparing); inline = normal document flow (delivery pages). */
  layout?: 'overlay' | 'inline';
}

const THINKING_PHRASES_ZH = [
  '正在创建...',
  '正在分析...',
  '正在解读你的能量结构...',
  '正在思考...',
  '请耐心等待...',
];

const THINKING_PHRASES_EN = [
  'Creating...',
  'Analyzing...',
  'Reading your energy structure...',
  'Thinking...',
  'Please wait...',
];

export function StreamingAnalysisView({
  content,
  status,
  bytes_received,
  thinkingOnly = false,
  layout = 'overlay',
}: Props) {
  const t = useTranslations('analysis_loader');
  const locale = useLocale();
  const contentRef = useRef<HTMLDivElement>(null);
  const [thinkingPhraseIdx, setThinkingPhraseIdx] = useState(0);

  const phrases = locale.startsWith('zh') ? THINKING_PHRASES_ZH : THINKING_PHRASES_EN;
  const isThinking =
    thinkingOnly
      ? status === 'connecting' || status === 'streaming'
      : (status === 'connecting' || status === 'streaming') && bytes_received === 0;

  useEffect(() => {
    if (!isThinking) return;

    const timer = window.setInterval(() => {
      setThinkingPhraseIdx((idx) => (idx + 1) % phrases.length);
    }, 2000);

    return () => window.clearInterval(timer);
  }, [isThinking, phrases.length]);

  const followLiveStream =
    layout === 'overlay' && (status === 'streaming' || status === 'connecting');

  useLayoutEffect(() => {
    if (isThinking || thinkingOnly || !contentRef.current) return;

    if (followLiveStream) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
      return;
    }

    if (layout === 'inline') {
      contentRef.current.scrollTop = 0;
    }
  }, [content, isThinking, thinkingOnly, layout, followLiveStream]);

  const visibleContent = stripMetaSection(content);

  return (
    <div
      className={
        layout === 'inline' ? 'streaming-analysis-inline' : 'streaming-analysis-bottom'
      }
    >
      <div className="streaming-container">
        {isThinking ? (
          <div className="thinking-phase">
            <span className="thinking-dot" />
            <span className="thinking-text" key={thinkingPhraseIdx}>
              {phrases[thinkingPhraseIdx]}
            </span>
          </div>
        ) : null}

        {!isThinking && visibleContent ? (
          <div ref={contentRef} className="streaming-content-compact">
            <pre className="content-text">{visibleContent}</pre>
            {status === 'streaming' ? <span className="cursor">▊</span> : null}
          </div>
        ) : null}
      </div>

      {status === 'streaming' ? (
        <div className="bottom-hint-white">{t('keep_screen_on')}</div>
      ) : null}
    </div>
  );
}
