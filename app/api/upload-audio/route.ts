import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 서비스 역할 클라이언트 (Storage 업로드에 필요)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const sessionId = formData.get('sessionId') as string | null;
    const turnIndex = formData.get('turnIndex') as string | null;
    const role = formData.get('role') as string | null; // 'ai' | 'parent'

    if (!audioFile) {
      return NextResponse.json(
        { error: '음성 파일이 전송되지 않았습니다.' },
        { status: 400 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: '세션 ID가 전달되지 않았습니다.' },
        { status: 400 }
      );
    }

    // 파일명 생성: audio/{sessionId}/{turnIndex}_{role}_{timestamp}.webm
    const ext = audioFile.name?.split('.').pop() || 'webm';
    const fileName = `${sessionId}/${turnIndex || '0'}_${role || 'unknown'}_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('audio')
      .upload(fileName, audioFile, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Audio upload error:', uploadError);
      return NextResponse.json(
        { error: '음성 파일 업로드에 실패했습니다: ' + uploadError.message },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from('audio')
      .getPublicUrl(fileName);

    return NextResponse.json({
      audioUrl: urlData?.publicUrl || null,
    });
  } catch (error: unknown) {
    console.error('Upload audio error:', error);
    const message =
      error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    return NextResponse.json(
      { error: `음성 업로드 중 오류: ${message}` },
      { status: 500 }
    );
  }
}
