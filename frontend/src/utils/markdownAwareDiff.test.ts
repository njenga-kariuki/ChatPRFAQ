import { computeMarkdownAwareDiff, extractContentNodes } from './markdownAwareDiff';

// Simple test to verify the markdown-aware diff functionality
export function testMarkdownAwareDiff() {
  console.log('Testing markdown-aware diff...');
  
  // Test 1: Simple text change
  const fromText1 = "# Product Manager\n\nThis is a **great** product.";
  const toText1 = "# Senior Product Manager\n\nThis is a **great** product.";
  
  try {
    const result1 = computeMarkdownAwareDiff(fromText1, toText1);
    console.log('Test 1 - Simple text change:', {
      fallbackUsed: result1.fallbackUsed,
      segmentCount: result1.segments.length,
      stats: result1.stats
    });
  } catch (error) {
    console.error('Test 1 failed:', error);
  }
  
  // Test 2: Content extraction
  const testText = "# Heading\n\nThis is **bold** text with *italic* content.";
  
  try {
    const nodes = extractContentNodes(testText);
    console.log('Test 2 - Content extraction:', {
      nodeCount: nodes.length,
      nodes: nodes.map(n => ({ type: n.type, content: n.content, formatting: n.formatting }))
    });
  } catch (error) {
    console.error('Test 2 failed:', error);
  }
  
  console.log('Markdown-aware diff tests completed.');
}

// Export for potential use in development
if (typeof window !== 'undefined') {
  (window as any).testMarkdownAwareDiff = testMarkdownAwareDiff;
} 