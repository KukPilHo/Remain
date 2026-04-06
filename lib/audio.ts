/**
 * 브라우저 마이크 녹음 유틸리티
 * - MediaRecorder API 사용
 * - Safari/Chrome mimeType 자동 감지
 * - 모노 채널, 에코/노이즈 제거
 */

export interface RecordingSession {
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
  mimeType: string;
}

/**
 * 마이크 녹음을 시작합니다.
 * @returns RecordingSession 객체
 */
export async function startRecording(): Promise<RecordingSession> {
  // 마이크 스트림 획득
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,        // 모노 (파일 크기 절약)
      sampleRate: 16000,      // Whisper 최적 샘플레이트
      echoCancellation: true, // 에코 제거
      noiseSuppression: true, // 노이즈 제거
    },
  });

  // Safari는 webm을 지원하지 않으므로 mimeType 분기
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/mp4';

  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  recorder.start();

  return { recorder, stream, chunks, mimeType };
}

/**
 * 녹음을 중지하고 오디오 Blob을 반환합니다.
 */
export function stopRecording(session: RecordingSession): Promise<Blob> {
  return new Promise((resolve) => {
    session.recorder.onstop = () => {
      // 마이크 스트림 해제
      session.stream.getTracks().forEach((track) => track.stop());

      const blob = new Blob(session.chunks, { type: session.mimeType });
      resolve(blob);
    };

    session.recorder.stop();
  });
}

/**
 * mimeType에 맞는 파일 확장자를 반환합니다.
 * Whisper API에 올바른 확장자를 전달하기 위해 필요합니다.
 */
export function getFileExtension(mimeType: string): string {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'wav';
}
