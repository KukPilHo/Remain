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

    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: '변환할 텍스트가 없습니다.' },
        { status: 400 }
      );
    }

    const aiConfig = getAiConfig();
    
    // Note: openai.audio.speech.create typically accepts standard TTS API params. 
    // Removed prompt instructions as they aren't standard in normal v1/audio/speech SDK.
    const response = await openai.audio.speech.create({
      model: aiConfig.tts.model,
      voice: aiConfig.tts.voice as any,
      input: text,
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
