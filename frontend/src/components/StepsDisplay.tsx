import React from 'react';
import { StepData } from '../types';
import StepCard from './StepCard';

interface StepsDisplayProps {
  steps: StepData[];
  onToggleStep: (stepId: number) => void;
  isVisible: boolean;
}

const StepsDisplay: React.FC<StepsDisplayProps> = ({ steps, onToggleStep, isVisible }) => {
  if (!isVisible || !steps || steps.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {steps.map((step) => (
        <StepCard 
          key={step.id} 
          step={step} 
          onToggle={() => onToggleStep(step.id)} 
        />
      ))}
    </div>
  );
};

export default StepsDisplay; 