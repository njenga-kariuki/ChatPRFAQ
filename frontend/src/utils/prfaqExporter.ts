import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } from 'docx';

// Formatting configuration
const PRFAQ_FORMATTING = {
  document: {
    margins: { top: 720, right: 720, bottom: 720, left: 720 }, // 0.5 inch = 720 twips
    defaultFont: "Calibri",
  },
  
  styles: {
    headline: {
      size: 20, // 10pt × 2 (docx uses half-points)
      bold: true,
      alignment: AlignmentType.CENTER,
      spacingAfter: 240, // 12pt
    },
    
    subheading: {
      size: 20, // 10pt × 2
      italic: true,
      alignment: AlignmentType.CENTER,
      spacingAfter: 360, // 18pt
    },
    
    body: {
      size: 20, // 10pt × 2
      spacingAfter: 120, // 6pt
      lineSpacing: 276, // 1.15
    },
    
    faqSectionHeader: {
      size: 20, // 10pt × 2
      bold: true,
      underline: true,
      spacingBefore: 480, // 24pt
      spacingAfter: 240, // 12pt
    },
    
    faqQuestion: {
      size: 20, // 10pt × 2
      bold: true,
      spacingAfter: 60, // 3pt
    },
    
    faqAnswer: {
      size: 20, // 10pt × 2
      indent: 720, // 0.5 inch left
      spacingAfter: 240, // 12pt
    },
    
    quote: {
      size: 20, // 10pt × 2
      italic: true,
      indent: 720, // 0.5 inch left
      spacingBefore: 120, // 6pt
      spacingAfter: 120, // 6pt
    }
  }
};

// Pattern matchers for different content types
const PATTERNS = {
  faqStandard: /(\d+)\.\s+\*\*Question:\*\*\s+(.+?)\s+\*\*Answer:\*\*\s+(.+?)(?=\d+\.\s+\*\*Question:|$)/gs,
  faqNumbered: /(\d+)\.\s+\*\*Question:\*\*\s+(.+?)\n+\*\*Answer:\*\*\s+(.+?)(?=\d+\.\s+\*\*Question:|$)/gs,
  boldLine: /^\*\*(.+?)\*\*$/,
  italicLine: /^\*(.+?)\*$/,
  internalQuote: /[""](.+?)[""].*?[-–—]\s*(.+?)$/,
};

interface ParsedContent {
  pressRelease: {
    headline?: string;
    subheading?: string;
    body: string[];
  };
  faqSections: Array<{
    title: string;
    questions: Array<{ number: string; question: string; answer: string }>;
  }>;
  // Legacy fallback for backward compatibility
  faq: {
    questions: Array<{ number: string; question: string; answer: string }>;
  };
}

