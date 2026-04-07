"use client";

import React, { useState } from 'react';
import { Send, Mic } from 'lucide-react';

type QuestionType = 'open_ended' | 'fill_in_the_blank' | 'photo_based';

interface MemoryStimulatorProps {
  type: QuestionType;
  content: {
    text: string;
    photoUrl?: string;
    prefixText?: string;
    suffixText?: string;
  };
  onAnswerSubmit: (answer: string) => void;
  isRecording?: boolean;
  onToggleRecording?: () => void;
}

export default function MemoryStimulator({ type, content, onAnswerSubmit, isRecording = false, onToggleRecording }: MemoryStimulatorProps) {
  const [fillValue, setFillValue] = useState("");
  const [openText, setOpenText] = useState("");

  const handleSubmit = (val: string) => {
    if (!val.trim()) return;
    onAnswerSubmit(val);
  };

  return (
    <div className="w-full max-w-xl mx-auto rounded-xl overflow-hidden bg-white shadow-sm border border-gray-100">
      
      {/* Photo-First Approach */}
      {type === 'photo_based' && content.photoUrl && (
        <div className="w-full aspect-video bg-gray-200 relative">
          <img 
            src={content.photoUrl} 
            alt="추억의 사진" 
            className="w-full h-full object-cover" 
          />
        </div>
      )}

      <div className="p-6">
        <h3 className="text-2xl font-bold text-gray-800 leading-snug mb-8 whitespace-pre-wrap text-center">
          {content.text}
        </h3>

        {/* Fill in the Blank UI */}
        {type === 'fill_in_the_blank' && (
          <div className="flex flex-col items-center justify-center p-6 bg-[#f9fdfa] rounded-xl space-y-4 border border-[#2F6F4F]/10 shadow-inner">
            <div className="text-xl text-gray-700 font-medium text-center leading-loose">
              {content.prefixText && <span>{content.prefixText} </span>}
              <input 
                type="text" 
                value={fillValue}
                onChange={(e) => setFillValue(e.target.value)}
                placeholder="입력"
                className="w-32 text-center text-xl font-bold text-[#2F6F4F] border-b-2 border-[#2F6F4F]/40 bg-transparent focus:outline-none focus:border-[#2F6F4F] mx-2"
              />
              {content.suffixText && <span> {content.suffixText}</span>}
            </div>
            <button 
              onClick={() => handleSubmit(fillValue)}
              disabled={!fillValue.trim()}
              className="mt-4 px-10 py-3 bg-[#2F6F4F] text-white font-bold rounded-full hover:bg-[#23533b] disabled:opacity-50 shadow-md"
            >
              대답하기
            </button>
          </div>
        )}

        {/* Open Ended / Photo Based Voice-First Input */}
        {(type === 'open_ended' || type === 'photo_based') && (
          <div className="flex flex-col items-center gap-6 mt-2">
            
            <button 
                onClick={onToggleRecording}
                className={`w-32 h-32 rounded-full flex flex-col items-center justify-center text-white shadow-xl transition-all ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-[#2F6F4F] hover:bg-[#23533b]'}`}
            >
              <Mic size={36} className="mb-1" />
              <span className="font-bold text-sm tracking-wide">{isRecording ? "마치기" : "말씀하기"}</span>
            </button>
            
            <p className="text-[#6d6455] font-semibold text-center mt-1">
              {isRecording 
                ? '이야기를 다 하셨으면 빨간색 버튼을 다시 눌러주세요.' 
                : '가운데 마이크 버튼을 누르고 편하게 말씀해주세요!'}
            </p>

            <div className="w-full mt-4 bg-gray-50 p-2 rounded-2xl border border-gray-200 focus-within:border-[#2F6F4F]/40 focus-within:ring-2 focus-within:ring-[#2F6F4F]/10 transition-all flex shadow-inner">
              <input 
                type="text"
                value={openText}
                onChange={(e) => setOpenText(e.target.value)}
                placeholder="채팅으로 직접 쓰실 수도 있습니다."
                className="flex-1 bg-transparent px-4 py-2 outline-none text-md"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit(openText)}
              />
              <button 
                onClick={() => handleSubmit(openText)}
                className="p-2 m-1 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                title="전송"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
