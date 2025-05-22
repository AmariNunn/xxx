import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Trash2, Link, FileText, FileImage, AlertCircle, X, Plus } from "lucide-react";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Validation schema for the business context
const businessContextSchema = z.object({
  description: z.string().optional(),
  link: z.string()
    .min(1, { message: "Link is required" })
    .refine((val) => val.includes('.'), { message: "Link should contain at least one period" })
    .optional(),
});

type BusinessContextFormData = z.infer<typeof businessContextSchema>;

// Accepted file types
const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
];

const FILE_SIZE_LIMIT = 5 * 1024 * 1024; // 5MB

interface BusinessContextProps {
  userId: number;
}

export default function BusinessContext({ userId }: BusinessContextProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for file uploads
  const [uploadedFiles, setUploadedFiles] = useState<{
    fileName: string;
    fileType: string;
    fileUrl: string;
  }[]>([]);

  // State for added links
  const [links, setLinks] = useState<string[]>([]);

  // State for description
  const [description, setDescription] = useState<string>("");

  // File upload in progress
  const [isUploading, setIsUploading] = useState(false);

  // Form setup
  const form = useForm<BusinessContextFormData>({
    resolver: zodResolver(businessContextSchema),
    defaultValues: {
      description: "",
      link: "",
    },
  });

  // Fetch business context data
  const { data: businessData, isLoading: isLoadingBusinessData } = useQuery({
    queryKey: ['/api/business', userId],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", `/api/business/${userId}`);
        return response.json();
      } catch (error) {
        // If 404, it's fine - user doesn't have business info yet
        if (error instanceof Response && error.status === 404) {
          return { data: null };
        }
        throw error;
      }
    },
  });

  // Update state when business data changes
  useEffect(() => {
    if (businessData?.data) {
      setDescription(businessData.data.description || "");
      setLinks(businessData.data.links || []);

      // Transform file data
      const files = [];
      if (businessData.data.fileNames && businessData.data.fileUrls && businessData.data.fileTypes) {
        for (let i = 0; i < businessData.data.fileNames.length; i++) {
          files.push({
            fileName: businessData.data.fileNames[i],
            fileUrl: businessData.data.fileUrls[i],
            fileType: businessData.data.fileTypes[i],
          });
        }
      }
      setUploadedFiles(files);
    }
  }, [businessData]);

  // Add link mutation
  const addLinkMutation = useMutation({
    mutationFn: async (link: string) => {
      const response = await apiRequest("POST", `/api/business/${userId}/links`, { link });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/business', userId] });
      toast({
        title: "Link added",
        description: "The link has been added to your business context.",
      });
      form.reset({ link: "" });
    },
    onError: (error) => {
      toast({
        title: "Failed to add link",
        description: error.message || "There was an error adding the link. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Remove link mutation
  const removeLinkMutation = useMutation({
    mutationFn: async (index: number) => {
      const response = await apiRequest("DELETE", `/api/business/${userId}/links/${index}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/business', userId] });
      toast({
        title: "Link removed",
        description: "The link has been removed from your business context.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to remove link",
        description: error.message || "There was an error removing the link. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Add file mutation
  const addFileMutation = useMutation({
    mutationFn: async (fileData: { fileUrl: string; fileName: string; fileType: string }) => {
      const response = await apiRequest("POST", `/api/business/${userId}/files`, fileData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/business', userId] });
      toast({
        title: "File uploaded",
        description: "The file has been added to your business context.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to upload file",
        description: error.message || "There was an error uploading the file. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Remove file mutation
  const removeFileMutation = useMutation({
    mutationFn: async (index: number) => {
      const response = await apiRequest("DELETE", `/api/business/${userId}/files/${index}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/business', userId] });
      toast({
        title: "File removed",
        description: "The file has been removed from your business context.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to remove file",
        description: error.message || "There was an error removing the file. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update description mutation
  const updateDescriptionMutation = useMutation({
    mutationFn: async (description: string) => {
      const response = await apiRequest("POST", `/api/business/${userId}/description`, { description });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/business', userId] });
      toast({
        title: "Description updated",
        description: "Your business description has been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update description",
        description: error.message || "There was an error updating the description. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle file select
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    try {
      setIsUploading(true);

      // In a real app, we would upload the file to a storage service here
      // For this demo, we'll simulate it by creating a data URL
      const reader = new FileReader();
      reader.onload = async (event) => {
        // In a real app, event.target.result would be the URL from the storage service
        const fileUrl = event.target?.result as string;

        // Add file to the database
        await addFileMutation.mutateAsync({
          fileUrl,
          fileName: file.name,
          fileType: file.type,
        });

        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setIsUploading(false);
      toast({
        title: "Upload failed",
        description: "There was an error uploading your file. Please try again.",
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle link submission
  const onSubmitLink = (data: BusinessContextFormData) => {
    if (data.link) {
      addLinkMutation.mutate(data.link);
    }
  };

  // Handle description update
  const handleDescriptionSave = () => {
    updateDescriptionMutation.mutate(description);
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
            Help us personalize your AI assistant. Upload any files, links, or notes that help explain your business, services, or customer experience.
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
              {isLoadingBusinessData ? (
                <div className="flex justify-center items-center h-20">
                  <p className="text-sm text-gray-500">Loading files...</p>
                </div>
              ) : uploadedFiles.length === 0 ? (
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
                        onClick={() => removeFileMutation.mutate(index)}
                        disabled={removeFileMutation.isPending}
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

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitLink)} className="flex space-x-2">
                <FormField
                  control={form.control}
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
                          <Link className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" size="sm" disabled={addLinkMutation.isPending}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </form>
            </Form>

            <div className="p-4 border border-gray-200 rounded-md bg-gray-50 min-h-[100px]">
              {isLoadingBusinessData ? (
                <div className="flex justify-center items-center h-20">
                  <p className="text-sm text-gray-500">Loading links...</p>
                </div>
              ) : links.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-20 text-gray-400">
                  <Link className="h-8 w-8 mb-2" />
                  <p className="text-sm">Add links to websites, social media, or other resources</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {links.map((link, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1 px-3 py-1.5">
                      <Link className="h-3 w-3" />
                      <span className="truncate max-w-[200px]">
                        {link.replace(/^https?:\/\//, "").replace(/^www\./, "")}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLinkMutation.mutate(index)}
                        disabled={removeLinkMutation.isPending}
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
                disabled={updateDescriptionMutation.isPending}
              >
                Save Notes
              </Button>
            </div>

            <Textarea
              placeholder="Add any additional context, instructions, or details about your business and how you want the AI assistant to interact with customers..."
              className="min-h-[120px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <div className="flex items-center text-xs text-gray-500">
              <AlertCircle className="h-3 w-3 mr-1" />
              The more context you provide, the better your AI assistant can represent your business.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}