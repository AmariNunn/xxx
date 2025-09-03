import React, { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Trash2, Link as LinkIcon, FileText, FileImage, AlertCircle, X, Plus } from "lucide-react";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

// Validation schema for link input
const linkSchema = z.object({
  link: z.string()
    .min(1, { message: "Link is required" })
    .refine((val) => val.includes('.'), { message: "Link should contain at least one period" }),
});

type LinkFormData = z.infer<typeof linkSchema>;

// Accepted file types
const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
];

const FILE_SIZE_LIMIT = 5 * 1024 * 1024; // 5MB

export default function BusinessContextPanel() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Get current user ID from localStorage for personalized experience
  const userId = Number(localStorage.getItem('userId')) || 1;
  
  // State for files, links, and description
  const [uploadedFiles, setUploadedFiles] = useState<{
    fileName: string;
    fileType: string;
    fileUrl: string;
    fileSize?: string;
  }[]>([]);
  
  const [links, setLinks] = useState<string[]>([]);
  const [description, setDescription] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  
  // Fetch business data
  const { data: businessData } = useQuery({
    queryKey: ['/api/business', userId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/business/${userId}`);
      return response.json();
    }
  });
  
  // Initialize from saved data when business data loads
  React.useEffect(() => {
    if (businessData?.data) {
      const fileData = businessData.data.fileNames ? businessData.data.fileNames.map((name: string, index: number) => ({
        fileName: name,
        fileType: businessData.data.fileTypes[index] || '',
        fileUrl: businessData.data.fileUrls[index] || '',
        fileSize: businessData.data.fileSizes && businessData.data.fileSizes[index] ? businessData.data.fileSizes[index] : undefined
      })) : [];
      
      setUploadedFiles(fileData);
      setLinks(businessData.data.links || []);
      setDescription(businessData.data.description || '');
    }
  }, [businessData]);

  // Form setup for link input
  const linkForm = useForm<LinkFormData>({
    resolver: zodResolver(linkSchema),
    defaultValues: {
      link: "",
    },
  });

  // File upload mutation
  const addFileMutation = useMutation({
    mutationFn: async (fileData: {
      fileUrl: string;
      fileName: string;
      fileType: string;
      fileSize?: string;
    }) => {
      const response = await apiRequest("POST", `/api/business/${userId}/files`, fileData);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['/api/business', userId] });
    }
  });

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validate file type
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF, DOCX, JPG, or PNG file.",
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Validate file size
    if (file.size > FILE_SIZE_LIMIT) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 5MB.",
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Create a mock file URL (in production, this would be a real cloud storage URL)
    // In a real app, you'd upload to S3, Firebase Storage, etc.
    const mockFileUrl = `file://${userId}/${Date.now()}-${encodeURIComponent(file.name)}`;
    const fileSizeString = formatFileSize(file.size);
    
    setIsUploading(true);
    
    // Add file to database
    addFileMutation.mutate({
      fileUrl: mockFileUrl,
      fileName: file.name,
      fileType: file.type,
      fileSize: fileSizeString
    }, {
      onSuccess: (data) => {
        setIsUploading(false);
        
        // Update local state to show the new file immediately
        setUploadedFiles([...uploadedFiles, { 
          fileName: file.name, 
          fileType: file.type,
          fileUrl: mockFileUrl,
          fileSize: fileSizeString
        }]);
        
        toast({
          title: "File uploaded",
          description: "Your file has been saved in the database and will appear on your profile.",
        });
        
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
      onError: (error) => {
        setIsUploading(false);
        toast({
          title: "Upload failed",
          description: "There was a problem saving your file. Please try again.",
          variant: "destructive",
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  };
  
  // Format file size to human-readable string
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " bytes";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // Link addition mutation
  const addLinkMutation = useMutation({
    mutationFn: async (link: string) => {
      const response = await apiRequest("POST", `/api/business/${userId}/links`, { link });
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['/api/business', userId] });
    }
  });

  // Handle link submission
  const onSubmitLink = (data: LinkFormData) => {
    // Optimistically update UI
    setLinks([...links, data.link]);
    linkForm.reset();
    
    // Send to server
    addLinkMutation.mutate(data.link, {
      onSuccess: () => {
        toast({
          title: "Link added",
          description: "Your link has been saved in the database.",
        });
      },
      onError: () => {
        // Restore previous links if server request fails
        setLinks([...links]);
        toast({
          title: "Error adding link",
          description: "There was a problem saving your link. Please try again.",
          variant: "destructive"
        });
      }
    });
  };

  // Description update mutation
  const updateDescriptionMutation = useMutation({
    mutationFn: async (description: string) => {
      const response = await apiRequest("POST", `/api/business/${userId}/description`, { description });
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['/api/business', userId] });
    }
  });

  // Handle description update
  const handleDescriptionSave = () => {
    updateDescriptionMutation.mutate(description, {
      onSuccess: () => {
        toast({
          title: "Notes saved",
          description: "Your business notes have been saved in the database.",
        });
      },
      onError: () => {
        toast({
          title: "Error saving notes",
          description: "There was a problem saving your notes. Please try again.",
          variant: "destructive"
        });
      }
    });
  };

  // File removal mutation
  const removeFileMutation = useMutation({
    mutationFn: async (index: number) => {
      const response = await apiRequest("DELETE", `/api/business/${userId}/files/${index}`);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['/api/business', userId] });
    }
  });

  // Remove a file
  const removeFile = (index: number) => {
    // Optimistically update UI
    const newFiles = [...uploadedFiles];
    newFiles.splice(index, 1);
    setUploadedFiles(newFiles);
    
    // Send deletion request to server
    removeFileMutation.mutate(index, {
      onSuccess: () => {
        toast({
          title: "File removed",
          description: "The file has been removed from your business context.",
        });
      },
      onError: () => {
        // Restore the file in local state if server request fails
        setUploadedFiles([...uploadedFiles]);
        toast({
          title: "Error removing file",
          description: "There was a problem removing the file. Please try again.",
          variant: "destructive"
        });
      }
    });
  };

  // Remove a link
  const removeLink = (index: number) => {
    const newLinks = [...links];
    newLinks.splice(index, 1);
    setLinks(newLinks);
    
    toast({
      title: "Link removed",
      description: "The link has been removed from your business context.",
    });
  };

  // Get file icon based on file type
  const getFileIcon = (fileType: string) => {
    if (fileType.includes("image")) {
      return <FileImage className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business Context</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <p className="text-sm text-gray-500">
            Help us personalize your Vox Assistant. Upload any files, links, or notes that help explain your business, services, or customer experience.
          </p>

          {/* File Upload Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium">Files</h3>
              <div>
                <Input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".pdf,.docx,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  disabled={isUploading}
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? "Uploading..." : "Upload File"}
                </Button>
              </div>
            </div>
            
            <div className="p-4 border border-gray-200 rounded-md bg-gray-50 min-h-[100px]">
              {uploadedFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-20 text-gray-400">
                  <FileText className="h-8 w-8 mb-2" />
                  <p className="text-sm">Upload PDFs, DOCXs, JPGs, or PNGs (Max 5MB)</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                      <div className="flex items-center space-x-2">
                        {getFileIcon(file.fileType)}
                        <span className="text-sm truncate max-w-[250px]">{file.fileName}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Links Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Links</h3>
            
            <Form {...linkForm}>
              <form onSubmit={linkForm.handleSubmit(onSubmitLink)} className="flex space-x-2">
                <FormField
                  control={linkForm.control}
                  name="link"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <div className="relative">
                          <Input
                            placeholder="Paste a URL (website, social media, etc.)"
                            {...field}
                            className="pl-8"
                          />
                          <LinkIcon className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </form>
            </Form>
            
            <div className="p-4 border border-gray-200 rounded-md bg-gray-50 min-h-[100px]">
              {links.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-20 text-gray-400">
                  <LinkIcon className="h-8 w-8 mb-2" />
                  <p className="text-sm">Add links to websites, social media, or other resources</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {links.map((link, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1 px-3 py-1.5">
                      <LinkIcon className="h-3 w-3" />
                      <span className="truncate max-w-[200px]">
                        {link.replace(/^https?:\/\//, "").replace(/^www\./, "")}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLink(index)}
                        className="h-4 w-4 p-0 ml-1"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Description Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium">Notes & Instructions</h3>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDescriptionSave}
              >
                Save Notes
              </Button>
            </div>
            
            <Textarea
              placeholder="Add any additional context, instructions, or details about your business and how you want the Vox Assistant to interact with customers..."
              className="min-h-[120px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            
            <div className="flex items-center text-xs text-gray-500">
              <AlertCircle className="h-3 w-3 mr-1" />
              The more context you provide, the better your Vox Assistant can represent your business.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}