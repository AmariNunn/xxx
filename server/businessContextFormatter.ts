/**
 * Business Context Formatter
 * 
 * Formats business context data (files, links, notes) into AI-readable prompt content
 * for integration with ElevenLabs voice agents.
 */

export interface BusinessContextData {
  description?: string | null;
  links?: string[] | null;
  scrapedContent?: string[] | null;
  scrapedTitles?: string[] | null;
  scrapedUrls?: string[] | null;
  scrapedAt?: string[] | null;
  fileNames?: string[] | null;
  fileTypes?: string[] | null;
  fileUrls?: string[] | null;
  fileSizes?: string[] | null;
  businessName?: string | null;
  businessEmail?: string | null;
  businessPhone?: string | null;
  businessAddress?: string | null;
}

/**
 * Formats business context data into a structured prompt section
 * for the AI voice agent to understand the business better
 */
export function formatBusinessContext(businessData: BusinessContextData): string {
  if (!businessData) {
    return "";
  }

  const contextSections: string[] = [];

  // Business Profile Section
  const businessProfile = formatBusinessProfile(businessData);
  if (businessProfile) {
    contextSections.push(businessProfile);
  }

  // Uploaded Files Section
  const filesContext = formatFilesContext(businessData);
  if (filesContext) {
    contextSections.push(filesContext);
  }

  // Website Links Section
  const linksContext = formatLinksContext(businessData);
  if (linksContext) {
    contextSections.push(linksContext);
  }

  // Scraped Website Content Section
  const scrapedContext = formatScrapedWebsiteContent(businessData);
  if (scrapedContext) {
    contextSections.push(scrapedContext);
  }

  // Business Notes & Instructions
  const notesContext = formatNotesContext(businessData);
  if (notesContext) {
    contextSections.push(notesContext);
  }

  if (contextSections.length === 0) {
    return "";
  }

  return `

=== BUSINESS CONTEXT ===
The following information provides essential context about this business. Use this information to personalize your responses and better assist callers:

${contextSections.join('\n\n')}

Remember to reference this business context naturally in your conversations when relevant, and use this information to provide more accurate and personalized assistance to callers.
`;
}

/**
 * Formats business profile information
 */
function formatBusinessProfile(data: BusinessContextData): string {
  const profileParts: string[] = [];

  if (data.businessName) {
    profileParts.push(`Business Name: ${data.businessName}`);
  }

  if (data.businessEmail) {
    profileParts.push(`Contact Email: ${data.businessEmail}`);
  }

  if (data.businessPhone) {
    profileParts.push(`Business Phone: ${data.businessPhone}`);
  }

  if (data.businessAddress) {
    profileParts.push(`Address: ${data.businessAddress}`);
  }

  if (profileParts.length === 0) {
    return "";
  }

  return `BUSINESS PROFILE:
${profileParts.join('\n')}`;
}

/**
 * Formats uploaded files context
 */
function formatFilesContext(data: BusinessContextData): string {
  if (!data.fileNames || data.fileNames.length === 0) {
    return "";
  }

  const filesInfo: string[] = [];
  
  data.fileNames.forEach((fileName, index) => {
    const fileType = data.fileTypes?.[index] || 'unknown';
    const fileSize = data.fileSizes?.[index] || 'unknown size';
    
    let typeDescription = '';
    if (fileType.includes('pdf')) {
      typeDescription = '(PDF document)';
    } else if (fileType.includes('word') || fileType.includes('docx')) {
      typeDescription = '(Word document)';
    } else if (fileType.includes('image')) {
      typeDescription = '(Image file)';
    } else {
      typeDescription = `(${fileType})`;
    }

    filesInfo.push(`- ${fileName} ${typeDescription}`);
  });

  return `UPLOADED DOCUMENTS:
The business has provided the following documents for additional context:
${filesInfo.join('\n')}

Note: While you can reference that these documents exist, you cannot access their actual content. Use this information to understand what materials the business has available.`;
}

/**
 * Formats website links context
 */
function formatLinksContext(data: BusinessContextData): string {
  if (!data.links || data.links.length === 0) {
    return "";
  }

  const linksList = data.links.map(link => {
    // Clean up the link display
    const cleanLink = link.replace(/^https?:\/\//, '').replace(/^www\./, '');
    return `- ${link} (${cleanLink})`;
  }).join('\n');

  return `RELEVANT WEBSITES:
The business has provided these website links for reference:
${linksList}

You can mention these websites when relevant to help callers find more information online.`;
}

/**
 * Formats scraped website content
 */
function formatScrapedWebsiteContent(data: BusinessContextData): string {
  if (!data.scrapedContent || data.scrapedContent.length === 0) {
    return "";
  }

  const scrapedSections: string[] = [];
  
  data.scrapedContent.forEach((content, index) => {
    const title = data.scrapedTitles?.[index] || 'Website Content';
    const url = data.scrapedUrls?.[index] || '';
    const scrapedAt = data.scrapedAt?.[index] || '';
    
    if (content && content.trim().length > 50) {
      let section = `${title}`;
      if (url) {
        section += ` (${url})`;
      }
      section += `:\n${content.trim()}`;
      
      scrapedSections.push(section);
    }
  });

  if (scrapedSections.length === 0) {
    return "";
  }

  return `WEBSITE CONTENT KNOWLEDGE:
The following content has been extracted from the business websites and provides detailed information about services, offerings, and company details:

${scrapedSections.join('\n\n---\n\n')}

Use this detailed website content to provide accurate information about the business, its services, and offerings when responding to callers.`;
}

/**
 * Formats business notes and instructions
 */
function formatNotesContext(data: BusinessContextData): string {
  if (!data.description || data.description.trim() === "") {
    return "";
  }

  return `BUSINESS NOTES & INSTRUCTIONS:
${data.description.trim()}

These are specific instructions and context provided by the business owner. Follow these guidelines closely when interacting with callers.`;
}

/**
 * Utility function to check if business context exists
 */
export function hasBusinessContext(businessData: BusinessContextData): boolean {
  if (!businessData) return false;
  
  return !!(
    businessData.description?.trim() ||
    (businessData.links && businessData.links.length > 0) ||
    (businessData.scrapedContent && businessData.scrapedContent.length > 0) ||
    (businessData.fileNames && businessData.fileNames.length > 0) ||
    businessData.businessName?.trim() ||
    businessData.businessEmail?.trim() ||
    businessData.businessPhone?.trim() ||
    businessData.businessAddress?.trim()
  );
}