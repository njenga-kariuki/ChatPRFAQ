export class ContentProcessor {
  private static readonly SAFE_CLEANUP_RULES = [
    // Fix: MLP standalone colons (specific pattern, placed before existing broader rule)
    { pattern: /^(\*\*[^*\n]+\*\*)\s*\n+:\s*$/gm, replacement: '$1:' },
    
    // Remove meta-commentary but preserve line breaks
    { pattern: /^(Here's|Here is|I've created|Below is).*?:?\s*$/gim, replacement: '' },
    { pattern: /^(This document|The following|Let me know if).*?$/gim, replacement: '' },
    
    // Fix: Preserve headers with colons/semicolons on same line
    { pattern: /^(#{1,6}\s+.*?:)\s*\n+/gm, replacement: '$1\n' },
    
    // Fix: Ensure bold text with colons stays together (for MLP plan subheaders)
    { pattern: /^(\*\*[^*]+:\*\*)\s*\n+/gm, replacement: '$1\n' },
    
    // Fix: Bold text followed by external colon (Key Insight, section headers)
    { pattern: /^(\*\*[^*\n]+\*\*)\s*\n+:\s*/gm, replacement: '$1: ' },
    
    // Fix: FAQ Answer indentation (specific to External FAQ format with literal "Question:" text)
    { pattern: /^(\d+\.\s+\*\*Question:\*\*[^\n]+)\n(\s+)(\*\*Answer:\*\*)/gm, replacement: '$1\n$3' },
    
    // Fix: FAQ question continuation (prevent question text from new line)
    { pattern: /^(\d+\.\s+\*\*Question:\*\*)\s*\n+([^#*\n])/gm, replacement: '$1 $2' },
    
    // Fix: Bold text continuation with lowercase (prevent sentence breaks)
    { pattern: /(\*\*[^*\n]+\*\*)\s*\n+\s*([a-z])/gm, replacement: '$1 $2' },
    
    // Normalize spacing: exactly 2 newlines for proper markdown paragraphs (but preserve headers)
    { pattern: /\n{3,}/g, replacement: '\n\n' },
  ];

  static processContent(content: string): string {
    if (!content || typeof content !== 'string') return content || '';
    
    let processed = content;
    
    // Apply only the safest rules with error handling
    for (const rule of this.SAFE_CLEANUP_RULES) {
      try {
        processed = processed.replace(rule.pattern, rule.replacement as string);
      } catch (error) {
        console.warn('ContentProcessor rule failed:', error);
        // Continue with original content if processing fails
      }
    }
    
    return processed.trim();
  }

  static formatForExport(content: string): string {
    const processed = this.processContent(content);
    
    // Only remove markdown headers for plain text export
    return processed
      .replace(/^#+\s*/gm, '')
      .trim();
  }
} 