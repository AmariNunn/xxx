import { JSDOM } from 'jsdom';

export interface ComprehensiveWebData {
  url: string;
  title: string;
  description: string;
  keywords: string[];
  content: string;
  contactInfo: {
    emails: string[];
    phones: string[];
    addresses: string[];
    socialMedia: { platform: string; url: string; }[];
  };
  businessInfo: {
    hours: string[];
    services: string[];
    products: string[];
    aboutSections: string[];
    testimonials: string[];
    teamMembers: string[];
  };
  structuredData: any[];
  metaData: {
    ogTitle?: string;
    ogDescription?: string;
    twitterTitle?: string;
    twitterDescription?: string;
    author?: string;
    language?: string;
  };
  navigationStructure: string[];
  extractedText: string;
  lastScraped: Date;
}

export class EnhancedWebScraper {
  private readonly MAX_CONTENT_LENGTH = 100000; // 100KB limit
  private readonly TIMEOUT_MS = 30000; // 30 second timeout

  async scrapeWebsite(url: string): Promise<ComprehensiveWebData> {
    try {
      console.log(`Starting comprehensive scrape of: ${url}`);
      
      const response = await this.fetchWithTimeout(url);
      const html = await response.text();
      const dom = new JSDOM(html);
      const document = dom.window.document;

      const result: ComprehensiveWebData = {
        url,
        title: this.extractTitle(document),
        description: this.extractDescription(document),
        keywords: this.extractKeywords(document),
        content: this.extractMainContent(document),
        contactInfo: this.extractContactInfo(document, html),
        businessInfo: this.extractBusinessInfo(document, html),
        structuredData: this.extractStructuredData(document),
        metaData: this.extractMetaData(document),
        navigationStructure: this.extractNavigation(document),
        extractedText: this.extractCleanText(document),
        lastScraped: new Date()
      };

      console.log(`Successfully scraped ${url}: ${result.extractedText.length} chars, ${result.contactInfo.emails.length} emails, ${result.businessInfo.services.length} services`);
      return result;

    } catch (error) {
      console.error(`Error scraping ${url}:`, error);
      return this.createErrorResult(url, error);
    }
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Sky IQ Business Intelligence Bot) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private extractTitle(document: Document): string {
    // Try multiple title sources in order of preference
    const sources = [
      () => document.querySelector('meta[property="og:title"]')?.getAttribute('content'),
      () => document.querySelector('meta[name="twitter:title"]')?.getAttribute('content'),
      () => document.querySelector('title')?.textContent,
      () => document.querySelector('h1')?.textContent,
      () => document.querySelector('.title, .page-title, .entry-title')?.textContent
    ];

    for (const source of sources) {
      const title = source()?.trim();
      if (title && title.length > 0) {
        return title.slice(0, 200);
      }
    }

    return 'Untitled Page';
  }

  private extractDescription(document: Document): string {
    const sources = [
      () => document.querySelector('meta[name="description"]')?.getAttribute('content'),
      () => document.querySelector('meta[property="og:description"]')?.getAttribute('content'),
      () => document.querySelector('meta[name="twitter:description"]')?.getAttribute('content'),
      () => document.querySelector('.description, .summary, .excerpt')?.textContent,
      () => document.querySelector('p')?.textContent
    ];

    for (const source of sources) {
      const desc = source()?.trim();
      if (desc && desc.length > 0) {
        return desc.slice(0, 500);
      }
    }

    return '';
  }

  private extractKeywords(document: Document): string[] {
    const keywords = new Set<string>();
    
    // Meta keywords
    const metaKeywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content');
    if (metaKeywords) {
      metaKeywords.split(',').forEach(kw => keywords.add(kw.trim().toLowerCase()));
    }

    // Extract from headings
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach(heading => {
      const text = heading.textContent?.trim();
      if (text) {
        this.extractWordsFromText(text).forEach(word => keywords.add(word));
      }
    });

    // Extract from strong/em tags
    const emphasized = document.querySelectorAll('strong, em, b, i');
    emphasized.forEach(el => {
      const text = el.textContent?.trim();
      if (text) {
        this.extractWordsFromText(text).forEach(word => keywords.add(word));
      }
    });

    return Array.from(keywords).slice(0, 50);
  }

