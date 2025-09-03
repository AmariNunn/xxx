import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Link, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

interface SearchResult {
  chunkId: number;
  documentId: number;
  content: string;
  summary: string;
  keywords: string[];
  chunkIndex: number;
  documentTitle: string;
  sourceType: string;
  sourceUrl: string;
}

interface DocumentStatus {
  totalDocuments: number;
  processedDocuments: number;
  failedDocuments: number;
  totalChunks: number;
  documents: Array<{
    id: number;
    title: string;
    sourceType: string;
    status: string;
    processedAt: string | null;
  }>;
}

export default function RAGSearchPage() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { user } = useAuth();

  // Get document processing status
  const { data: statusData, refetch: refetchStatus } = useQuery({
    queryKey: ['/api/rag/status', user?.id],
    queryFn: () => fetch(`/api/rag/status/${user?.id}`).then(r => r.json()),
    enabled: !!user?.id,
    refetchInterval: 5000 // Refresh every 5 seconds
  });

  const status: DocumentStatus = statusData?.status;

  // Process documents mutation
  const processDocuments = useMutation({
    mutationFn: () => fetch(`/api/rag/process/${user?.id}`, { method: 'POST' }).then(r => r.json()),
    onSuccess: () => {
      setTimeout(() => refetchStatus(), 2000);
    }
  });

  // Perform search
  const handleSearch = async () => {
    if (!query.trim() || !user?.id) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(`/api/rag/search/${user.id}?q=${encodeURIComponent(query)}&limit=20`);
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing': return <Clock className="h-4 w-4 text-blue-500" />;
      default: return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  if (!user) {
    return <div>Please log in to access document search.</div>;
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Document Search & Knowledge Base</h1>
        <p className="text-muted-foreground">
          Search through your uploaded files and web links to find relevant information quickly.
        </p>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Total Documents</p>
                <p className="text-2xl font-bold">{status?.totalDocuments || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Processed</p>
                <p className="text-2xl font-bold">{status?.processedDocuments || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Search className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium">Search Chunks</p>
                <p className="text-2xl font-bold">{status?.totalChunks || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <Button 
              onClick={() => processDocuments.mutate()}
              disabled={processDocuments.isPending}
              className="w-full"
              variant="outline"
            >
              {processDocuments.isPending ? 'Processing...' : 'Process Documents'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Search Interface */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Search Knowledge Base</CardTitle>
          <CardDescription>
            Enter keywords to find relevant information from your documents and links
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2">
            <Input
              placeholder="Search for information in your documents..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button 
              onClick={handleSearch}
              disabled={isSearching || !query.trim()}
            >
              <Search className="h-4 w-4 mr-2" />
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Search Results ({searchResults.length})
          </h2>
          <div className="space-y-4">
            {searchResults.map((result) => (
              <Card key={result.chunkId}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {result.sourceType === 'file' ? (
                        <FileText className="h-4 w-4 text-blue-500" />
                      ) : (
                        <Link className="h-4 w-4 text-green-500" />
                      )}
                      <CardTitle className="text-lg">{result.documentTitle}</CardTitle>
                    </div>
                    <Badge variant="secondary">
                      {result.sourceType} • Chunk {result.chunkIndex + 1}
                    </Badge>
                  </div>
                  {result.summary && (
                    <CardDescription>{result.summary}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-sm mb-3 line-clamp-4">
                    {result.content}
                  </p>
                  {result.keywords && result.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {result.keywords.slice(0, 5).map((keyword) => (
                        <Badge key={keyword} variant="outline" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Document Status List */}
      {status?.documents && status.documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Document Processing Status</CardTitle>
            <CardDescription>
              Status of your uploaded files and links
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {status.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    {doc.sourceType === 'file' ? (
                      <FileText className="h-4 w-4 text-blue-500" />
                    ) : (
                      <Link className="h-4 w-4 text-green-500" />
                    )}
                    <div>
                      <p className="font-medium">{doc.title}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {doc.sourceType}
                        {doc.processedAt && ` • Processed ${new Date(doc.processedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(doc.status)}
                    <Badge 
                      variant={doc.status === 'completed' ? 'default' : 
                              doc.status === 'failed' ? 'destructive' : 'secondary'}
                    >
                      {doc.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No results message */}
      {query && searchResults.length === 0 && !isSearching && (
        <Card>
          <CardContent className="p-8 text-center">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No results found</h3>
            <p className="text-muted-foreground">
              Try different keywords or make sure your documents have been processed.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}