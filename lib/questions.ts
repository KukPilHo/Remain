import type { Question } from '@/types';

export const QUESTIONS: Question[] = [
  {
    id: 'Q-01',
    category: '어린 시절',
    question: '어린 시절 살던 동네를 떠올리면, 가장 먼저 생각나는 장면은 무엇인가요?',
    guide: '동네 골목 풍경, 자주 가던 가게, 창밖에서 보이던 것 등 떠오르는 장면을 자유롭게 말씀해 주세요.',
    greeting: '안녕하세요! 오늘은 어린 시절 이야기를 나눠볼까요? 편하게 말씀해 주시면 돼요.',
  },
  {
    id: 'Q-02',
    category: '어린 시절',
    question: '어린 시절, 학교 끝나고 집에 오면 제일 먼저 뭘 하셨어요?',
    guide: '친구들이랑 놀았던 일, 혼자 했던 일, 집안일을 도왔던 것 등 기억나는 대로 말씀해 주세요.',
    greeting: '안녕하세요! 오늘은 학창시절 이야기를 해볼까요?',
  },
  {
    id: 'Q-03',
    category: '어린 시절',
    question: '어릴 때 가장 좋아하던 음식은 뭐였어요? 누가 해줬나요?',
    guide: '엄마가 해주던 음식, 동네 분식집, 명절 음식 등 떠오르는 맛이 있으면 알려주세요.',
    greeting: '안녕하세요! 오늘은 맛있는 음식 이야기를 해볼까요?',
  },
  {
    id: 'Q-04',
    category: '가족',
    question: '부모님이나 할머니, 할아버지에게서 자주 들었던 말이 있나요?',
    guide: '잔소리였던 것, 칭찬이었던 것, 지금도 기억에 남는 한마디가 있다면 알려주세요.',
    greeting: '안녕하세요! 오늘은 가족 이야기를 나눠볼까요?',
  },
  {
    id: 'Q-05',
    category: '어린 시절',
    question: '학창시절 가장 기억에 남는 선생님이 있으세요? 어떤 분이셨나요?',
    guide: '좋았던 선생님, 무서웠던 선생님, 인생에 영향을 준 선생님 등 누구든 떠오르는 분을 말씀해 주세요.',
    greeting: '안녕하세요! 오늘은 학교 다니시던 때 이야기를 해볼까요?',
  },
];

export function getQuestionById(id: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === id);
}
