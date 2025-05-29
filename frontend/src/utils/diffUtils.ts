import DiffMatchPatch from 'diff-match-patch';
import React from 'react';
import { DiffSegment } from '../types';
import { ContentProcessor } from './contentProcessor';

const dmp = new DiffMatchPatch();

export interface ProcessedDiff {
  segments: DiffSegment[];
  stats: {
    additions: number;
    deletions: number;
    moves: number;
  };
  type: 'char_diff';
}

export function computeDocumentDiff(oldText: string, newText: string): ProcessedDiff {
  // Normalize line endings and apply ContentProcessor to both versions
  const normalizedOld = oldText.replace(/\r\n/g, '\n').trim();
  const normalizedNew = newText.replace(/\r\n/g, '\n').trim();
  
  // Apply ContentProcessor to ensure consistent formatting before diff computation
  const processedOld = ContentProcessor.processContent(normalizedOld);
  const processedNew = ContentProcessor.processContent(normalizedNew);
  
  // Compute semantic diff for better results
  const diffs = dmp.diff_main(processedOld, processedNew);
  dmp.diff_cleanupSemantic(diffs);
  
  // Convert to our segment format
  const segments: DiffSegment[] = [];
  let additions = 0;
  let deletions = 0;
  
  diffs.forEach(([operation, text]) => {
    if (operation === 0) {
      segments.push({ type: 'unchanged', value: text });
    } else if (operation === 1) {
      segments.push({ type: 'added', value: text });
      additions += text.length;
    } else if (operation === -1) {
      segments.push({ type: 'removed', value: text });
      deletions += text.length;
    }
  });
  
  return {
    type: 'char_diff',
    segments,
    stats: {
      additions,
      deletions,
      moves: 0 // Move detection would require more complex logic
    }
  };
}

export function renderDiffSegment(segment: DiffSegment): JSX.Element {
  const { type, value } = segment;
  
  // Check if this is a complete paragraph (starts and ends with newlines)
  const isCompleteParagraph = value.trim().includes('\n\n');
  
  switch (type) {
    case 'added':
      if (isCompleteParagraph) {
        return React.createElement('div', { 
          className: 'diff-added-paragraph',
          key: Math.random() 
        }, [
          React.createElement('span', { 
            className: 'diff-new-badge',
            key: 'badge'
          }, 'NEW'),
          React.createElement('span', { 
            className: 'diff-added-text',
            key: 'text'
          }, value)
        ]);
      }
      return React.createElement('span', { 
        className: 'diff-added',
        key: Math.random()
      }, value);
      
    case 'removed':
      return React.createElement('span', { 
        className: 'diff-removed',
        key: Math.random()
      }, value);
      
    case 'unchanged':
    default:
      return React.createElement('span', { 
        key: Math.random()
      }, value);
  }
} 