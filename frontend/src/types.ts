import { Node as UnistNode, Literal as UnistLiteral } from 'unist';

export interface StepData {
  id: number;
  name: string;
  persona: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  input?: string | null;
  output?: string | null;
  error?: string | null;
  isActive?: boolean; // To control accordion open state
  keyInsight?: string | null;
  insightLabel?: string | null;
}

// Add these new interfaces for PR evolution and research artifacts
export interface PRVersions {
  v1_draft?: string;      // From step 3
  v2_refined?: string;    // From step 4
  v3_validated?: string;  // From step 7
  v4_final?: string;      // From step 9 (extracted from PRFAQ)
}

export interface ResearchArtifacts {
  marketResearch?: string;      // From step 1
  problemValidation?: string;   // From step 2
  conceptValidation?: string;   // From step 6
}

export interface DiffSegment {
  type: 'unchanged' | 'added' | 'removed';
  value: string;
  moveInfo?: {
    from?: number;
    to?: number;
  };
}

// New types for markdown-aware diff system
export interface MarkdownFormatting {
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  heading?: number; // 1-6 for h1-h6
  listItem?: boolean;
  blockquote?: boolean;
}

export interface ContentNode {
  type: 'text' | 'emphasis' | 'strong' | 'heading' | 'paragraph' | 'listItem' | 'blockquote' | 'paragraph_break';
  content: string;
  position: { start: number; end: number };
  formatting: MarkdownFormatting;
  path: number[]; // Path in AST for reconstruction
  nodeId: string; // Unique identifier for this node
}

export interface MappedDiff {
  nodeId: string;
  nodeOffset: number;
  length: number;
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  originalNodeIndex: number;
}

export interface EnhancedDiffSegment {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  formatting: MarkdownFormatting;
  nodeType: 'heading' | 'paragraph' | 'listItem' | 'blockquote' | 'text' | 'strong' | 'emphasis' | 'code' | 'paragraph_break';
  originalLineIndex?: number;
}

export interface MarkdownAwareDiff {
  segments: EnhancedDiffSegment[];
  stats: {
    additions: number;
    deletions: number;
    moves: number;
  };
  fallbackUsed: boolean; // Track if we fell back to simple diff
}

export interface VersionComparison {
  from: number;
  to: number;
  segments: DiffSegment[];
  stats: {
    additions: number;
    deletions: number;
    moves: number;
  };
}

export type AstNodeStatus = 'added' | 'removed' | 'changed' | 'unchanged';

export interface MergedAstNode extends UnistNode {
  type: string; 
  diffStatus: AstNodeStatus;
  children?: MergedAstNode[];
  value?: string; 
  charDiff?: Array<[number, string]>; 
  originalValue?: string; 
  ordered?: boolean;
  spread?: boolean;
}

// --- Diff Types --- 

export interface DiffStats {
  additions: number;
  deletions: number;
  moves?: number; // Optional, as not all diffs calculate this
}

// Base for segment-based diffs
export interface BaseSegmentDiff {
  stats: DiffStats;
  // No 'type' discriminator here yet, will be added to specific diff types
}

// For the original character diff (computeDocumentDiff)
export interface DiffSegment {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
}
export interface ProcessedDiff extends BaseSegmentDiff {
  type: 'char_diff'; // Discriminator
  segments: DiffSegment[];
}

// For the markdown-aware diff (computeMarkdownAwareDiff)
export interface EnhancedDiffSegment {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  formatting: MarkdownFormatting;
  nodeType: 'heading' | 'paragraph' | 'listItem' | 'blockquote' | 'text' | 'strong' | 'emphasis' | 'code' | 'paragraph_break';
  originalLineIndex?: number;
}
export interface MarkdownAwareDiff extends BaseSegmentDiff {
  type: 'markdown_aware'; // Discriminator
  segments: EnhancedDiffSegment[];
  fallbackUsed: boolean;
}

// For the new AST-based diff
export interface MergedAstNode extends UnistNode {
  type: string; 
  diffStatus: AstNodeStatus;
  children?: MergedAstNode[];
  value?: string; 
  charDiff?: Array<[number, string]>; 
  originalValue?: string; 
}
export interface AstDiffResult {
  type: 'ast'; // Discriminator
  nodes: MergedAstNode[];
  stats: DiffStats;
}

// Union of all possible diff result types
export type DiffResultType = AstDiffResult | MarkdownAwareDiff | ProcessedDiff; 