  private extractContactInfo(document: Document, html: string): ComprehensiveWebData['contactInfo'] {
    const emails = new Set<string>();
    const phones = new Set<string>();
    const addresses = new Set<string>();
    const socialMedia: { platform: string; url: string; }[] = [];

    // Email extraction
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emailMatches = html.match(emailRegex);
    if (emailMatches) {
      emailMatches.forEach(email => {
        if (!email.includes('example.com') && !email.includes('placeholder')) {
          emails.add(email.toLowerCase());
        }
      });
    }

    // Phone extraction
    const phoneRegex = /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g;
    const phoneMatches = html.match(phoneRegex);
    if (phoneMatches) {
      phoneMatches.forEach(phone => phones.add(phone.trim()));
    }

    // Address extraction (look for common patterns)
    const addressPatterns = [
      /\d+\s+[A-Za-z0-9\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Plaza|Circle|Cir)\s*,?\s*[A-Za-z\s]+,?\s*[A-Z]{2}\s*\d{5}/g,
      /\b\d+\s+[A-Za-z0-9\s]+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln)\b/g
    ];

    addressPatterns.forEach(pattern => {
      const matches = html.match(pattern);
      if (matches) {
        matches.forEach(addr => addresses.add(addr.trim()));
      }
    });

    // Social media extraction
    const socialPatterns = {
      facebook: /(?:https?:\/\/)?(?:www\.)?facebook\.com\/[a-zA-Z0-9.]+/g,
      twitter: /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+/g,
      linkedin: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|company)\/[a-zA-Z0-9-]+/g,
      instagram: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+/g,
      youtube: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:c\/|channel\/|user\/)?[a-zA-Z0-9_-]+/g
    };

    Object.entries(socialPatterns).forEach(([platform, pattern]) => {
      const matches = html.match(pattern);
      if (matches) {
        matches.forEach(url => {
          socialMedia.push({ platform, url: url.trim() });
        });
      }
    });

    return {
      emails: Array.from(emails).slice(0, 10),
      phones: Array.from(phones).slice(0, 10),
      addresses: Array.from(addresses).slice(0, 5),
      socialMedia: socialMedia.slice(0, 20)
    };
  }

  private extractBusinessInfo(document: Document, html: string): ComprehensiveWebData['businessInfo'] {
    const hours: string[] = [];
    const services = new Set<string>();
    const products = new Set<string>();
    const aboutSections: string[] = [];
    const testimonials: string[] = [];
    const teamMembers: string[] = [];

    // Business hours extraction
    const hourPatterns = [
      /(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*:?\s*\d{1,2}:\d{2}\s*(?:am|pm)?\s*-\s*\d{1,2}:\d{2}\s*(?:am|pm)?/gi,
      /\d{1,2}:\d{2}\s*(?:am|pm)?\s*-\s*\d{1,2}:\d{2}\s*(?:am|pm)?/g
    ];

    hourPatterns.forEach(pattern => {
      const matches = html.match(pattern);
      if (matches) {
        matches.forEach(hour => hours.push(hour.trim()));
      }
    });

    // Services extraction (look for common service keywords)
    const serviceKeywords = [
      'service', 'services', 'consulting', 'support', 'maintenance', 'repair', 'installation',
      'design', 'development', 'marketing', 'strategy', 'training', 'coaching', 'therapy',
      'treatment', 'care', 'management', 'planning', 'analysis', 'assessment'
    ];

    const serviceElements = document.querySelectorAll('.service, .services, [class*="service"], [id*="service"]');
    serviceElements.forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.length > 0 && text.length < 200) {
        services.add(text);
      }
    });

    // Extract from lists that might contain services
    const lists = document.querySelectorAll('ul li, ol li');
    lists.forEach(item => {
      const text = item.textContent?.trim();
      if (text && serviceKeywords.some(keyword => text.toLowerCase().includes(keyword))) {
        if (text.length > 5 && text.length < 100) {
          services.add(text);
        }
      }
    });

    // Products extraction
    const productElements = document.querySelectorAll('.product, .products, [class*="product"], [id*="product"]');
    productElements.forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.length > 0 && text.length < 200) {
        products.add(text);
      }
    });

    // About sections
    const aboutSelectors = [
      'section[class*="about"]', '.about', '#about', '.about-us', '#about-us',
      '.company', '.story', '.mission', '.vision', '.values'
    ];

    aboutSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length > 50) {
          aboutSections.push(text.slice(0, 1000));
        }
      });
    });

    // Testimonials
    const testimonialSelectors = [
      '.testimonial', '.testimonials', '.review', '.reviews', '[class*="testimonial"]', '[class*="review"]'
    ];

    testimonialSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length > 20 && text.length < 500) {
          testimonials.push(text);
        }
      });
    });

    // Team members
    const teamSelectors = [
      '.team', '.staff', '.employee', '[class*="team"]', '[class*="staff"]', '[class*="member"]'
    ];

    teamSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const name = el.querySelector('h1, h2, h3, h4, h5, h6, .name')?.textContent?.trim();
        if (name && name.length > 0 && name.length < 50) {
          teamMembers.push(name);
        }
      });
    });

    return {
      hours: hours.slice(0, 7),
      services: Array.from(services).slice(0, 20),
      products: Array.from(products).slice(0, 20),
      aboutSections: aboutSections.slice(0, 5),
      testimonials: testimonials.slice(0, 10),
      teamMembers: teamMembers.slice(0, 15)
    };
  }

  private extractStructuredData(document: Document): any[] {
    const structuredData: any[] = [];

    // JSON-LD extraction
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    jsonLdScripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent || '');
        structuredData.push(data);
      } catch (error) {
        console.warn('Invalid JSON-LD found', error);
      }
    });

    // Microdata extraction (basic)
    const microdataElements = document.querySelectorAll('[itemscope]');
    microdataElements.forEach(el => {
      const itemType = el.getAttribute('itemtype');
      const itemProps: any = {};
      
      const propElements = el.querySelectorAll('[itemprop]');
      propElements.forEach(propEl => {
        const propName = propEl.getAttribute('itemprop');
        const propValue = propEl.textContent?.trim();
        if (propName && propValue) {
          itemProps[propName] = propValue;
        }
      });

      if (itemType && Object.keys(itemProps).length > 0) {
        structuredData.push({ '@type': itemType, ...itemProps });
      }
    });

    return structuredData;
  }

  private extractMetaData(document: Document): ComprehensiveWebData['metaData'] {
    return {
      ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content') || undefined,
      ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute('content') || undefined,
      twitterTitle: document.querySelector('meta[name="twitter:title"]')?.getAttribute('content') || undefined,
      twitterDescription: document.querySelector('meta[name="twitter:description"]')?.getAttribute('content') || undefined,
      author: document.querySelector('meta[name="author"]')?.getAttribute('content') || undefined,
      language: document.documentElement.lang || document.querySelector('meta[http-equiv="content-language"]')?.getAttribute('content') || undefined
    };
  }

  private extractNavigation(document: Document): string[] {
    const navItems: string[] = [];
    
    const navSelectors = ['nav a', '.navigation a', '.menu a', '.navbar a', 'header a'];
    
    navSelectors.forEach(selector => {
      const links = document.querySelectorAll(selector);
      links.forEach(link => {
        const text = link.textContent?.trim();
        if (text && text.length > 0 && text.length < 50) {
          navItems.push(text);
        }
      });
    });

    return Array.from(new Set(navItems)).slice(0, 20);
  }

  private extractMainContent(document: Document): string {
    // Remove unwanted elements
    const unwanted = document.querySelectorAll(
      'script, style, nav, header, footer, aside, .sidebar, .advertisement, .ads, ' +
      '.cookie, .popup, .modal, .share, .social, .comment, .comments'
    );
    unwanted.forEach(el => el.remove());

    // Try to find main content area
    const contentSelectors = [
      'main', '[role="main"]', '.content', '.main-content', '.page-content',
      '.entry-content', '.post-content', '.article-content', 'article'
    ];

    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        return this.cleanText(element.textContent || '');
      }
    }

    // Fallback to body content
    return this.cleanText(document.body.textContent || '');
  }

  private extractCleanText(document: Document): string {
    // Remove scripts, styles, and other non-content elements
    const unwanted = document.querySelectorAll(
      'script, style, nav, header, footer, aside, .sidebar, .advertisement, .ads, ' +
      '.cookie, .popup, .modal, .share, .social, .menu, .navigation'
    );
    unwanted.forEach(el => el.remove());

    const text = document.body.textContent || '';
    return this.cleanText(text).slice(0, this.MAX_CONTENT_LENGTH);
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .replace(/^\s+|\s+$/g, '')
      .trim();
  }

  private extractWordsFromText(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && word.length < 20)
      .slice(0, 10);
  }

  private createErrorResult(url: string, error: any): ComprehensiveWebData {
    return {
      url,
      title: 'Error Loading Page',
      description: `Failed to scrape: ${error.message}`,
      keywords: [],
      content: '',
      contactInfo: { emails: [], phones: [], addresses: [], socialMedia: [] },
      businessInfo: { hours: [], services: [], products: [], aboutSections: [], testimonials: [], teamMembers: [] },
      structuredData: [],
      metaData: {},
      navigationStructure: [],
      extractedText: '',
      lastScraped: new Date()
    };
  }
}

export const enhancedWebScraper = new EnhancedWebScraper();