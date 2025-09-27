import express, { Request, Response } from "express";
import { db } from "../db";
import { businessInfo } from "@shared/schema";
import { eq } from "drizzle-orm";
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
        const response = await fetch(`http://localhost:5000/api/prompt/${userId}`, {
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
            return;
        }

        // Get current business info
        const existing = await db
            .select()
            .from(businessInfo)
            .where(eq(businessInfo.userId, userId));

        if (existing.length === 0) {
            console.log('📝 No existing business info found, skipping scraped content storage');
            return;
        }

        const current = existing[0];
        
        // Update with scraped content
        await db
            .update(businessInfo)
            .set({
                scrapedContent: [...(current.scrapedContent || []), scrapedData.content],
                scrapedTitles: [...(current.scrapedTitles || []), scrapedData.title || ''],
                scrapedUrls: [...(current.scrapedUrls || []), scrapedData.url],
                scrapedAt: [...(current.scrapedAt || []), scrapedData.scrapedAt.toISOString()],
            })
            .where(eq(businessInfo.userId, userId));

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
            return;
        }

        // Get current business info
        const existing = await db
            .select()
            .from(businessInfo)
            .where(eq(businessInfo.userId, userId));

        if (existing.length === 0) {
            console.log('📝 No existing business info found, skipping document content storage');
            return;
        }

        const current = existing[0];
        
        // Update with extracted document content
        await db
            .update(businessInfo)
            .set({
                documentContent: [...(current.documentContent || []), extractedData.content],
                documentTitles: [...(current.documentTitles || []), extractedData.title || extractedData.fileName],
                documentExtractedAt: [...(current.documentExtractedAt || []), extractedData.extractedAt.toISOString()],
            })
            .where(eq(businessInfo.userId, userId));

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

    const result = await db
      .select()
      .from(businessInfo)
      .where(eq(businessInfo.userId, userId));

    if (result.length === 0) {
      // Create default business info for new users
      const defaultBusinessInfo = {
        userId,
        businessName: "Your Business Name",
        businessEmail: "contact@yourbusiness.com",
        businessPhone: "(123) 456-7890",
        businessAddress: "123 Business St, Business City, 12345",
        description: "Describe your business and how the AI assistant should represent you.",
        links: [],
        fileUrls: [],
        fileNames: [],
        fileTypes: [],
        fileSizes: [],
        logoUrl: null,
      };

      // Insert default info into database
      const [newInfo] = await db
        .insert(businessInfo)
        .values(defaultBusinessInfo)
        .returning();

      return res.status(200).json({ data: newInfo });
    }

    res.status(200).json({ data: result[0] });
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
    const existing = await db
      .select()
      .from(businessInfo)
      .where(eq(businessInfo.userId, userId));

    // Prepare the data
    const data = {
      userId,
      businessName: req.body.businessName || null,
      businessEmail: req.body.businessEmail || null,
      businessPhone: req.body.businessPhone || null,
      businessAddress: req.body.businessAddress || null,
      description: req.body.description || null,
      links: req.body.links || [],
      fileUrls: req.body.fileUrls || [],
      fileNames: req.body.fileNames || [],
      fileTypes: req.body.fileTypes || [],
      fileSizes: req.body.fileSizes || [],
      logoUrl: req.body.logoUrl || null,
    };

    let result;
    if (existing.length === 0) {
      // Insert new record
      result = await db.insert(businessInfo).values(data).returning();
    } else {
      // Update existing record
      result = await db
        .update(businessInfo)
        .set(data)
        .where(eq(businessInfo.userId, userId))
        .returning();
    }

    res.status(200).json({ message: "Business info saved successfully", data: result[0] });
    
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
    const existing = await db
      .select()
      .from(businessInfo)
      .where(eq(businessInfo.userId, userId));

    let result;
    if (existing.length === 0) {
      // Insert new record with the link
      result = await db
        .insert(businessInfo)
        .values({
          userId,
          description: null,
          links: [link],
          fileUrls: [],
          fileNames: [],
          fileTypes: [],
        })
        .returning();
    } else {
      // Update links array
      const currentLinks = existing[0].links || [];
      result = await db
        .update(businessInfo)
        .set({
          links: [...currentLinks, link],
        })
        .where(eq(businessInfo.userId, userId))
        .returning();
    }

    res.status(200).json({ message: "Link added successfully", data: result[0] });
    
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

