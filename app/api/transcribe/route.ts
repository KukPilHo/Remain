import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    // API 키 확인
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-xxxxxxxxxxxxxxxx') {
      return NextResponse.json(
        { error: 'OpenAI API 키가 설정되지 않았습니다. .env.local 파일을 확인해 주세요.' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: '음성 파일이 전송되지 않았습니다.' },
        { status: 400 }
      );
    }

    // 파일 크기 체크 (4.5MB 제한 — Vercel 무료 티어)
    if (audioFile.size > 4.5 * 1024 * 1024) {
      return NextResponse.json(
        { error: '녹음이 너무 깁니다. 2분 이내로 녹음해 주세요.' },
        { status: 413 }
      );
    }

    // 너무 짧은 녹음 체크 (0.5초 미만 추정 — 약 8KB 미만)
    if (audioFile.size < 8000) {
      return NextResponse.json(
        { error: '녹음이 너무 짧습니다. 조금 더 길게 말씀해 주세요.' },
        { status: 400 }
      );
    }

    // Whisper API 호출
    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: audioFile,
      language: 'ko', // 한국어 고정 → 정확도 향상
      response_format: 'json',
    });

    return NextResponse.json({
      text: transcription.text,
    });
  } catch (error: unknown) {
    console.error('Transcription error:', error);

    const message =
      error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    return NextResponse.json(
      { error: `음성 변환 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}
