/**
 * Web Scraper Service
 * 
 * Extracts meaningful content from business website URLs to enhance
 * AI agent knowledge with actual website information.
 */

import * as cheerio from 'cheerio';
import { parse } from 'node-html-parser';

export interface ScrapedContent {
  url: string;
  title?: string;
  description?: string;
  content: string;
  keywords?: string[];
  error?: string;
  scrapedAt: Date;
}

/**
 * Scrapes content from a website URL
 */
export async function scrapeWebsite(url: string): Promise<ScrapedContent> {
  const result: ScrapedContent = {
    url,
    content: '',
    scrapedAt: new Date()
  };

  try {
    // Ensure URL has protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    console.log('🔍 Scraping website:', url);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    // Try multiple strategies to bypass anti-bot measures
    const strategies = [
      // Strategy 1: Standard browser-like headers
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        }
      },
      // Strategy 2: Mobile browser headers
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
        }
      },
      // Strategy 3: Minimal headers
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      }
    ];

    let response: Response | null = null;
    let lastError: Error | null = null;

    // Try each strategy until one works
    for (let i = 0; i < strategies.length; i++) {
      try {
        console.log(`🔄 Trying scraping strategy ${i + 1}/${strategies.length} for:`, url);
        
        response = await fetch(url, {
          ...strategies[i],
          signal: controller.signal
        });

        if (response.ok) {
          console.log(`✅ Strategy ${i + 1} succeeded for:`, url);
          break;
        } else if (response.status === 403) {
          console.log(`❌ Strategy ${i + 1} blocked (403) for:`, url);
          lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
          
          // Add delay before trying next strategy to be respectful
          if (i < strategies.length - 1) {
            console.log('⏳ Waiting 2 seconds before trying next strategy...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          continue;
        } else {
          console.log(`❌ Strategy ${i + 1} failed (${response.status}) for:`, url);
          lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
          continue;
        }
      } catch (error: any) {
        console.log(`❌ Strategy ${i + 1} error for:`, url, error.message);
        lastError = error;
        continue;
      }
    }

    if (!response || !response.ok) {
      throw lastError || new Error('All scraping strategies failed');
    }

    clearTimeout(timeoutId);

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract title
    result.title = $('title').text().trim() || 
                   $('h1').first().text().trim() || 
                   'Unknown Title';

    // Extract meta description
    result.description = $('meta[name="description"]').attr('content') || 
                        $('meta[property="og:description"]').attr('content') || 
                        '';

    // Extract keywords
    const keywordsContent = $('meta[name="keywords"]').attr('content');
    if (keywordsContent) {
      result.keywords = keywordsContent.split(',').map(k => k.trim()).filter(k => k.length > 0);
    }

    // Extract main content
    const contentSections = extractMainContent($);
    result.content = contentSections.join('\n\n').trim();

    // If no content found, try alternative extraction
    if (result.content.length < 50) {
      result.content = extractFallbackContent($);
    }

    // Limit content length to prevent overly long prompts
    if (result.content.length > 2000) {
      result.content = result.content.substring(0, 2000) + '...';
    }

    console.log('✅ Successfully scraped:', url);
    console.log('📄 Title:', result.title);
    console.log('📝 Content length:', result.content.length);

    return result;

  } catch (error: any) {
    console.error('❌ Error scraping website:', url, error.message);
    result.error = error.message;
    result.content = url; // Just store the URL itself
    return result;
  }
}

/**
 * Extracts main content from common website structures
 */
function extractMainContent($: cheerio.CheerioAPI): string[] {
  const contentSections: string[] = [];

  // Remove unwanted elements
  $('script, style, nav, header, footer, aside, .sidebar, .navigation, .menu').remove();

  // Priority content selectors (most specific first)
  const contentSelectors = [
    // Common content areas
    'main',
    '[role="main"]',
    '.main-content',
    '.content',
    '#content',
    '.post-content',
    '.entry-content',
    '.article-content',
    
    // About/business info sections
    '.about',
    '#about',
    '.about-us',
    '.company-info',
    '.business-info',
    
    // Service sections
    '.services',
    '#services',
    '.our-services',
    '.what-we-do',
    
    // General content
    'article',
    '.container',
    '.wrapper'
  ];

  // Try each selector and collect meaningful content
  for (const selector of contentSelectors) {
    const elements = $(selector);
    elements.each((_, element) => {
      const text = $(element).text().trim();
      
      // Only include substantial content
      if (text.length > 50 && !contentSections.includes(text)) {
        contentSections.push(text);
      }
    });

    // If we found good content, stop searching
    if (contentSections.length > 0 && contentSections.join('').length > 200) {
      break;
    }
  }

  return contentSections;
}

/**
 * Fallback content extraction for sites with non-standard layouts
 */
function extractFallbackContent($: cheerio.CheerioAPI): string {
  // Remove unwanted elements
  $('script, style, nav, header, footer, aside').remove();

  // Get all paragraph text
  const paragraphs: string[] = [];
  $('p').each((_, element) => {
    const text = $(element).text().trim();
    if (text.length > 20) {
      paragraphs.push(text);
    }
  });

  // Get heading text
  const headings: string[] = [];
  $('h1, h2, h3').each((_, element) => {
    const text = $(element).text().trim();
    if (text.length > 5) {
      headings.push(text);
    }
  });

  // Combine headings and paragraphs
  const allContent = [...headings, ...paragraphs].join('\n\n');
  
  // If still no good content, get any text from body
  if (allContent.length < 100) {
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    return bodyText.substring(0, 1000);
  }

  return allContent;
}

/**
 * Batch scrape multiple URLs
 */
export async function scrapeMultipleWebsites(urls: string[]): Promise<ScrapedContent[]> {
  console.log('🔍 Batch scraping', urls.length, 'websites');
  
  const promises = urls.map(url => scrapeWebsite(url));
  const results = await Promise.allSettled(promises);
  
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        url: urls[index],
        content: `Failed to scrape: ${result.reason}`,
        error: result.reason.toString(),
        scrapedAt: new Date()
      };
    }
  });
}
