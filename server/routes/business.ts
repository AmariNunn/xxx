import express, { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { scrapeWebsite, type ScrapedContent } from "../webScraper";
import { extractDocumentContent, isSupportedDocumentType, type ExtractedDocument } from "../documentScraper";

const router = express.Router();

// Supabase client for prompt updates
const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Triggers a prompt update for a user after business context changes
 * This ensures the AI agent always has the latest business information
 */
async function triggerPromptUpdate(userId: string): Promise<void> {
    try {
        console.log('🔄 Triggering prompt update for user:', userId);
        
        // Get the current prompt for this user
        const { data: promptData, error: promptError } = await supabase
            .from('prompts')
            .select('system_prompt, first_message')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (promptError || !promptData?.system_prompt) {
            console.log('📝 No existing prompt found for user, skipping update');
            return;
        }

        // Make internal API call to update the prompt (this will include business context)
        const baseUrl = process.env.NODE_ENV === 'production' 
            ? process.env.BASE_URL || 'https://xxx-qnhk.onrender.com'
            : 'http://localhost:5000';
        
        const response = await fetch(`${baseUrl}/api/prompt/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                system_prompt: promptData.system_prompt,
                first_message: promptData.first_message
            })
        });

        if (response.ok) {
            console.log('✅ Prompt updated successfully with latest business context');
        } else {
            console.error('❌ Failed to update prompt:', await response.text());
        }
    } catch (error) {
        console.error('❌ Error triggering prompt update:', error);
    }
}

/**
 * Scrapes website content and stores it in the database
 */
async function scrapeAndStoreWebsiteContent(userId: string, url: string): Promise<void> {
    try {
        console.log('🕷️ Starting website scrape for:', url);
        
        // Scrape the website
        const scrapedData = await scrapeWebsite(url);
        
        if (scrapedData.error) {
            console.error('❌ Scraping failed for:', url, scrapedData.error);
            console.log('📝 Only storing the URL itself for:', url);
            
            // Just store the URL itself when scraping fails
            const { data: existing, error: fetchError } = await supabase
                .from('business_info')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (!fetchError && existing) {
                // Update with just the URL
                const { error: updateError } = await supabase
                    .from('business_info')
                    .update({
                        scraped_content: [...(existing.scraped_content || []), url],
                        scraped_titles: [...(existing.scraped_titles || []), url],
                        scraped_urls: [...(existing.scraped_urls || []), url],
                        scraped_at: [...(existing.scraped_at || []), scrapedData.scrapedAt.toISOString()],
                    })
                    .eq('user_id', userId);

                if (!updateError) {
                    console.log('✅ URL stored for:', url);
                    
                    // Trigger prompt update with just the URL
                    setTimeout(() => {
                        triggerPromptUpdate(userId).catch(error => 
                            console.error("Failed to update prompt after URL storage:", error)
                        );
                    }, 2000);
                }
            }
            return;
        }

        // Get current business info
        const { data: existing, error: fetchError } = await supabase
            .from('business_info')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (fetchError || !existing) {
            console.log('📝 No existing business info found, skipping scraped content storage');
            return;
        }
        
        // Update with scraped content
        const { error: updateError } = await supabase
            .from('business_info')
            .update({
                scraped_content: [...(existing.scraped_content || []), scrapedData.content],
                scraped_titles: [...(existing.scraped_titles || []), scrapedData.title || ''],
                scraped_urls: [...(existing.scraped_urls || []), scrapedData.url],
                scraped_at: [...(existing.scraped_at || []), scrapedData.scrapedAt.toISOString()],
            })
            .eq('user_id', userId);

        if (updateError) {
            console.error('❌ Error updating scraped content:', updateError);
        }

        console.log('✅ Scraped content stored for:', url);
        console.log('📄 Title:', scrapedData.title);
        console.log('📝 Content length:', scrapedData.content.length);

        // Trigger prompt update to include new scraped content
        setTimeout(() => {
            triggerPromptUpdate(userId).catch(error => 
                console.error("Failed to update prompt after scraping:", error)
            );
        }, 2000); // Small delay to ensure content is saved

    } catch (error) {
        console.error('❌ Error in scrapeAndStoreWebsiteContent:', error);
    }
}

/**
 * Extracts document content and stores it in the database
 */
async function extractAndStoreDocumentContent(userId: string, fileUrl: string, fileName: string): Promise<void> {
    try {
        console.log('📄 Starting document extraction for:', fileName);
        
        // Extract content from the document
        const extractedData = await extractDocumentContent(fileUrl, fileName);
        
        if (extractedData.error) {
            console.error('❌ Document extraction failed for:', fileName, extractedData.error);
            // Do not store anything if extraction failed - this ensures only real content gets into AI prompts
            return;
        }

        // Ensure we have actual content before storing
        if (!extractedData.content || extractedData.content.trim().length === 0) {
            console.error('❌ No content extracted from document:', fileName);
            return;
        }

        // Get current business info
        const { data: existing, error: fetchError } = await supabase
            .from('business_info')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (fetchError || !existing) {
            console.log('📝 No existing business info found, skipping document content storage');
            return;
        }
        
        // Update with extracted document content
        const { error: updateError } = await supabase
            .from('business_info')
            .update({
                document_content: [...(existing.document_content || []), extractedData.content],
                document_titles: [...(existing.document_titles || []), extractedData.title || extractedData.fileName],
                document_extracted_at: [...(existing.document_extracted_at || []), extractedData.extractedAt.toISOString()],
            })
            .eq('user_id', userId);

        if (updateError) {
            console.error('❌ Error updating document content:', updateError);
        }

        console.log('✅ Document content stored for:', fileName);
        console.log('📄 Title:', extractedData.title);
        console.log('📝 Content length:', extractedData.content.length);

        // Trigger prompt update to include new document content
        setTimeout(() => {
            triggerPromptUpdate(userId).catch(error => 
                console.error("Failed to update prompt after document extraction:", error)
            );
        }, 2000); // Small delay to ensure content is saved

    } catch (error) {
        console.error('❌ Error in extractAndStoreDocumentContent:', error);
    }
}

// Get business info for a user
router.get("/api/business/:userId", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const { data: result, error } = await supabase
      .from('business_info')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !result) {
      // Create default business info for new users
      const defaultBusinessInfo = {
        user_id: userId,
        business_name: "Your Business Name",
        business_email: "contact@yourbusiness.com",
        business_phone: "(123) 456-7890",
        business_address: "123 Business St, Business City, 12345",
        description: "Describe your business and how the AI assistant should represent you.",
        links: [],
        file_urls: [],
        file_names: [],
        file_types: [],
        file_sizes: [],
        logo_url: null,
      };

      // Insert default info into database
      const { data: newInfo, error: insertError } = await supabase
        .from('business_info')
        .insert(defaultBusinessInfo)
        .select()
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      // Map database fields to frontend expected format
      const mappedData = {
        businessName: newInfo.business_name,
        businessEmail: newInfo.business_email,
        businessPhone: newInfo.business_phone,
        businessAddress: newInfo.business_address,
        description: newInfo.description,
        links: newInfo.links || [],
        fileUrls: newInfo.file_urls || [],
        fileNames: newInfo.file_names || [],
        fileTypes: newInfo.file_types || [],
        fileSizes: newInfo.file_sizes || [],
        logoUrl: newInfo.logo_url,
        scrapedContent: newInfo.scraped_content || [],
        scrapedTitles: newInfo.scraped_titles || [],
        scrapedUrls: newInfo.scraped_urls || [],
        scrapedAt: newInfo.scraped_at || [],
        leadUrls: newInfo.lead_urls || [],
        leadNames: newInfo.lead_names || [],
        leadTypes: newInfo.lead_types || [],
        leadSizes: newInfo.lead_sizes || [],
      };

      return res.status(200).json({ data: mappedData });
    }

    // Map database fields to frontend expected format
    const mappedData = {
      businessName: result.business_name,
      businessEmail: result.business_email,
      businessPhone: result.business_phone,
      businessAddress: result.business_address,
      description: result.description,
      links: result.links || [],
      fileUrls: result.file_urls || [],
      fileNames: result.file_names || [],
      fileTypes: result.file_types || [],
      fileSizes: result.file_sizes || [],
      logoUrl: result.logo_url,
      scrapedContent: result.scraped_content || [],
      scrapedTitles: result.scraped_titles || [],
      scrapedUrls: result.scraped_urls || [],
      scrapedAt: result.scraped_at || [],
      leadUrls: result.lead_urls || [],
      leadNames: result.lead_names || [],
      leadTypes: result.lead_types || [],
      leadSizes: result.lead_sizes || [],
    };

    res.status(200).json({ data: mappedData });
  } catch (error: any) {
    console.error("Error fetching business info:", error);
    res.status(500).json({ message: "Failed to fetch business info" });
  }
});

// Add or update business info
router.post("/api/business/:userId", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Get current business info
    const { data: existing, error: fetchError } = await supabase
      .from('business_info')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Prepare the data
    const data = {
      user_id: userId,
      business_name: req.body.businessName || null,
      business_email: req.body.businessEmail || null,
      business_phone: req.body.businessPhone || null,
      business_address: req.body.businessAddress || null,
      description: req.body.description || null,
      links: req.body.links || [],
      file_urls: req.body.fileUrls || [],
      file_names: req.body.fileNames || [],
      file_types: req.body.fileTypes || [],
      file_sizes: req.body.fileSizes || [],
      logo_url: req.body.logoUrl || null,
    };

    let result;
    if (fetchError || !existing) {
      // Insert new record
      const { data: newResult, error: insertError } = await supabase
        .from('business_info')
        .insert(data)
        .select()
        .single();
      
      if (insertError) throw new Error(insertError.message);
      result = newResult;
    } else {
      // Update existing record
      const { data: updateResult, error: updateError } = await supabase
        .from('business_info')
        .update(data)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (updateError) throw new Error(updateError.message);
      result = updateResult;
    }

    res.status(200).json({ message: "Business info saved successfully", data: result });
    
    // Trigger prompt update in background to include new business context
    triggerPromptUpdate(userId).catch(error => 
      console.error("Failed to update prompt after business info save:", error)
    );
  } catch (error: any) {
    console.error("Error saving business info:", error);
    res.status(500).json({ message: "Failed to save business info" });
  }
});

// Add a link to business info
router.post("/api/business/:userId/links", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const { link } = req.body;
    if (!link) {
      return res.status(400).json({ message: "Link is required" });
    }

    // Get current business info
    const { data: existing, error: fetchError } = await supabase
      .from('business_info')
      .select('*')
      .eq('user_id', userId)
      .single();

    let result;
    if (fetchError || !existing) {
      // Insert new record with the link
      const { data: newResult, error: insertError } = await supabase
        .from('business_info')
        .insert({
          user_id: userId,
          description: null,
          links: [link],
          file_urls: [],
          file_names: [],
          file_types: [],
        })
        .select()
        .single();
      
      if (insertError) throw new Error(insertError.message);
      result = newResult;
    } else {
      // Update links array
      const currentLinks = existing.links || [];
      const { data: updateResult, error: updateError } = await supabase
        .from('business_info')
        .update({
          links: [...currentLinks, link],
        })
        .eq('user_id', userId)
        .select()
        .single();
      
      if (updateError) throw new Error(updateError.message);
      result = updateResult;
    }

    res.status(200).json({ message: "Link added successfully", data: result });
    
    // Scrape website content in background
    scrapeAndStoreWebsiteContent(userId, link).catch(error => 
      console.error("Failed to scrape website content:", error)
    );
    
    // Trigger prompt update in background to include new business context
    triggerPromptUpdate(userId).catch(error => 
      console.error("Failed to update prompt after link addition:", error)
    );
  } catch (error: any) {
    console.error("Error adding link:", error);
    res.status(500).json({ message: "Failed to add link" });
  }
});

// Remove link - FIXED VERSION
router.delete("/api/business/:userId/links/:index", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const index = parseInt(req.params.index);
    
    console.log(`🗑️ Attempting to delete link at index ${index} for user ${userId}`);
    
    if (!userId || typeof userId !== 'string' || isNaN(index)) {
      console.log(`❌ Invalid parameters: userId=${userId}, index=${index}`);
      return res.status(400).json({ message: "Invalid parameters" });
    }

    // Get current business info
    const { data: existing, error: fetchError } = await supabase
      .from('business_info')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError || !existing) {
      console.log(`❌ Business info not found for user ${userId}`);
      return res.status(404).json({ message: "Business info not found" });
    }

    const currentLinks = existing.links || [];
    console.log(`📋 Current links:`, currentLinks);
    console.log(`📊 Links count: ${currentLinks.length}, trying to delete index: ${index}`);
    
    if (index < 0 || index >= currentLinks.length) {
      console.log(`❌ Invalid link index: ${index} (valid range: 0-${currentLinks.length - 1})`);
      return res.status(400).json({ message: "Invalid link index" });
    }

    // Remove the link at the specified index
    const updatedLinks = [...currentLinks];
    updatedLinks.splice(index, 1);

    // 🔥 CRITICAL FIX: Also remove corresponding scraped content from AI prompt
    const currentScrapedContent = existing.scraped_content || [];
    const currentScrapedTitles = existing.scraped_titles || [];
    const currentScrapedUrls = existing.scraped_urls || [];
    const currentScrapedAt = existing.scraped_at || [];
    
    const updatedScrapedContent = [...currentScrapedContent];
    const updatedScrapedTitles = [...currentScrapedTitles];
    const updatedScrapedUrls = [...currentScrapedUrls];
    const updatedScrapedAt = [...currentScrapedAt];
    
    // Remove scraped content at the same index if it exists
    if (index < updatedScrapedContent.length) {
      console.log(`🧹 Removing scraped content at index ${index}`);
      updatedScrapedContent.splice(index, 1);
    }
    if (index < updatedScrapedTitles.length) {
      updatedScrapedTitles.splice(index, 1);
    }
    if (index < updatedScrapedUrls.length) {
      updatedScrapedUrls.splice(index, 1);
    }
    if (index < updatedScrapedAt.length) {
      updatedScrapedAt.splice(index, 1);
    }

    const { data: result, error: updateError } = await supabase
      .from('business_info')
      .update({
        links: updatedLinks,
        scraped_content: updatedScrapedContent,
        scraped_titles: updatedScrapedTitles,
        scraped_urls: updatedScrapedUrls,
        scraped_at: updatedScrapedAt,
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) throw new Error(updateError.message);

    console.log(`✅ Link and scraped content removed successfully`);
    res.status(200).json({ message: "Link removed successfully", data: result });
    
    // Trigger prompt update in background to remove business context
    triggerPromptUpdate(userId).catch(error => 
      console.error("Failed to update prompt after link removal:", error)
    );
  } catch (error: any) {
    console.error("Error removing link:", error);
    res.status(500).json({ message: "Failed to remove link" });
  }
});

// Add file details
router.post("/api/business/:userId/files", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const { fileUrl, fileName, fileType, fileSize } = req.body;
    if (!fileUrl || !fileName || !fileType) {
      return res.status(400).json({ message: "File details are required" });
    }

    // Get current business info
    const { data: existing, error: fetchError } = await supabase
      .from('business_info')
      .select('*')
      .eq('user_id', userId)
      .single();

    let result;
    if (fetchError || !existing) {
      // Insert new record with the file
      const { data: newResult, error: insertError } = await supabase
        .from('business_info')
        .insert({
          user_id: userId,
          description: null,
          links: [],
          file_urls: [fileUrl],
          file_names: [fileName],
          file_types: [fileType],
          file_sizes: fileSize ? [fileSize] : [],
        })
        .select()
        .single();
      
      if (insertError) throw new Error(insertError.message);
      result = newResult;
    } else {
      // Update file arrays
      const currentFileUrls = existing.file_urls || [];
      const currentFileNames = existing.file_names || [];
      const currentFileTypes = existing.file_types || [];
      const currentFileSizes = existing.file_sizes || [];

      const { data: updateResult, error: updateError } = await supabase
        .from('business_info')
        .update({
          file_urls: [...currentFileUrls, fileUrl],
          file_names: [...currentFileNames, fileName],
          file_types: [...currentFileTypes, fileType],
          file_sizes: fileSize ? [...currentFileSizes, fileSize] : currentFileSizes,
        })
        .eq('user_id', userId)
        .select()
        .single();
      
      if (updateError) throw new Error(updateError.message);
      result = updateResult;
    }

    res.status(200).json({ message: "File added successfully", data: result });
    
    // Extract document content in background if it's a supported document type
    if (isSupportedDocumentType(fileName)) {
      extractAndStoreDocumentContent(userId, fileUrl, fileName).catch(error => 
        console.error("Failed to extract document content:", error)
      );
    }
    
    // Trigger prompt update in background to include new business context
    triggerPromptUpdate(userId).catch(error => 
      console.error("Failed to update prompt after file addition:", error)
    );
  } catch (error: any) {
    console.error("Error adding file:", error);
    res.status(500).json({ message: "Failed to add file" });
  }
});

// Remove file
router.delete("/api/business/:userId/files/:index", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const index = parseInt(req.params.index);
    
    if (!userId || typeof userId !== 'string' || isNaN(index)) {
      return res.status(400).json({ message: "Invalid parameters" });
    }

    // Get current business info
    const { data: existing, error: fetchError } = await supabase
      .from('business_info')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ message: "Business info not found" });
    }

    const currentFileUrls = existing.file_urls || [];
    const currentFileNames = existing.file_names || [];
    const currentFileTypes = existing.file_types || [];
    const currentFileSizes = existing.file_sizes || [];

    if (
      index < 0 || 
      index >= currentFileUrls.length || 
      index >= currentFileNames.length || 
      index >= currentFileTypes.length
    ) {
      return res.status(400).json({ message: "Invalid file index" });
    }

    // Remove the file at the specified index
    const updatedFileUrls = [...currentFileUrls];
    const updatedFileNames = [...currentFileNames];
    const updatedFileTypes = [...currentFileTypes];
    const updatedFileSizes = [...currentFileSizes];

    updatedFileUrls.splice(index, 1);
    updatedFileNames.splice(index, 1);
    updatedFileTypes.splice(index, 1);
    if (index < updatedFileSizes.length) {
      updatedFileSizes.splice(index, 1);
    }

    // CRITICAL FIX: Also remove corresponding document content from AI prompt
    const currentDocumentContent = existing.document_content || [];
    const currentDocumentTitles = existing.document_titles || [];
    const currentDocumentExtractedAt = existing.document_extracted_at || [];
    
    const updatedDocumentContent = [...currentDocumentContent];
    const updatedDocumentTitles = [...currentDocumentTitles];
    const updatedDocumentExtractedAt = [...currentDocumentExtractedAt];
    
    // Remove document content at the same index if it exists
    if (index < updatedDocumentContent.length) {
      updatedDocumentContent.splice(index, 1);
    }
    if (index < updatedDocumentTitles.length) {
      updatedDocumentTitles.splice(index, 1);
    }
    if (index < updatedDocumentExtractedAt.length) {
      updatedDocumentExtractedAt.splice(index, 1);
    }

    const { data: result, error: updateError } = await supabase
      .from('business_info')
      .update({
        file_urls: updatedFileUrls,
        file_names: updatedFileNames,
        file_types: updatedFileTypes,
        file_sizes: updatedFileSizes,
        document_content: updatedDocumentContent,
        document_titles: updatedDocumentTitles,
        document_extracted_at: updatedDocumentExtractedAt,
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) throw new Error(updateError.message);

    res.status(200).json({ message: "File removed successfully", data: result });
    
    // Trigger prompt update in background to remove business context
    triggerPromptUpdate(userId).catch(error => 
      console.error("Failed to update prompt after file removal:", error)
    );
  } catch (error: any) {
    console.error("Error removing file:", error);
    res.status(500).json({ message: "Failed to remove file" });
  }
});

// Add lead file
router.post("/api/business/:userId/leads", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const { fileUrl, fileName, fileType, fileSize } = req.body;
    if (!fileUrl || !fileName || !fileType) {
      return res.status(400).json({ message: "Lead file details are required" });
    }

    // Get current business info
    const { data: existing, error: fetchError } = await supabase
      .from('business_info')
      .select('*')
      .eq('user_id', userId)
      .single();

    let result;
    if (fetchError || !existing) {
      // Insert new record with the lead file
      const { data: newResult, error: insertError } = await supabase
        .from('business_info')
        .insert({
          user_id: userId,
          description: null,
          links: [],
          file_urls: [],
          file_names: [],
          file_types: [],
          file_sizes: [],
          lead_urls: [fileUrl],
          lead_names: [fileName],
          lead_types: [fileType],
          lead_sizes: fileSize ? [fileSize] : [],
        })
        .select()
        .single();
      
      if (insertError) throw new Error(insertError.message);
      result = newResult;
    } else {
      // Update lead file arrays
      const currentLeadUrls = existing.lead_urls || [];
      const currentLeadNames = existing.lead_names || [];
      const currentLeadTypes = existing.lead_types || [];
      const currentLeadSizes = existing.lead_sizes || [];

      const { data: updateResult, error: updateError } = await supabase
        .from('business_info')
        .update({
          lead_urls: [...currentLeadUrls, fileUrl],
          lead_names: [...currentLeadNames, fileName],
          lead_types: [...currentLeadTypes, fileType],
          lead_sizes: fileSize ? [...currentLeadSizes, fileSize] : currentLeadSizes,
        })
        .eq('user_id', userId)
        .select()
        .single();
      
      if (updateError) throw new Error(updateError.message);
      result = updateResult;
    }

    res.status(200).json({ message: "Lead file added successfully", data: result });
  } catch (error: any) {
    console.error("Error adding lead file:", error);
    res.status(500).json({ message: "Failed to add lead file" });
  }
});

// Remove lead file
router.delete("/api/business/:userId/leads/:index", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const index = parseInt(req.params.index);
    
    if (!userId || typeof userId !== 'string' || isNaN(index)) {
      return res.status(400).json({ message: "Invalid parameters" });
    }

    // Get current business info
    const { data: existing, error: fetchError } = await supabase
      .from('business_info')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ message: "Business info not found" });
    }

    const currentLeadUrls = existing.lead_urls || [];
    const currentLeadNames = existing.lead_names || [];
    const currentLeadTypes = existing.lead_types || [];
    const currentLeadSizes = existing.lead_sizes || [];

    if (
      index < 0 || 
      index >= currentLeadUrls.length || 
      index >= currentLeadNames.length || 
      index >= currentLeadTypes.length
    ) {
      return res.status(400).json({ message: "Invalid lead file index" });
    }

    // Remove the lead file at the specified index
    const updatedLeadUrls = [...currentLeadUrls];
    const updatedLeadNames = [...currentLeadNames];
    const updatedLeadTypes = [...currentLeadTypes];
    const updatedLeadSizes = [...currentLeadSizes];

    updatedLeadUrls.splice(index, 1);
    updatedLeadNames.splice(index, 1);
    updatedLeadTypes.splice(index, 1);
    if (index < updatedLeadSizes.length) {
      updatedLeadSizes.splice(index, 1);
    }

    const { data: result, error: updateError } = await supabase
      .from('business_info')
      .update({
        lead_urls: updatedLeadUrls,
        lead_names: updatedLeadNames,
        lead_types: updatedLeadTypes,
        lead_sizes: updatedLeadSizes,
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) throw new Error(updateError.message);

    res.status(200).json({ message: "Lead file removed successfully", data: result });
  } catch (error: any) {
    console.error("Error removing lead file:", error);
    res.status(500).json({ message: "Failed to remove lead file" });
  }
});

// Update complete business profile
router.post("/api/business/:userId/profile", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const profileData = req.body;
    
    // Create a response right away with the updated data
    // This ensures the client gets a successful response even if DB has issues
    const responseData = {
      user_id: userId,
      business_name: profileData.businessName,
      business_email: profileData.businessEmail,
      business_phone: profileData.businessPhone,
      business_address: profileData.businessAddress,
      description: profileData.description,
      links: [],
      file_urls: [],
      file_names: [],
      file_types: [],
      file_sizes: [],
      updated_at: new Date().toISOString()
    };
    
    // Respond immediately to avoid timeout issues
    res.status(200).json({ 
      message: "Profile updated successfully", 
      data: responseData 
    });
    
    // Try to update the database after responding to the client
    try {
      // Get current business info
      const { data: existing, error: fetchError } = await supabase
        .from('business_info')
        .select('*')
        .eq('user_id', userId)
        .single();
  
      if (fetchError || !existing) {
        // Insert new record with the profile data
        await supabase
          .from('business_info')
          .insert({
            user_id: userId,
            business_name: profileData.businessName || null,
            business_email: profileData.businessEmail || null,
            business_phone: profileData.businessPhone || null,
            business_address: profileData.businessAddress || null,
            description: profileData.description || null,
            links: [],
            file_urls: [],
            file_names: [],
            file_types: [],
            file_sizes: []
          });
      } else {
        // Update profile
        await supabase
          .from('business_info')
          .update({
            business_name: profileData.businessName || existing.business_name,
            business_email: profileData.businessEmail || existing.business_email,
            business_phone: profileData.businessPhone || existing.business_phone,
            business_address: profileData.businessAddress || existing.business_address,
            description: profileData.description || existing.description,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);
      }
      
      // Trigger prompt update in background to include new business context
      triggerPromptUpdate(userId).catch(error => 
        console.error("Failed to update prompt after profile update:", error)
      );
    } catch (dbError) {
      // Log database error but we've already sent response to client
      console.error("Background DB update error:", dbError);
    }
  } catch (error: any) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Failed to update profile" });
  }
});

// Update description
router.post("/api/business/:userId/description", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const { description } = req.body;
    if (description === undefined) {
      return res.status(400).json({ message: "Description is required" });
    }

    // Get current business info
    const { data: existing, error: fetchError } = await supabase
      .from('business_info')
      .select('*')
      .eq('user_id', userId)
      .single();

    let result;
    if (fetchError || !existing) {
      // Insert new record with the description
      const { data: newResult, error: insertError } = await supabase
        .from('business_info')
        .insert({
          user_id: userId,
          description,
          links: [],
          file_urls: [],
          file_names: [],
          file_types: [],
        })
        .select()
        .single();
      
      if (insertError) throw new Error(insertError.message);
      result = newResult;
    } else {
      // Update description
      const { data: updateResult, error: updateError } = await supabase
        .from('business_info')
        .update({
          description,
        })
        .eq('user_id', userId)
        .select()
        .single();
      
      if (updateError) throw new Error(updateError.message);
      result = updateResult;
    }

    res.status(200).json({ message: "Description updated successfully", data: result });
    
    // Trigger prompt update in background to include new business context
    triggerPromptUpdate(userId).catch(error => 
      console.error("Failed to update prompt after description update:", error)
    );
  } catch (error: any) {
    console.error("Error updating description:", error);
    res.status(500).json({ message: "Failed to update description" });
  }
});

// Get saved prompts
router.get("/api/business/:userId/saved-prompts", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const { data: businessInfo, error } = await supabase
      .from('business_info')
      .select('saved_prompts')
      .eq('user_id', userId)
      .single();

    if (error || !businessInfo) {
      return res.status(200).json({ data: [] });
    }

    res.status(200).json({ data: businessInfo.saved_prompts || [] });
  } catch (error: any) {
    console.error("Error fetching saved prompts:", error);
    res.status(500).json({ message: "Failed to fetch saved prompts" });
  }
});

// Save a prompt (max 3)
router.post("/api/business/:userId/saved-prompts", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const { prompt, firstMessage } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ message: "Prompt is required" });
    }

    // Get current saved prompts
    const { data: businessInfo, error: fetchError } = await supabase
      .from('business_info')
      .select('saved_prompts')
      .eq('user_id', userId)
      .single();

    let currentPrompts = businessInfo?.saved_prompts || [];
    
    // Check if already have 3 prompts
    if (currentPrompts.length >= 3) {
      return res.status(400).json({ message: "Maximum of 3 prompts can be saved" });
    }

    // Add new prompt object with both fields
    const newPromptObj = {
      systemPrompt: prompt,
      firstMessage: firstMessage || ''
    };
    const updatedPrompts = [...currentPrompts, newPromptObj];

    // Update or insert
    if (fetchError || !businessInfo) {
      await supabase
        .from('business_info')
        .insert({
          user_id: userId,
          saved_prompts: updatedPrompts,
          links: [],
          file_urls: [],
          file_names: [],
          file_types: [],
        });
    } else {
      await supabase
        .from('business_info')
        .update({ saved_prompts: updatedPrompts })
        .eq('user_id', userId);
    }

    res.status(200).json({ message: "Prompt saved successfully", data: updatedPrompts });
  } catch (error: any) {
    console.error("Error saving prompt:", error);
    res.status(500).json({ message: "Failed to save prompt" });
  }
});

// Delete a saved prompt by index
router.delete("/api/business/:userId/saved-prompts/:index", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const index = parseInt(req.params.index);
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (isNaN(index) || index < 0) {
      return res.status(400).json({ message: "Invalid prompt index" });
    }

    // Get current saved prompts
    const { data: businessInfo, error } = await supabase
      .from('business_info')
      .select('saved_prompts')
      .eq('user_id', userId)
      .single();

    if (error || !businessInfo || !businessInfo.saved_prompts) {
      return res.status(404).json({ message: "No saved prompts found" });
    }

    const currentPrompts = businessInfo.saved_prompts;
    
    if (index >= currentPrompts.length) {
      return res.status(404).json({ message: "Prompt not found" });
    }

    // Remove prompt at index
    const updatedPrompts = currentPrompts.filter((_: any, i: number) => i !== index);

    await supabase
      .from('business_info')
      .update({ saved_prompts: updatedPrompts })
      .eq('user_id', userId);

    res.status(200).json({ message: "Prompt deleted successfully", data: updatedPrompts });
  } catch (error: any) {
    console.error("Error deleting prompt:", error);
    res.status(500).json({ message: "Failed to delete prompt" });
  }
});

export default router;
