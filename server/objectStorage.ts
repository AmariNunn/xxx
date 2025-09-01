import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";
import { storage } from "./storage";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  // Get the private object directory
  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error("PRIVATE_OBJECT_DIR not set");
    }
    return dir;
  }

  // Generate upload URL for client content
  async getContentUploadURL(userId: number, contentType: 'document' | 'audio' | 'image' | 'other' = 'document'): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/user-content/${userId}/${contentType}/${objectId}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900, // 15 minutes
    });
  }

  // Get uploaded content for a user
  async getUserContentFiles(userId: number): Promise<File[]> {
    const privateObjectDir = this.getPrivateObjectDir();
    const userContentPath = `${privateObjectDir}/user-content/${userId}/`;
    const { bucketName, objectName } = parseObjectPath(userContentPath);
    
    const bucket = objectStorageClient.bucket(bucketName);
    const [files] = await bucket.getFiles({
      prefix: objectName,
    });
    
    return files;
  }

  // Download content file
  async downloadContentFile(userId: number, fileName: string): Promise<Buffer> {
    const privateObjectDir = this.getPrivateObjectDir();
    const filePath = `${privateObjectDir}/user-content/${userId}/${fileName}`;
    const { bucketName, objectName } = parseObjectPath(filePath);
    
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    
    const [exists] = await file.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    
    const [buffer] = await file.download();
    return buffer;
  }

  // Extract text content from uploaded files for AI prompting
  async extractTextContent(userId: number): Promise<string[]> {
    const files = await this.getUserContentFiles(userId);
    const textContents: string[] = [];
    
    for (const file of files) {
      try {
        const [metadata] = await file.getMetadata();
        const contentType = metadata.contentType || '';
        
        if (contentType.startsWith('text/') || 
            contentType === 'application/pdf' || 
            contentType === 'application/msword' ||
            contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          
          // For now, we'll just get basic file info
          // In a production system, you'd want proper text extraction
          const fileName = file.name.split('/').pop() || 'unknown';
          textContents.push(`File: ${fileName} (${contentType})`);
        }
      } catch (error) {
        console.error('Error processing file:', file.name, error);
      }
    }
    
    return textContents;
  }

  // Save file metadata to database
  async saveFileMetadata(userId: number, fileName: string, fileType: string, uploadUrl: string): Promise<void> {
    await storage.addUserContent(userId, {
      fileName,
      fileType,
      uploadUrl,
      uploadedAt: new Date()
    });
  }
}

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return { bucketName, objectName };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to sign object URL, errorcode: ${response.status}`);
  }

  const { signed_url: signedURL } = await response.json();
  return signedURL;
}

export const objectStorageService = new ObjectStorageService();