import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { getAiConfig } from '@/lib/ai-config';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-xxxxxxxxxxxxxxxx') {
      return NextResponse.json(
        { error: 'OpenAI API 키가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: '프롬프트가 전달되지 않았습니다.' },
        { status: 400 }
      );
    }

    const aiConfig = getAiConfig();

    const completion = await openai.chat.completions.create({
      model: aiConfig.llm.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: aiConfig.llm.max_tokens,
      temperature: aiConfig.llm.temperature,
    });

    const text = completion.choices[0]?.message?.content || '';

    return NextResponse.json({ text: text.trim() });
  } catch (error: unknown) {
    console.error('LLM error:', error);

    const message =
      error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    return NextResponse.json(
      { error: `질문 생성 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}
