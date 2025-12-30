/**
 * Web Scraper Service
 * 
 * Extracts meaningful content from business website URLs to enhance
 * AI agent knowledge with actual website information.
 * 
 * Supports both static HTML and JavaScript-rendered sites (React, Vue, Angular).
 */

import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';

export interface ScrapedContent {
  url: string;
  title?: string;
  description?: string;
  content: string;
  keywords?: string[];
  error?: string;
  scrapedAt: Date;
}

// Header configurations for different scraping strategies
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};

const MOBILE_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

const MINIMAL_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

/**
 * Detects if HTML is from a JavaScript-rendered SPA (React, Vue, Angular, etc.)
 */
function isJavaScriptRenderedPage(html: string): boolean {
  const $ = cheerio.load(html);
  
  // Check for common SPA indicators
  const bodyContent = $('body').text().trim();
  const hasMinimalBody = bodyContent.length < 100;
  
  // Check for root divs that SPAs use
  const hasRootDiv = $('#root').length > 0 || 
                     $('#app').length > 0 || 
                     $('#__next').length > 0 ||
                     $('[data-reactroot]').length > 0;
  
  // Check for script bundles typical of SPAs
  const hasScriptBundle = $('script[src*="bundle"]').length > 0 ||
                          $('script[src*="chunk"]').length > 0 ||
                          $('script[src*="assets/index"]').length > 0 ||
                          $('script[type="module"]').length > 0;
  
  // If body has very little text but has SPA indicators, it's likely JS-rendered
  if (hasMinimalBody && (hasRootDiv || hasScriptBundle)) {
    console.log('🔍 Detected JavaScript-rendered page (SPA)');
    return true;
  }
  
  return false;
}

/**
 * Scrapes content using Puppeteer (headless browser) for JavaScript-rendered sites
 */
async function scrapeWithPuppeteer(url: string): Promise<{ html: string; title: string; description: string }> {
  console.log('🌐 Using Puppeteer for JavaScript-rendered page:', url);
  
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote',
      ],
    });
    
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navigate to the page with a timeout
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait a bit more for any lazy-loaded content
    await page.waitForSelector('body', { timeout: 5000 }).catch(() => {});
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get the rendered HTML
    const html = await page.content();
    
    // Get title and meta description
    const title = await page.title();
    const description = await page.$eval('meta[name="description"]', 
      (el) => el.getAttribute('content') || ''
    ).catch(() => '');
    
    console.log('✅ Puppeteer successfully rendered page');
    
    return { html, title, description };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Fast fetch-based scraping for static HTML sites
 */
async function scrapeWithFetch(url: string): Promise<{ html: string; isJsRendered: boolean }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const strategies = [
    { headers: BROWSER_HEADERS },
    { headers: MOBILE_HEADERS },
    { headers: MINIMAL_HEADERS }
  ];

  let response: Response | null = null;
  let lastError: Error | null = null;

  for (let i = 0; i < strategies.length; i++) {
    try {
      console.log(`🔄 Trying scraping strategy ${i + 1}/${strategies.length} for:`, url);
      
      response = await fetch(url, {
        headers: strategies[i].headers,
        signal: controller.signal
      });

      if (response.ok) {
        console.log(`✅ Strategy ${i + 1} succeeded for:`, url);
        break;
      } else if (response.status === 403) {
        console.log(`❌ Strategy ${i + 1} blocked (403) for:`, url);
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
        
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

  clearTimeout(timeoutId);

  if (!response || !response.ok) {
    throw lastError || new Error('All fetch strategies failed');
  }

  const html = await response.text();
  const isJsRendered = isJavaScriptRenderedPage(html);
  
  return { html, isJsRendered };
}

/**
 * Scrapes content from a website URL
 * Automatically detects and handles JavaScript-rendered sites
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

    let html: string;
    let fetchedTitle: string = '';
    let fetchedDescription: string = '';

    // First try fast fetch
    try {
      const fetchResult = await scrapeWithFetch(url);
      
      if (fetchResult.isJsRendered) {
        // JavaScript-rendered page detected, use Puppeteer
        console.log('🔄 Switching to Puppeteer for JavaScript content...');
        const puppeteerResult = await scrapeWithPuppeteer(url);
        html = puppeteerResult.html;
        fetchedTitle = puppeteerResult.title;
        fetchedDescription = puppeteerResult.description;
      } else {
        html = fetchResult.html;
      }
    } catch (fetchError: any) {
      // Fetch failed, try Puppeteer as fallback
      console.log('⚠️ Fetch failed, trying Puppeteer as fallback:', fetchError.message);
      const puppeteerResult = await scrapeWithPuppeteer(url);
      html = puppeteerResult.html;
      fetchedTitle = puppeteerResult.title;
      fetchedDescription = puppeteerResult.description;
    }

    const $ = cheerio.load(html);

    // Extract title
    result.title = fetchedTitle || 
                   $('title').text().trim() || 
                   $('h1').first().text().trim() || 
                   'Unknown Title';

    // Extract meta description
    result.description = fetchedDescription ||
                        $('meta[name="description"]').attr('content') || 
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
    if (result.content.length > 3000) {
      result.content = result.content.substring(0, 3000) + '...';
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
  $('script, style, nav, header, footer, aside, .sidebar, .navigation, .menu, noscript, iframe').remove();

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
    '.wrapper',
    
    // React/SPA specific
    '#root',
    '#app',
    '.App',
  ];

  // Try each selector and collect meaningful content
  for (const selector of contentSelectors) {
    const elements = $(selector);
    elements.each((_, element) => {
      const text = $(element).text().replace(/\s+/g, ' ').trim();
      
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
  $('script, style, nav, header, footer, aside, noscript, iframe').remove();

  // Get all paragraph text
  const paragraphs: string[] = [];
  $('p').each((_, element) => {
    const text = $(element).text().replace(/\s+/g, ' ').trim();
    if (text.length > 20) {
      paragraphs.push(text);
    }
  });

  // Get heading text
  const headings: string[] = [];
  $('h1, h2, h3, h4').each((_, element) => {
    const text = $(element).text().replace(/\s+/g, ' ').trim();
    if (text.length > 5) {
      headings.push(text);
    }
  });

  // Get list items (often contain service descriptions)
  const listItems: string[] = [];
  $('li').each((_, element) => {
    const text = $(element).text().replace(/\s+/g, ' ').trim();
    if (text.length > 10 && text.length < 200) {
      listItems.push('- ' + text);
    }
  });

  // Combine all content
  const allContent = [...headings, ...paragraphs, ...listItems.slice(0, 20)].join('\n\n');
  
  // If still no good content, get any text from body
  if (allContent.length < 100) {
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    return bodyText.substring(0, 2000);
  }

  return allContent;
}

/**
 * Batch scrape multiple URLs
 */
export async function scrapeMultipleWebsites(urls: string[]): Promise<ScrapedContent[]> {
  console.log('🔍 Batch scraping', urls.length, 'websites');
  
  // Process sequentially to avoid overwhelming Puppeteer
  const results: ScrapedContent[] = [];
  
  for (const url of urls) {
    const scraped = await scrapeWebsite(url);
    results.push(scraped);
    
    // Small delay between scrapes to be respectful
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}
