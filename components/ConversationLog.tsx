'use client';

import type { Turn } from '@/types';
import { useEffect, useRef } from 'react';

interface ConversationLogProps {
  turns: Turn[];
  parentName: string;
}

export default function ConversationLog({ turns, parentName }: ConversationLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // 새 턴 추가 시 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns.length]);

  if (turns.length === 0) return null;

  return (
    <div className="conversation-log">
      {turns.map((turn, index) => (
        <div
          key={index}
          className={`bubble-row ${turn.role === 'ai' ? 'bubble-left' : 'bubble-right'}`}
        >
          {turn.role === 'ai' && <span className="bubble-avatar">🤖</span>}
          <div
            className={`bubble ${turn.role === 'ai' ? 'bubble-ai' : 'bubble-parent'}`}
          >
            <p className="bubble-text">{turn.text}</p>
          </div>
          {turn.role === 'parent' && <span className="bubble-avatar">👤</span>}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
