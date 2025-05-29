import DiffMatchPatch from 'diff-match-patch';
import { 
  ContentNode, 
  MarkdownFormatting, 
  MappedDiff, 
  EnhancedDiffSegment, 
  MarkdownAwareDiff 
} from '../types';
import { ContentProcessor } from './contentProcessor';

const dmp = new DiffMatchPatch();

/**
 * Phase A: Markdown Pattern Recognition and Content Extraction
 */

// Markdown patterns for identifying formatting
const MARKDOWN_PATTERNS = {
  heading: /^(#{1,6})\s+(.+)$/gm,
  bold: /\*\*(.*?)\*\*/g,
  italic: /\*(.*?)\*/g,
  code: /`(.*?)`/g,
  listItem: /^[\s]*[-*+]\s+(.+)$/gm,
  blockquote: /^>\s+(.+)$/gm,
};

function isEntirelyBold(line: string): boolean {
  const trimmed = line.trim();
  // Check if the line starts with **, ends with **, and the only occurrences of ** are at the start and end.
  return trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length > 4 && 
         trimmed.indexOf('**', 1) === trimmed.length - 2;
}

function isEntirelyItalic(line: string): boolean {
  const trimmed = line.trim();
  if (isEntirelyBold(trimmed)) return false; // Bold takes precedence for our PR headlines

  const isAsterisk = trimmed.startsWith('*') && trimmed.endsWith('*') && trimmed.length > 2 && 
                     trimmed.indexOf('*', 1) === trimmed.length - 1;
  const isUnderscore = trimmed.startsWith('_') && trimmed.endsWith('_') && trimmed.length > 2 && 
                       trimmed.indexOf('_', 1) === trimmed.length - 1;
  return isAsterisk || isUnderscore;
}

/**
 * Extract content nodes using pattern matching approach
 */
export function extractContentNodes(text: string): ContentNode[] {
  const nodes: ContentNode[] = [];
  let nodeCounter = 0;
  
  const processedText = ContentProcessor.processContent(text);
  const lines = processedText.split('\n');
  let currentOffset = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const lineStart = currentOffset;
    const lineEnd = currentOffset + line.length;
    const nodeIdBase = `node_${nodeCounter}`; // Unique base for nodeId

    if (line.trim() === '') {
      nodes.push({
        type: 'paragraph_break',
        content: '',
        position: { start: lineStart, end: lineEnd },
        formatting: {},
        path: [lineIndex],
        nodeId: `${nodeIdBase}_pb_${nodeCounter++}`
      });
    } else if (isEntirelyBold(line)) {
      nodes.push({
        type: 'heading',
        content: line.trim().substring(2, line.trim().length - 2),
        position: { start: lineStart, end: lineEnd },
        formatting: { bold: true, heading: 2 }, // H2 for main headlines
        path: [lineIndex],
        nodeId: `${nodeIdBase}_h2_${nodeCounter++}`
      });
    } else if (isEntirelyItalic(line) && 
               nodes.length > 0 && 
               nodes[nodes.length -1].type === 'heading' && 
               nodes[nodes.length -1].formatting.heading === 2) {
      nodes.push({
        type: 'heading',
        content: line.trim().substring(1, line.trim().length - 1),
        position: { start: lineStart, end: lineEnd },
        formatting: { italic: true, heading: 3 }, // H3 for subheadlines
        path: [lineIndex],
        nodeId: `${nodeIdBase}_h3_${nodeCounter++}`
      });
    } else {
      let matchedBlock = false;
      const headingMatch = line.match(MARKDOWN_PATTERNS.heading);
      if (headingMatch) {
        const [, hashes, content] = headingMatch;
        nodes.push({
          type: 'heading',
          content: content.trim(),
          position: { start: lineStart, end: lineEnd },
          formatting: { heading: parseInt(hashes.replace(/#/g, ''), 10) },
          path: [lineIndex],
          nodeId: `${nodeIdBase}_h${hashes.length}_${nodeCounter++}`
        });
        matchedBlock = true;
      } else if (line.match(MARKDOWN_PATTERNS.listItem)) {
        const content = line.replace(/^\s*[-*+]\s+/, '');
        nodes.push({
          type: 'listItem',
          content: content.trim(),
          position: { start: lineStart, end: lineEnd },
          formatting: { listItem: true },
          path: [lineIndex],
          nodeId: `${nodeIdBase}_li_${nodeCounter++}`
        });
        matchedBlock = true;
      } else if (line.match(MARKDOWN_PATTERNS.blockquote)) {
        const content = line.replace(/^>\s+/, '');
        nodes.push({
          type: 'blockquote',
          content: content.trim(),
          position: { start: lineStart, end: lineEnd },
          formatting: { blockquote: true },
          path: [lineIndex],
          nodeId: `${nodeIdBase}_bq_${nodeCounter++}`
        });
        matchedBlock = true;
      }
      
      if (!matchedBlock && line.trim()) {
        nodes.push({
          type: 'paragraph', 
          content: line,
          position: { start: lineStart, end: lineEnd },
          formatting: {}, // Inline formatting within this line is not deeply parsed here.
                          // For diffing, the line content is used. The renderer will handle display.
          path: [lineIndex],
          nodeId: `${nodeIdBase}_p_${nodeCounter++}`
        });
      } else if (!matchedBlock && line.length > 0 && line.trim() === '') { // Line with only spaces
        nodes.push({
            type: 'paragraph_break',
            content: '',
            position: { start: lineStart, end: lineEnd },
            formatting: {},
            path: [lineIndex],
            nodeId: `${nodeIdBase}_pb_${nodeCounter++}`
        });
      }
    }
    currentOffset += line.length + 1; 
  }
  return nodes;
}

/**
 * Extract inline formatted content from a line
 */
function extractInlineContent(
  line: string, 
  lineStart: number, 
  lineIndex: number, 
  nodes: ContentNode[], 
  nodeCounter: number
): void {
  let remainingText = line;
  let currentOffset = 0;
  let inlineCounter = 0;
  
  // Process bold text
  let match;
  while ((match = MARKDOWN_PATTERNS.bold.exec(remainingText)) !== null) {
    const [fullMatch, content] = match;
    const matchStart = match.index!;
    
    // Add text before the match if any
    if (matchStart > currentOffset) {
      const beforeText = remainingText.substring(currentOffset, matchStart);
      if (beforeText.trim()) {
        nodes.push({
          type: 'text',
          content: beforeText,
          position: { start: lineStart + currentOffset, end: lineStart + matchStart },
          formatting: {},
          path: [lineIndex, inlineCounter++],
          nodeId: `node_${nodeCounter + inlineCounter}`
        });
      }
    }
    
    // Add the bold content
    nodes.push({
      type: 'strong',
      content: content,
      position: { start: lineStart + matchStart, end: lineStart + matchStart + fullMatch.length },
      formatting: { bold: true },
      path: [lineIndex, inlineCounter++],
      nodeId: `node_${nodeCounter + inlineCounter}`
    });
    
    currentOffset = matchStart + fullMatch.length;
  }
  
  // Reset regex
  MARKDOWN_PATTERNS.bold.lastIndex = 0;
  
  // Add remaining text
  if (currentOffset < remainingText.length) {
    const remainingContent = remainingText.substring(currentOffset);
    if (remainingContent.trim()) {
      nodes.push({
        type: 'text',
        content: remainingContent,
        position: { start: lineStart + currentOffset, end: lineStart + remainingText.length },
        formatting: {},
        path: [lineIndex, inlineCounter++],
        nodeId: `node_${nodeCounter + inlineCounter}`
      });
    }
  }
}

/**
 * Extract pure text content from content nodes for diffing
 */
export function extractPureContent(nodes: ContentNode[]): string {
  return nodes
    .filter(node => node.type !== 'paragraph_break') // Exclude paragraph_break nodes from pure text
    .map(node => node.content)
    .join('\n'); // Join content of remaining nodes with a single newline for diffing
}

/**
 * Phase B: Content-Only Diff Computation
 */

/**
 * Compute character-level diff on pure content only
 */
export function computeContentDiff(fromNodes: ContentNode[], toNodes: ContentNode[]): MappedDiff[] {
  const fromContent = extractPureContent(fromNodes);
  const toContent = extractPureContent(toNodes);
  
  const diffs = dmp.diff_main(fromContent, toContent);
  dmp.diff_cleanupSemantic(diffs);
  
  return mapDiffsToNodes(diffs, fromNodes, toNodes);
}

/**
 * Map character-level diffs back to content nodes
 */
function mapDiffsToNodes(
  diffs: [number, string][], 
  fromNodes: ContentNode[], 
  toNodes: ContentNode[]
): MappedDiff[] {
  const mappedDiffs: MappedDiff[] = [];
  let currentFromNodeCursor = { index: 0, offsetInNode: 0 }; 
  let currentToNodeCursor = { index: 0, offsetInNode: 0 };   

  function mapCurrentOperationToSourceNodes(
    textSegmentFromDiff: string, 
    sourceNodeList: ContentNode[], 
    sourceNodeCursor: { index: number, offsetInNode: number },
    operationType: 'added' | 'removed' | 'unchanged'
  ): void {
    let remainingTextToMap = textSegmentFromDiff;
    
    // Outer loop: continue as long as there's text to map and nodes to map to
    while (remainingTextToMap.length > 0 && sourceNodeCursor.index < sourceNodeList.length) {
      
      // Inner loop: Advance cursor past any paragraph_break nodes first
      while (sourceNodeCursor.index < sourceNodeList.length && 
             sourceNodeList[sourceNodeCursor.index].type === 'paragraph_break') {
        sourceNodeCursor.index++;
        sourceNodeCursor.offsetInNode = 0; 
      }

      // If, after skipping paragraph_breaks, we're at the end of the list, 
      // no more content nodes to map to, so break the outer loop.
      if (sourceNodeCursor.index >= sourceNodeList.length) {
        break; 
      }
      
      // At this point, sourceNodeList[sourceNodeCursor.index] is guaranteed to be a non-paragraph_break ContentNode
      const currentNode: ContentNode = sourceNodeList[sourceNodeCursor.index]; 

      const charsLeftInCurrentNode = currentNode.content.length - sourceNodeCursor.offsetInNode;
      const charsToTakeFromCurrentNode = Math.min(remainingTextToMap.length, charsLeftInCurrentNode);

      if (charsToTakeFromCurrentNode > 0) {
        mappedDiffs.push({
          nodeId: currentNode.nodeId,
          nodeOffset: sourceNodeCursor.offsetInNode,
          length: charsToTakeFromCurrentNode,
          type: operationType,
          content: remainingTextToMap.substring(0, charsToTakeFromCurrentNode), 
          originalNodeIndex: sourceNodeCursor.index 
        });
        remainingTextToMap = remainingTextToMap.substring(charsToTakeFromCurrentNode);
        sourceNodeCursor.offsetInNode += charsToTakeFromCurrentNode;
      }

      // If we've consumed the current node, advance to the next node and reset offset
      if (sourceNodeCursor.offsetInNode >= currentNode.content.length) {
        sourceNodeCursor.index++;
        sourceNodeCursor.offsetInNode = 0;
      }
      
      // If all text for this operation has been mapped, exit the outer loop
      if (remainingTextToMap.length === 0) {
          break;
      }
    }

    // If there's still text remaining to map but no more nodes, it's an issue (should ideally not happen with correct diffs)
    if (remainingTextToMap.length > 0) {
        console.warn("Unmapped text remaining in mapCurrentOperationToSourceNodes:", remainingTextToMap, operationType);
    }
  }

  for (const [operation, text] of diffs) {
    if (text.length === 0) continue;

    switch (operation) {
      case 0: // Unchanged
        mapCurrentOperationToSourceNodes(text, fromNodes, currentFromNodeCursor, 'unchanged');
        mapCurrentOperationToSourceNodes(text, toNodes, currentToNodeCursor, 'unchanged');
        break;
      case -1: // Removed
        mapCurrentOperationToSourceNodes(text, fromNodes, currentFromNodeCursor, 'removed');
        break;
      case 1: // Added
        mapCurrentOperationToSourceNodes(text, toNodes, currentToNodeCursor, 'added');
        break;
    }
  }
  return mappedDiffs;
}

/**
 * Phase C: Enhanced Diff Generation
 */

/**
 * Main function: Compute markdown-aware diff with fallback
 */
export function computeMarkdownAwareDiff(fromText: string, toText: string): MarkdownAwareDiff {
  try {
    const fromNodes = extractContentNodes(fromText);
    const toNodes = extractContentNodes(toText);
    const mappedDiffs = computeContentDiff(fromNodes, toNodes);
    const segments = convertToEnhancedSegments(mappedDiffs, fromNodes, toNodes);
    const stats = calculateStats(segments);
    
    return {
      type: 'markdown_aware',
      segments,
      stats,
      fallbackUsed: false
    };
    
  } catch (error) {
    console.warn('Markdown-aware diff failed, using fallback:', error);
    return createFallbackDiff(fromText, toText);
  }
}

/**
 * Convert mapped diffs to enhanced segments with formatting
 */
function convertToEnhancedSegments(
  mappedDiffs: MappedDiff[], 
  fromNodes: ContentNode[], 
  toNodes: ContentNode[]
): EnhancedDiffSegment[] {
  const segments: EnhancedDiffSegment[] = [];
  
  for (const diff of mappedDiffs) {
    const sourceNodes = diff.type === 'added' ? toNodes : fromNodes;
    let sourceNode: ContentNode | undefined = undefined;

    // Try to get the source node using originalNodeIndex first, as it should be more direct if mapping was perfect.
    if (diff.originalNodeIndex !== undefined && diff.originalNodeIndex >= 0 && diff.originalNodeIndex < sourceNodes.length) {
        const potentialNode = sourceNodes[diff.originalNodeIndex];
        // Verify that the nodeId matches, as originalNodeIndex might be from a list that included paragraph_breaks not in the diff content string
        if (potentialNode && potentialNode.nodeId === diff.nodeId) {
            sourceNode = potentialNode;
        }
    }

    // If not found or nodeId didn't match, fallback to finding by nodeId.
    // This is a safeguard.
    if (!sourceNode) {
        sourceNode = sourceNodes.find(n => n.nodeId === diff.nodeId);
    }
    
    if (sourceNode) {
      // If the sourceNode is a paragraph_break, we still create a segment for it,
      // as the renderer might use these explicit break markers.
      segments.push({
        type: diff.type,
        content: diff.content, // Content from the diff operation
        formatting: sourceNode.formatting,
        nodeType: sourceNode.type as EnhancedDiffSegment['nodeType'],
        originalLineIndex: sourceNode.path && sourceNode.path.length > 0 ? sourceNode.path[0] : undefined
      });
    } else {
      // If, after all attempts, sourceNode is still not found, this indicates a potential issue
      // in the mapping of diffs back to nodes. Log a warning and skip this segment.
      console.warn('Could not map diff segment back to any source node. Skipping segment:', diff);
      // Do NOT push a segment if sourceNode is not found, to avoid errors.
    }
  }
  return segments;
}

/**
 * Calculate diff statistics
 */
function calculateStats(segments: EnhancedDiffSegment[]) {
  let additions = 0;
  let deletions = 0;
  for (const segment of segments) {
    if (segment.nodeType !== 'paragraph_break') { 
        if (segment.type === 'added') {
          additions += segment.content.length;
        } else if (segment.type === 'removed') {
          deletions += segment.content.length;
        }
    }
  }
  return { additions, deletions, moves: 0 };
}

/**
 * Fallback to simple character diff when markdown parsing fails
 */
function createFallbackDiff(fromText: string, toText: string): MarkdownAwareDiff {
  const processedFrom = ContentProcessor.processContent(fromText);
  const processedTo = ContentProcessor.processContent(toText);
  
  const diffs = dmp.diff_main(processedFrom, processedTo);
  dmp.diff_cleanupSemantic(diffs);
  
  const segments: EnhancedDiffSegment[] = diffs.map(([operation, text]) => ({
    type: operation === 0 ? 'unchanged' : operation === 1 ? 'added' : 'removed',
    content: text,
    formatting: {},
    nodeType: 'text',
    originalLineIndex: undefined 
  }));
  
  const stats = calculateStats(segments);
  return {
    type: 'markdown_aware',
    segments, 
    stats, 
    fallbackUsed: true 
  };
} 