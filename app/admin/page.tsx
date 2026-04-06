"use client";

import React, { useState } from 'react';
import { PlusCircle, Calendar, MessageSquare, Image as ImageIcon } from 'lucide-react';

export default function AdminPage() {
  const [questions, setQuestions] = useState([
    { id: '1', type: 'open_ended', target: 'Common', content: '가장 기억에 남는 어린시절 추억은 무엇인가요?', scheduled_at: '2026-04-10T14:00' },
    { id: '2', type: 'photo_based', target: '김철수님', content: '가족 바다여행 사진', scheduled_at: '2026-04-12T14:00' }
  ]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">예약된 질문 관리</h2>
          <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
            <PlusCircle size={20} /> 새 질문 만들기
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-3 font-medium text-gray-600">대상</th>
                <th className="p-3 font-medium text-gray-600">유형</th>
                <th className="p-3 font-medium text-gray-600">내용 (미리보기)</th>
                <th className="p-3 font-medium text-gray-600">발송 예정일</th>
                <th className="p-3 font-medium text-gray-600">상태</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                <tr key={q.id} className="border-b hover:bg-gray-50/50">
                  <td className="p-3">{q.target}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {q.type === 'photo_based' && <ImageIcon size={12} />}
                      {q.type === 'open_ended' && <MessageSquare size={12} />}
                      {q.type}
                    </span>
                  </td>
                  <td className="p-3 max-w-xs truncate">{q.content}</td>
                  <td className="p-3 flex items-center gap-2">
                    <Calendar size={16} className="text-gray-400" />
                    {new Date(q.scheduled_at).toLocaleString('ko-KR')}
                  </td>
                  <td className="p-3">
                    <span className="text-yellow-600 text-sm font-medium">발송 대기중</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
