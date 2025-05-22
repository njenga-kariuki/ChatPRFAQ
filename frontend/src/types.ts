export interface StepData {
  id: number;
  name: string;
  persona: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  input?: string | null;
  output?: string | null;
  error?: string | null;
  isActive?: boolean; // To control accordion open state
} 