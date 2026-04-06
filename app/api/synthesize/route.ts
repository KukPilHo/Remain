import OpenAI from 'openai';
import { NextResponse } from 'next/server';

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

    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: '변환할 텍스트가 없습니다.' },
        { status: 400 }
      );
    }

    const response = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice: 'coral',
      input: text,
      instructions: '따뜻하고 친근한 톤으로, 천천히 또박또박 말해주세요. 한국어 존댓말을 사용합니다. 어르신과 대화하는 느낌으로 편안하게 말해주세요.',
      response_format: 'mp3',
    });

    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: unknown) {
    console.error('TTS error:', error);

    const message =
      error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    return NextResponse.json(
      { error: `음성 생성 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}
