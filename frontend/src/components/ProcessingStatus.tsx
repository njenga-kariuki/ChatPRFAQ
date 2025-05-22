import React from 'react';

interface ProcessingStatusProps {
  progress: number; // 0-100
  currentStepText: string;
  isVisible: boolean;
}

const ProcessingStatus: React.FC<ProcessingStatusProps> = ({ progress, currentStepText, isVisible }) => {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="w-full bg-gray-700 rounded-full h-2.5">
        <div
          className="bg-sky-500 h-2.5 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        >
        </div>
      </div>
      <p className="text-center text-sm text-gray-300">{currentStepText}</p>
    </div>
  );
};

export default ProcessingStatus; 