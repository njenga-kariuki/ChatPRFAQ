import React, { useEffect } from 'react';

interface CopyToastProps {
  show: boolean;
  message?: string;
}

const CopyToast: React.FC<CopyToastProps> = ({ show, message = 'Copied to clipboard!' }) => {
  if (!show) return null;

  return (
    <div className="fixed bottom-6 right-6 animate-slideIn z-[60]">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 min-w-[200px]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-900">{message}</p>
        </div>
      </div>
    </div>
  );
};

export default CopyToast; 