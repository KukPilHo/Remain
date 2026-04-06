"use client";

import React, { useState } from 'react';
import { Camera, Send, Mic } from 'lucide-react';

type QuestionType = 'open_ended' | 'multiple_choice' | 'fill_in_the_blank' | 'photo_based';

interface MemoryStimulatorProps {
  type: QuestionType;
  content: {
    text: string;
    photoUrl?: string;
    options?: string[];
    prefixText?: string;
    suffixText?: string;
  };
  onAnswerSubmit: (answer: string) => void;
}

export default function MemoryStimulator({ type, content, onAnswerSubmit }: MemoryStimulatorProps) {
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
        <div className="w-full aspect-video bg-gray-200 relative mb-4">
          <img 
            src={content.photoUrl} 
            alt="추억의 사진" 
            className="w-full h-full object-cover" 
          />
        </div>
      )}

      <div className="p-6">
        <h3 className="text-2xl font-bold text-gray-800 leading-snug mb-6 whitespace-pre-wrap">
          {content.text}
        </h3>

        {/* Multiple Choice UI */}
        {type === 'multiple_choice' && content.options && (
          <div className="flex flex-col gap-3">
            {content.options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => handleSubmit(opt)}
                className="w-full py-4 px-6 text-left rounded-xl border-2 border-orange-100 bg-orange-50 hover:bg-orange-100 text-orange-900 font-medium text-lg transition-colors"
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {/* Fill in the Blank UI */}
        {type === 'fill_in_the_blank' && (
          <div className="flex flex-col items-center justify-center p-6 bg-yellow-50 rounded-xl space-y-4">
            <div className="text-xl text-gray-700 font-medium text-center leading-loose">
              {content.prefixText && <span>{content.prefixText} </span>}
              <input 
                type="text" 
                value={fillValue}
                onChange={(e) => setFillValue(e.target.value)}
                placeholder="단어를 입력하세요"
                className="w-48 text-center text-xl font-bold text-orange-600 border-b-2 border-orange-300 bg-transparent focus:outline-none focus:border-orange-500 mx-2"
              />
              {content.suffixText && <span> {content.suffixText}</span>}
            </div>
            <button 
              onClick={() => handleSubmit(fillValue)}
              disabled={!fillValue.trim()}
              className="mt-4 px-8 py-3 bg-orange-500 text-white font-bold rounded-full hover:bg-orange-600 disabled:opacity-50"
            >
              대답하기
            </button>
          </div>
        )}

        {/* Open Ended / Photo Based Text Input */}
        {(type === 'open_ended' || type === 'photo_based') && (
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex bg-gray-50 p-2 rounded-2xl border border-gray-200 focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-100 transition-all">
              <input 
                type="text"
                value={openText}
                onChange={(e) => setOpenText(e.target.value)}
                placeholder="여기에 직접 쓰시거나 마이크를 눌러 말씀해보세요"
                className="flex-1 bg-transparent px-4 py-3 outline-none text-lg"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit(openText)}
              />
              <button 
                onClick={() => handleSubmit(openText)}
                className="p-3 m-1 bg-orange-500 text-white rounded-xl hover:bg-orange-600 shadow-sm"
              >
                <Send size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-400 text-center flex items-center justify-center gap-1">
              음성인식을 원하시면 상단의 <Mic size={14} className="inline" /> 버튼을 눌러주세요
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