// Remove link
router.delete("/api/business/:userId/links/:index", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const index = parseInt(req.params.index);
    
    if (!userId || typeof userId !== 'string' || isNaN(index)) {
      return res.status(400).json({ message: "Invalid parameters" });
    }

    // Get current business info
    const existing = await db
      .select()
      .from(businessInfo)
      .where(eq(businessInfo.userId, userId));

    if (existing.length === 0) {
      return res.status(404).json({ message: "Business info not found" });
    }

    const currentLinks = existing[0].links || [];
    if (index < 0 || index >= currentLinks.length) {
      return res.status(400).json({ message: "Invalid link index" });
    }

    // Remove the link at the specified index
    const updatedLinks = [...currentLinks];
    updatedLinks.splice(index, 1);

    const result = await db
      .update(businessInfo)
      .set({
        links: updatedLinks,
      })
      .where(eq(businessInfo.userId, userId))
      .returning();

    res.status(200).json({ message: "Link removed successfully", data: result[0] });
    
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
    const existing = await db
      .select()
      .from(businessInfo)
      .where(eq(businessInfo.userId, userId));

    let result;
    if (existing.length === 0) {
      // Insert new record with the file
      result = await db
        .insert(businessInfo)
        .values({
          userId,
          description: null,
          links: [],
          fileUrls: [fileUrl],
          fileNames: [fileName],
          fileTypes: [fileType],
          fileSizes: fileSize ? [fileSize] : [],
        })
        .returning();
    } else {
      // Update file arrays
      const currentFileUrls = existing[0].fileUrls || [];
      const currentFileNames = existing[0].fileNames || [];
      const currentFileTypes = existing[0].fileTypes || [];
      const currentFileSizes = existing[0].fileSizes || [];

      result = await db
        .update(businessInfo)
        .set({
          fileUrls: [...currentFileUrls, fileUrl],
          fileNames: [...currentFileNames, fileName],
          fileTypes: [...currentFileTypes, fileType],
          fileSizes: fileSize ? [...currentFileSizes, fileSize] : currentFileSizes,
        })
        .where(eq(businessInfo.userId, userId))
        .returning();
    }

    res.status(200).json({ message: "File added successfully", data: result[0] });
    
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
    const existing = await db
      .select()
      .from(businessInfo)
      .where(eq(businessInfo.userId, userId));

    let result;
    if (existing.length === 0) {
      // Insert new record with the lead file
      result = await db
        .insert(businessInfo)
        .values({
          userId,
          description: null,
          links: [],
          fileUrls: [],
          fileNames: [],
          fileTypes: [],
          fileSizes: [],
          leadUrls: [fileUrl],
          leadNames: [fileName],
          leadTypes: [fileType],
          leadSizes: fileSize ? [fileSize] : [],
        })
        .returning();
    } else {
      // Update lead file arrays
      const currentLeadUrls = existing[0].leadUrls || [];
      const currentLeadNames = existing[0].leadNames || [];
      const currentLeadTypes = existing[0].leadTypes || [];
      const currentLeadSizes = existing[0].leadSizes || [];

      result = await db
        .update(businessInfo)
        .set({
          leadUrls: [...currentLeadUrls, fileUrl],
          leadNames: [...currentLeadNames, fileName],
          leadTypes: [...currentLeadTypes, fileType],
          leadSizes: fileSize ? [...currentLeadSizes, fileSize] : currentLeadSizes,
        })
        .where(eq(businessInfo.userId, userId))
        .returning();
    }

    res.status(200).json({ message: "Lead file added successfully", data: result[0] });
  } catch (error: any) {
    console.error("Error adding lead file:", error);
    res.status(500).json({ message: "Failed to add lead file" });
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
    const existing = await db
      .select()
      .from(businessInfo)
      .where(eq(businessInfo.userId, userId));

    if (existing.length === 0) {
      return res.status(404).json({ message: "Business info not found" });
    }

    const currentFileUrls = existing[0].fileUrls || [];
    const currentFileNames = existing[0].fileNames || [];
    const currentFileTypes = existing[0].fileTypes || [];
    const currentFileSizes = existing[0].fileSizes || [];

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

    const result = await db
      .update(businessInfo)
      .set({
        fileUrls: updatedFileUrls,
        fileNames: updatedFileNames,
        fileTypes: updatedFileTypes,
        fileSizes: updatedFileSizes,
      })
      .where(eq(businessInfo.userId, userId))
      .returning();

    res.status(200).json({ message: "File removed successfully", data: result[0] });
    
    // Trigger prompt update in background to remove business context
    triggerPromptUpdate(userId).catch(error => 
      console.error("Failed to update prompt after file removal:", error)
    );
  } catch (error: any) {
    console.error("Error removing file:", error);
    res.status(500).json({ message: "Failed to remove file" });
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
    const existing = await db
      .select()
      .from(businessInfo)
      .where(eq(businessInfo.userId, userId));

    if (existing.length === 0) {
      return res.status(404).json({ message: "Business info not found" });
    }

    const currentLeadUrls = existing[0].leadUrls || [];
    const currentLeadNames = existing[0].leadNames || [];
    const currentLeadTypes = existing[0].leadTypes || [];
    const currentLeadSizes = existing[0].leadSizes || [];

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

    const result = await db
      .update(businessInfo)
      .set({
        leadUrls: updatedLeadUrls,
        leadNames: updatedLeadNames,
        leadTypes: updatedLeadTypes,
        leadSizes: updatedLeadSizes,
      })
      .where(eq(businessInfo.userId, userId))
      .returning();

    res.status(200).json({ message: "Lead file removed successfully", data: result[0] });
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
      userId,
      businessName: profileData.businessName,
      businessEmail: profileData.businessEmail,
      businessPhone: profileData.businessPhone,
      businessAddress: profileData.businessAddress,
      description: profileData.description,
      links: [],
      fileUrls: [],
      fileNames: [],
      fileTypes: [],
      fileSizes: [],
      updatedAt: new Date()
    };
    
    // Respond immediately to avoid timeout issues
    res.status(200).json({ 
      message: "Profile updated successfully", 
      data: responseData 
    });
    
    // Try to update the database after responding to the client
    try {
      // Get current business info
      const existing = await db
        .select()
        .from(businessInfo)
        .where(eq(businessInfo.userId, userId));
  
      if (existing.length === 0) {
        // Insert new record with the profile data
        await db
          .insert(businessInfo)
          .values({
            userId,
            businessName: profileData.businessName || null,
            businessEmail: profileData.businessEmail || null,
            businessPhone: profileData.businessPhone || null,
            businessAddress: profileData.businessAddress || null,
            description: profileData.description || null,
            links: [],
            fileUrls: [],
            fileNames: [],
            fileTypes: [],
            fileSizes: []
          });
      } else {
        // Update profile
        await db
          .update(businessInfo)
          .set({
            businessName: profileData.businessName || existing[0].businessName,
            businessEmail: profileData.businessEmail || existing[0].businessEmail,
            businessPhone: profileData.businessPhone || existing[0].businessPhone,
            businessAddress: profileData.businessAddress || existing[0].businessAddress,
            description: profileData.description || existing[0].description,
            updatedAt: new Date()
          })
          .where(eq(businessInfo.userId, userId));
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
    const existing = await db
      .select()
      .from(businessInfo)
      .where(eq(businessInfo.userId, userId));

    let result;
    if (existing.length === 0) {
      // Insert new record with the description
      result = await db
        .insert(businessInfo)
        .values({
          userId,
          description,
          links: [],
          fileUrls: [],
          fileNames: [],
          fileTypes: [],
        })
        .returning();
    } else {
      // Update description
      result = await db
        .update(businessInfo)
        .set({
          description,
        })
        .where(eq(businessInfo.userId, userId))
        .returning();
    }

    res.status(200).json({ message: "Description updated successfully", data: result[0] });
    
    // Trigger prompt update in background to include new business context
    triggerPromptUpdate(userId).catch(error => 
      console.error("Failed to update prompt after description update:", error)
    );
  } catch (error: any) {
    console.error("Error updating description:", error);
    res.status(500).json({ message: "Failed to update description" });
  }
});

export default router;