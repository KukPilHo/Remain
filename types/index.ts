/**
 * TypeScript 타입 정의
 */

export interface Turn {
  role: 'ai' | 'parent';
  text: string;
  audioUrl?: string;
  timestamp: Date;
}

export interface SessionState {
  sessionId: string;
  parentName: string;
  topic: string;
  currentQuestionId: string;
  turns: Turn[];
  currentTurn: number;
  maxTurns: number; // 기본 8 (AI 4턴 + 부모님 4턴)
  status:
    | 'greeting'
    | 'waiting_answer'
    | 'processing'
    | 'asking'
    | 'completed';
}

export interface Question {
  id: string;
  category: string;
  question: string;
  guide: string;
  greeting: string;
}
