import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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
  
  // Local state for demo purposes (in a real app, this would be synced with the backend)
  const [uploadedFiles, setUploadedFiles] = useState<{
    fileName: string;
    fileType: string;
  }[]>([]);
  
  const [links, setLinks] = useState<string[]>([]);
  const [description, setDescription] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);

  // Form setup for link input
  const linkForm = useForm<LinkFormData>({
    resolver: zodResolver(linkSchema),
    defaultValues: {
      link: "",
    },
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

    // Simulate file upload
    setIsUploading(true);
    setTimeout(() => {
      setUploadedFiles([...uploadedFiles, { 
        fileName: file.name, 
        fileType: file.type 
      }]);
      setIsUploading(false);
      
      toast({
        title: "File uploaded",
        description: "Your file has been added to the business context.",
      });
      
      if (fileInputRef.current) fileInputRef.current.value = "";
    }, 1000);
  };

  // Handle link submission
  const onSubmitLink = (data: LinkFormData) => {
    setLinks([...links, data.link]);
    linkForm.reset();
    
    toast({
      title: "Link added",
      description: "Your link has been added to the business context.",
    });
  };

  // Handle description update
  const handleDescriptionSave = () => {
    toast({
      title: "Notes saved",
      description: "Your business notes have been saved.",
    });
  };

  // Remove a file
  const removeFile = (index: number) => {
    const newFiles = [...uploadedFiles];
    newFiles.splice(index, 1);
    setUploadedFiles(newFiles);
    
    toast({
      title: "File removed",
      description: "The file has been removed from your business context.",
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