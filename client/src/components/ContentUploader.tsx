import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Upload, FileText, CheckCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface UserContent {
  id: number;
  fileName: string;
  fileType: string;
  uploadUrl: string;
  contentSummary?: string;
  uploadedAt: string;
}

export function ContentUploader() {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [contentSummary, setContentSummary] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing content
  const { data: contentData, isLoading } = useQuery({
    queryKey: ["/api/content"],
  });

  const userContent: UserContent[] = contentData?.content || [];

  // Get upload URL mutation
  const getUploadUrlMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/content/upload-url");
    },
  });

  // Save content metadata mutation
  const saveContentMutation = useMutation({
    mutationFn: async (data: { fileName: string; fileType: string; uploadUrl: string; contentSummary: string }) => {
      return apiRequest("/api/content/save", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      setSelectedFile(null);
      setContentSummary("");
      toast({
        title: "Success",
        description: "Content uploaded successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save content",
        variant: "destructive",
      });
    },
  });

  // Delete content mutation
  const deleteContentMutation = useMutation({
    mutationFn: async (contentId: number) => {
      return apiRequest(`/api/content/${contentId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      toast({
        title: "Success",
        description: "Content deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete content",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "Error",
        description: "Please select a file first",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Get upload URL
      const uploadResponse = await getUploadUrlMutation.mutateAsync();
      const uploadUrl = uploadResponse.uploadUrl;

      // Upload file to storage
      const uploadFileResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: selectedFile,
        headers: {
          "Content-Type": selectedFile.type,
        },
      });

      if (!uploadFileResponse.ok) {
        throw new Error("Failed to upload file");
      }

      // Save metadata
      await saveContentMutation.mutateAsync({
        fileName: selectedFile.name,
        fileType: selectedFile.type || "application/octet-stream",
        uploadUrl: uploadUrl,
        contentSummary: contentSummary,
      });

    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Error",
        description: "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = (contentId: number) => {
    deleteContentMutation.mutate(contentId);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return "🖼️";
    if (fileType.includes("pdf")) return "📄";
    if (fileType.includes("document") || fileType.includes("word")) return "📝";
    if (fileType.includes("text")) return "📄";
    return "📁";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Training Content</CardTitle>
          <CardDescription>
            Upload documents to help your AI voice agent provide better responses. 
            These files will be used to personalize your AI's knowledge base.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file-upload">Select File</Label>
            <Input
              id="file-upload"
              type="file"
              accept=".pdf,.doc,.docx,.txt,.md"
              onChange={handleFileSelect}
            />
          </div>

          {selectedFile && (
            <div className="space-y-2">
              <Label htmlFor="content-summary">Content Summary (Optional)</Label>
              <Textarea
                id="content-summary"
                placeholder="Briefly describe what this document contains (e.g., 'Pricing information for services', 'Company policies and procedures', etc.)"
                value={contentSummary}
                onChange={(e) => setContentSummary(e.target.value)}
                rows={3}
              />
            </div>
          )}

          <Button 
            onClick={handleUpload}
            disabled={!selectedFile || isUploading || saveContentMutation.isPending}
            className="w-full"
          >
            <Upload className="mr-2 h-4 w-4" />
            {isUploading ? "Uploading..." : "Upload Content"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uploaded Content</CardTitle>
          <CardDescription>
            Documents that your AI voice agent can reference during conversations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">
              Loading content...
            </div>
          ) : userContent.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No content uploaded yet</p>
              <p className="text-sm">Upload documents to enhance your AI agent's responses</p>
            </div>
          ) : (
            <div className="space-y-3">
              {userContent.map((content) => (
                <div
                  key={content.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">
                      {getFileIcon(content.fileType)}
                    </span>
                    <div>
                      <h4 className="font-medium">{content.fileName}</h4>
                      {content.contentSummary && (
                        <p className="text-sm text-muted-foreground">
                          {content.contentSummary}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Uploaded {formatDate(content.uploadedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(content.id)}
                      disabled={deleteContentMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}