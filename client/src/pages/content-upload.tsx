import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Upload, FileText, CheckCircle, Brain } from "lucide-react";
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

export default function ContentUploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [contentSummary, setContentSummary] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing content
  const { data: contentData, isLoading } = useQuery({
    queryKey: ["/api/content"],
  });

  const userContent: UserContent[] = contentData?.content || [];

  // Save content mutation (simplified for now)
  const saveContentMutation = useMutation({
    mutationFn: async (data: { fileName: string; fileType: string; contentSummary: string }) => {
      return apiRequest("/api/content/save", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          uploadUrl: `local://${data.fileName}` // Simplified for demo
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      setSelectedFile(null);
      setContentSummary("");
      toast({
        title: "Success",
        description: "Content information saved successfully",
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
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSave = async () => {
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
      await saveContentMutation.mutateAsync({
        fileName: selectedFile.name,
        fileType: selectedFile.type || "application/octet-stream",
        contentSummary: contentSummary || `Content from ${selectedFile.name}`,
      });

    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Error",
        description: "Failed to save content information",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
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
    <div className="container mx-auto py-8 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">AI Training Content</h1>
        <p className="text-muted-foreground">
          Upload and manage content that your AI voice agent will reference during conversations
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Upload Training Content
          </CardTitle>
          <CardDescription>
            Add documents, manuals, pricing sheets, or other business content that your AI agent should know about
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file-upload">Select File</Label>
            <Input
              id="file-upload"
              type="file"
              accept=".pdf,.doc,.docx,.txt,.md,.csv"
              onChange={handleFileSelect}
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="content-summary">Content Description</Label>
            <Textarea
              id="content-summary"
              placeholder="Describe what this document contains (e.g., 'Company pricing for all services', 'Customer service policies and procedures', 'Product specifications and features', etc.)"
              value={contentSummary}
              onChange={(e) => setContentSummary(e.target.value)}
              rows={3}
            />
          </div>

          <Button 
            onClick={handleSave}
            disabled={!selectedFile || isUploading || saveContentMutation.isPending}
            className="w-full"
          >
            <Upload className="mr-2 h-4 w-4" />
            {isUploading ? "Saving..." : "Save Content Info"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your AI Training Content</CardTitle>
          <CardDescription>
            Content that your AI voice agent can reference during phone conversations
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
              <p className="font-medium">No training content yet</p>
              <p className="text-sm">Upload documents to enhance your AI agent's knowledge</p>
            </div>
          ) : (
            <div className="space-y-3">
              {userContent.map((content) => (
                <div
                  key={content.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-card"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">
                      {getFileIcon(content.fileType)}
                    </span>
                    <div>
                      <h4 className="font-medium">{content.fileName}</h4>
                      {content.contentSummary && (
                        <p className="text-sm text-muted-foreground max-w-md">
                          {content.contentSummary}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Added {formatDate(content.uploadedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteContentMutation.mutate(content.id)}
                      disabled={deleteContentMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              
              {userContent.length > 0 && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>AI Integration:</strong> This content is now available to your external AI voice agent 
                    through the API endpoints at <code>/api/ai/prompt/{"{userId}"}</code>
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}