function parsePRFAQ(content: string): ParsedContent {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  const parsed: ParsedContent = {
    pressRelease: {
      body: []
    },
    faqSections: [],
    faq: {
      questions: []
    }
  };
  
  let currentSection: 'pr' | 'faq' = 'pr';
  let lineIndex = 0;
  
  // Find headline (first bold line)
  while (lineIndex < lines.length) {
    const line = lines[lineIndex];
    const boldMatch = line.match(PATTERNS.boldLine);
    if (boldMatch) {
      parsed.pressRelease.headline = boldMatch[1];
      lineIndex++;
      break;
    }
    lineIndex++;
  }
  
  // Find subheading (first italic line after headline)
  while (lineIndex < lines.length) {
    const line = lines[lineIndex];
    const italicMatch = line.match(PATTERNS.italicLine);
    if (italicMatch) {
      parsed.pressRelease.subheading = italicMatch[1];
      lineIndex++;
      break;
    }
    lineIndex++;
  }
  
  // Process remaining content
  for (let i = lineIndex; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if we're entering FAQ section
    if (line.toLowerCase().includes('frequently asked questions') || 
        line.toLowerCase().includes('customer faq') ||
        line.toLowerCase().includes('external faq') ||
        line.toLowerCase().includes('internal faq')) {
      currentSection = 'faq';
      continue;
    }
    
    // Skip section headers
    if (line.match(/^(Section \d+:|##|#)/)) {
      continue;
    }
    
    if (currentSection === 'pr') {
      parsed.pressRelease.body.push(line);
    }
  }
  
  // Enhanced FAQ section parsing with section awareness
  const faqStartIndex = content.search(/frequently asked questions|customer faq|external faq|internal faq/i);
  if (faqStartIndex !== -1) {
    const faqContent = content.substring(faqStartIndex);
    
    // Split content by potential section headers
    const sectionPattern = /(customer faq|external faq|internal faq|frequently asked questions)/gi;
    const sections = faqContent.split(sectionPattern).filter(part => part.trim());
    
    let sectionsFound = false;
    
    // Process sections in pairs (header, content)
    for (let i = 0; i < sections.length - 1; i += 2) {
      const sectionHeader = sections[i]?.toLowerCase().trim();
      const sectionContent = sections[i + 1]?.trim();
      
      if (!sectionHeader || !sectionContent) continue;
      
      // Determine section title based on header
      let sectionTitle = 'Frequently Asked Questions'; // Default
      if (sectionHeader.includes('customer') || sectionHeader.includes('external')) {
        sectionTitle = 'Customer FAQ';
      } else if (sectionHeader.includes('internal')) {
        sectionTitle = 'Internal FAQ';
      }
      
      // Parse questions from this section content
      let sectionQuestions: Array<{ number: string; question: string; answer: string }> = [];
      
      // Try different FAQ patterns
      let faqMatches = Array.from(sectionContent.matchAll(PATTERNS.faqStandard));
      if (faqMatches.length === 0) {
        faqMatches = Array.from(sectionContent.matchAll(PATTERNS.faqNumbered));
      }
      
      for (const match of faqMatches) {
        sectionQuestions.push({
          number: match[1],
          question: match[2].trim(),
          answer: match[3].trim()
        });
      }
      
      // Only add section if it has questions
      if (sectionQuestions.length > 0) {
        sectionsFound = true;
        parsed.faqSections.push({
          title: sectionTitle,
          questions: sectionQuestions
        });
      }
    }
    
    // Fallback: If no sections found, use legacy behavior
    if (!sectionsFound) {
      let faqMatches = Array.from(faqContent.matchAll(PATTERNS.faqStandard));
      if (faqMatches.length === 0) {
        faqMatches = Array.from(faqContent.matchAll(PATTERNS.faqNumbered));
      }
      
      for (const match of faqMatches) {
        parsed.faq.questions.push({
          number: match[1],
          question: match[2].trim(),
          answer: match[3].trim()
        });
      }
    }
  }
  
  return parsed;
}

function createParagraph(text: string, style: any, options: any = {}): Paragraph {
  const textRun = new TextRun({
    text: text,
    size: style.size,
    bold: style.bold || false,
    italics: style.italic || false,
    underline: style.underline || false,
    font: PRFAQ_FORMATTING.document.defaultFont,
  });
  
  return new Paragraph({
    children: [textRun],
    alignment: style.alignment || AlignmentType.LEFT,
    spacing: {
      after: style.spacingAfter || 120,
      before: style.spacingBefore || 0,
      line: style.lineSpacing || 276,
    },
    indent: {
      left: style.indent || options.indent || 0,
      firstLine: options.firstLineIndent || 0,
    },
  });
}

export async function exportPRFAQToWord(content: string, productIdea: string): Promise<void> {
  const parsed = parsePRFAQ(content);
  const children: Paragraph[] = [];
  
  // Add headline
  if (parsed.pressRelease.headline) {
    children.push(createParagraph(
      parsed.pressRelease.headline,
      PRFAQ_FORMATTING.styles.headline
    ));
  }
  
  // Add subheading
  if (parsed.pressRelease.subheading) {
    children.push(createParagraph(
      parsed.pressRelease.subheading,
      PRFAQ_FORMATTING.styles.subheading
    ));
  }
  
  // Add body paragraphs
  for (const paragraph of parsed.pressRelease.body) {
    if (paragraph.trim()) {
      // Check if it's a quote
      const quoteMatch = paragraph.match(PATTERNS.internalQuote);
      if (quoteMatch) {
        children.push(createParagraph(
          paragraph,
          PRFAQ_FORMATTING.styles.quote
        ));
      } else {
        children.push(createParagraph(
          paragraph,
          PRFAQ_FORMATTING.styles.body,
          { firstLineIndent: 720 } // 0.5 inch first line indent for body paragraphs
        ));
      }
    }
  }
  
  // Add FAQ sections if present
  if (parsed.faqSections.length > 0) {
    for (const section of parsed.faqSections) {
      // Add section header
      children.push(createParagraph(
        section.title,
        PRFAQ_FORMATTING.styles.faqSectionHeader
      ));
      
      // Add each Q&A pair
      for (const qa of section.questions) {
        // Question
        children.push(createParagraph(
          `${qa.number}. ${qa.question}`,
          PRFAQ_FORMATTING.styles.faqQuestion
        ));
        
        // Answer
        children.push(createParagraph(
          qa.answer,
          PRFAQ_FORMATTING.styles.faqAnswer
        ));
      }
    }
  } else if (parsed.faq.questions.length > 0) {
    // Fallback: Use legacy single FAQ section behavior
    children.push(createParagraph(
      "Frequently Asked Questions",
      PRFAQ_FORMATTING.styles.faqSectionHeader
    ));
    
    // Add each Q&A pair
    for (const qa of parsed.faq.questions) {
      // Question
      children.push(createParagraph(
        `${qa.number}. ${qa.question}`,
        PRFAQ_FORMATTING.styles.faqQuestion
      ));
      
      // Answer
      children.push(createParagraph(
        qa.answer,
        PRFAQ_FORMATTING.styles.faqAnswer
      ));
    }
  }
  
  // Create document
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: PRFAQ_FORMATTING.document.margins,
        },
      },
      children: children,
    }],
  });
  
  // Generate and download
  const blob = await Packer.toBlob(doc);
  
  // Create filename
  const date = new Date().toISOString().split('T')[0];
  const productName = productIdea.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `PRFAQ_${productName}_${date}.docx`;
  
  // Try modern file system API first for better UX
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'Word Document',
          accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      // User cancelled or API not supported, fall back to traditional download
    }
  }
  
  // Traditional download fallback
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
} 