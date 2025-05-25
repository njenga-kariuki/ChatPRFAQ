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

  // Ensure progress is between 0 and 100 for calculations
  const normalizedProgress = Math.max(0, Math.min(100, progress));
  const circumference = 2 * Math.PI * 45; // Corresponds to r="45"

  return (
    <div className="space-y-6">
      
      {/* Circular Progress Ring */}
      <div className="flex items-center justify-center">
        <div className="relative">
          <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50" cy="50" r="45"
              stroke="currentColor" strokeWidth="6" fill="transparent"
              className="text-slate-700"
            />
            <circle
              cx="50" cy="50" r="45"
              stroke="url(#progressGradient)" strokeWidth="6" fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - normalizedProgress / 100)}
              strokeLinecap="round"
              className="transition-all duration-300 ease-out"
            />
            <defs>
              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{Math.min(Math.round(normalizedProgress), 100)}%</div>
              <div className="text-xs text-slate-400">Complete</div>
            </div>
          </div>
        </div>
      </div>

      {/* Current step text with better styling */}
      <div className="text-center">
        <p className="text-lg font-medium text-slate-200">{currentStepText}</p>
      </div>
    </div>
  );
};

export default ProcessingStatus; 