import React from 'react';
import { EnhancedDiffSegment, MarkdownFormatting } from '../types';

interface MarkdownAwareDiffRendererProps {
  segments: EnhancedDiffSegment[];
  className?: string;
}

/**
 * Renders markdown-aware diff segments with proper formatting
 */
const MarkdownAwareDiffRenderer: React.FC<MarkdownAwareDiffRendererProps> = ({
  segments,
  className = ''
}) => {
  const groupedSegments = groupSegmentsByCorrectedStructure(segments);
  
  return (
    <div className={`markdown-aware-diff ${className}`}>
      {groupedSegments.map((group, index) => (
        <div key={`${group.type}-${index}`} className={`diff-group diff-group-${group.type}`}>
          {renderSegmentGroup(group)}
        </div>
      ))}
    </div>
  );
};

interface SegmentGroup {
  type: 'heading' | 'paragraph' | 'listItem' | 'blockquote' | 'inline' | 'paragraph_break';
  level?: number; // For headings
  segments: EnhancedDiffSegment[];
}

/**
 * Enhanced post-processing function that re-groups already-computed diff segments
 * based on press release content patterns. This preserves all diff data while
 * improving structural detection for proper HTML rendering.
 */
function groupSegmentsByCorrectedStructure(segments: EnhancedDiffSegment[]): SegmentGroup[] {
  if (!segments || segments.length === 0) return [];
  
  const groups: SegmentGroup[] = [];
  let currentParagraphSegments: EnhancedDiffSegment[] = [];

  function flushParagraphGroup() {
    if (currentParagraphSegments.length > 0) {
      groups.push({
        type: 'paragraph',
        segments: [...currentParagraphSegments]
      });
      currentParagraphSegments = [];
    }
  }

  for (const segment of segments) {
    switch (segment.nodeType) {
      case 'heading':
        flushParagraphGroup(); // Finish any ongoing paragraph before a heading
        groups.push({
          type: 'heading',
          level: segment.formatting.heading,
          segments: [segment]
        });
        break;
      case 'paragraph_break':
        flushParagraphGroup();
        break;
      case 'listItem':
        flushParagraphGroup();
        groups.push({ type: 'listItem', segments: [segment] });
        break;
      case 'blockquote':
        flushParagraphGroup();
        groups.push({ type: 'blockquote', segments: [segment] });
        break;
      case 'paragraph':
      case 'text':
      case 'strong':
      case 'emphasis':
      case 'code':
      default:
        currentParagraphSegments.push(segment);
        break;
    }
  }
  
  flushParagraphGroup();
  
  return groups;
}

/**
 * Render a group of segments with appropriate structural wrapper
 */
function renderSegmentGroup(group: SegmentGroup): React.ReactElement | null {
  if (group.type === 'paragraph_break') return null;

  const content = group.segments.map((segment, index) => (
    <span
      key={index}
      className={`diff-segment diff-${segment.type} ${getFormattingClasses(segment.formatting)}`}
    >
      {segment.content}
    </span>
  ));
  
  switch (group.type) {
    case 'heading':
      const HeadingTag = `h${group.level || 2}` as keyof JSX.IntrinsicElements;
      return (
        <HeadingTag className="prose-custom-heading">
          {content}
        </HeadingTag>
      );
    case 'listItem':
      return (
        <li className="prose-custom-li">
          {content}
        </li>
      );
    case 'blockquote':
      return (
        <blockquote className="prose-custom-blockquote">
          {content}
        </blockquote>
      );
    case 'paragraph':
      if (group.segments.length === 0 || group.segments.every(s => s.content.trim() === '')) {
          return null;
      }
      return (
        <p className="prose-custom-p">
          {content}
        </p>
      );
    default:
      return <>{content}</>;
  }
}

/**
 * Generate CSS classes based on formatting context
 */
function getFormattingClasses(formatting: MarkdownFormatting): string {
  const classes: string[] = [];
  
  if (formatting.bold) classes.push('markdown-bold');
  if (formatting.italic) classes.push('markdown-italic');
  if (formatting.code) classes.push('markdown-code');
  
  return classes.join(' ');
}

export default MarkdownAwareDiffRenderer; 