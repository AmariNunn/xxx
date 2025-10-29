import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { 
  Phone,
  Bell, 
  Settings,
  Upload,
  Loader2,
  Mic,
  Bot,
  Users,
  Save,
  Trash2,
  FileText,
  Search,
  Play,
  Check,
  Volume2
} from "lucide-react";
import UserAvatar from "@/components/user-avatar";
import SharedNavigation from "@/components/shared-navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

export default function SkyIQAgent() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Get current user ID from localStorage (UUID format)
  const userId = localStorage.getItem('userId');
  
  // Load business profile data to get the logo
  const [businessLogo, setBusinessLogo] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>("");
  
  // SkyIQ AI Voice Agent state
  const [activeTab, setActiveTab] = useState('single');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [isUpdatingPrompt, setIsUpdatingPrompt] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [batchName, setBatchName] = useState('');
  const [isUploadingBatch, setIsUploadingBatch] = useState(false);
  const [batches, setBatches] = useState<any[]>([]);
  
  // Saved prompts state
  const [savedPrompts, setSavedPrompts] = useState<Array<{systemPrompt: string, firstMessage: string}>>([]);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  
  // Voice selector state
  const [voices, setVoices] = useState<any[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [voiceSearch, setVoiceSearch] = useState('');
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [isSavingVoice, setIsSavingVoice] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Fetch user's business profile when component mounts
  useEffect(() => {
    if (!userId) return; // Don't fetch if no userId
    
    const fetchBusinessData = async () => {
      try {
        const response = await fetch(`/api/business/${userId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.data?.logoUrl) {
            setBusinessLogo(data.data.logoUrl);
          }
          if (data.data?.businessName) {
            setBusinessName(data.data.businessName);
          }
        }
      } catch (error) {
        console.error("Error fetching business data:", error);
      }
    };

    fetchBusinessData();
  }, [userId]);

  // Load SkyIQ data
  useEffect(() => {
    if (!userId) return; // Don't load if no userId
    
    const loadSkyIQData = async () => {
      try {
        // Load AI agent prompt for specific user
        const promptResponse = await fetch(`/api/prompt/${userId}`);
        if (promptResponse.ok) {
          const promptData = await promptResponse.json();
          if (promptData.prompt) {
            setPromptText(promptData.prompt.system_prompt || '');
            setFirstMessage(promptData.prompt.first_message || '');
          }
        }
        
        // Load batches
        const batchResponse = await fetch('/api/batches');
        if (batchResponse.ok) {
          const batchData = await batchResponse.json();
          if (batchData.batches) {
            setBatches(batchData.batches);
          }
        }
        
        // Load saved prompts
        const savedPromptsResponse = await fetch(`/api/business/${userId}/saved-prompts`);
        if (savedPromptsResponse.ok) {
          const savedPromptsData = await savedPromptsResponse.json();
          setSavedPrompts(savedPromptsData.data || []);
        }
      } catch (error) {
        // Ignore errors for now since Supabase tables may not be ready
        console.log('SkyIQ data loading skipped:', error);
      }
    };
    
    loadSkyIQData();
  }, [userId]);

  // SkyIQ AI Voice Agent Functions
  const initiateCall = async () => {
    if (!phoneNumber.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a phone number',
        variant: 'destructive'
      });
      return;
    }

    setIsInitiatingCall(true);
    try {
      const response = await fetch('/api/calls/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone_number: phoneNumber,
          user_id: userId 
        })
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Call Initiated',
          description: `AI agent calling ${phoneNumber}...`
        });
        setPhoneNumber('');
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Call Failed',
        description: error.message || 'Failed to initiate call',
        variant: 'destructive'
      });
    } finally {
      setIsInitiatingCall(false);
    }
  };

  const updatePrompt = async () => {
    if (!promptText.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a system prompt',
        variant: 'destructive'
      });
      return;
    }

    if (!userId) {
      toast({
        title: 'Error',
        description: 'User not authenticated',
        variant: 'destructive'
      });
      return;
    }

    setIsUpdatingPrompt(true);
    try {
      const response = await fetch(`/api/prompt/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          system_prompt: promptText,
          first_message: firstMessage 
        })
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Agent Updated',
          description: 'Your AI voice agent has been configured successfully'
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update agent',
        variant: 'destructive'
      });
    } finally {
      setIsUpdatingPrompt(false);
    }
  };

  const savePrompt = async () => {
    if (!promptText.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a prompt to save',
        variant: 'destructive'
      });
      return;
    }

    if (!userId) {
      toast({
        title: 'Error',
        description: 'User not authenticated',
        variant: 'destructive'
      });
      return;
    }

    if (savedPrompts.length >= 3) {
      toast({
        title: 'Limit Reached',
        description: 'You can only save up to 3 prompts. Delete one to save a new prompt.',
        variant: 'destructive'
      });
      return;
    }

    setIsSavingPrompt(true);
    try {
      const response = await fetch(`/api/business/${userId}/saved-prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: promptText,
          firstMessage: firstMessage 
        })
      });

      const data = await response.json();
      if (response.ok) {
        setSavedPrompts(data.data);
        toast({
          title: 'Prompt Saved',
          description: `Saved as prompt ${data.data.length}/3`
        });
      } else {
        throw new Error(data.message);
      }
    } catch (error: any) {
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save prompt',
        variant: 'destructive'
      });
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const loadPrompt = (savedPrompt: {systemPrompt: string, firstMessage: string}) => {
    setPromptText(savedPrompt.systemPrompt);
    setFirstMessage(savedPrompt.firstMessage);
    toast({
      title: 'Prompt Loaded',
      description: 'The saved prompt and first message have been loaded'
    });
  };

  const deletePrompt = async (index: number) => {
    if (!userId) {
      toast({
        title: 'Error',
        description: 'User not authenticated',
        variant: 'destructive'
      });
      return;
    }

    try {
      const response = await fetch(`/api/business/${userId}/saved-prompts/${index}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (response.ok) {
        setSavedPrompts(data.data);
        toast({
          title: 'Prompt Deleted',
          description: 'The saved prompt has been removed'
        });
      } else {
        throw new Error(data.message);
      }
    } catch (error: any) {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete prompt',
        variant: 'destructive'
      });
    }
  };

  const uploadBatch = async () => {
    if (!selectedFile) {
      toast({
        title: 'Error',
        description: 'Please select a CSV file',
        variant: 'destructive'
      });
      return;
    }

    setIsUploadingBatch(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('name', batchName || `Batch ${new Date().toLocaleString()}`);

      const response = await fetch('/api/batch/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Batch Uploaded',
          description: `Processing ${data.calls} calls...`
        });
        setSelectedFile(null);
        setBatchName('');
        // Refresh batches
        const batchResponse = await fetch('/api/batches');
        if (batchResponse.ok) {
          const batchData = await batchResponse.json();
          if (batchData.batches) {
            setBatches(batchData.batches);
          }
        }
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload batch',
        variant: 'destructive'
      });
    } finally {
      setIsUploadingBatch(false);
    }
  };

  const fetchVoices = async () => {
    if (!userId) return;
    
    setIsLoadingVoices(true);
    try {
      const response = await fetch(`/api/elevenlabs/voices/${userId}`);
      const data = await response.json();
      
      if (data.success) {
        setVoices(data.voices || []);
        setSelectedVoiceId(data.currentVoiceId);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Failed to Load Voices',
        description: error.message || 'Could not fetch ElevenLabs voices',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingVoices(false);
    }
  };

  const saveVoice = async (voiceId: string) => {
    if (!userId) return;
    
    setIsSavingVoice(true);
    try {
      const response = await fetch(`/api/elevenlabs/voice/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId })
      });
      
      const data = await response.json();
      if (data.success) {
        setSelectedVoiceId(voiceId);
        toast({
          title: 'Voice Updated',
          description: 'Your AI agent voice has been updated successfully'
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update voice',
        variant: 'destructive'
      });
    } finally {
      setIsSavingVoice(false);
    }
  };

  const playVoicePreview = (voiceId: string, previewUrl: string) => {
    if (!previewUrl) {
      toast({
        title: 'No Preview Available',
        description: 'This voice does not have a preview available',
        variant: 'destructive'
      });
      return;
    }
    
    const audio = new Audio(previewUrl);
    setPlayingVoiceId(voiceId);
    audio.play();
    audio.onended = () => setPlayingVoiceId(null);
  };

  const handleLogout = () => {
    setLocation("/login");
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Shared Navigation */}
      <SharedNavigation 
        currentPath="/skyiq-agent"
        onLogout={handleLogout}
      />

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm px-6 py-4 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center">
            {businessLogo ? (
              <div className="h-8 w-8 rounded-md overflow-hidden mr-3 flex-shrink-0">
                <img 
                  src={businessLogo} 
                  alt={businessName || "Company Logo"} 
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="h-8 w-8 bg-primary rounded-md flex items-center justify-center text-white text-lg font-semibold mr-3">
                {businessName ? businessName[0] : 'A'}
              </div>
            )}
            <div>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                SkyIQ AI Voice Agent
              </h2>
              <p className="text-sm text-muted-foreground">AI-powered call automation</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon">
              <Bell className="h-5 w-5" />
            </Button>
            <UserAvatar size="sm" />
          </div>
        </header>

        {/* Main content */}
        <main className="px-6 py-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single">Preview</TabsTrigger>
              <TabsTrigger value="config">Configuration</TabsTrigger>
              {/* Batch Calls tab hidden - feature reserved for future inbound/outbound services */}
              {/* <TabsTrigger value="batch">Batch Calls</TabsTrigger> */}
            </TabsList>
            
            {/* Single Call Tab */}
            <TabsContent value="single" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mic className="h-5 w-5" />
                    Agent Preview
                  </CardTitle>
                  <CardDescription>Test your AI voice agent with a single call</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      placeholder="+1 (555) 123-4567"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      data-testid="input-phone"
                    />
                  </div>
                  <Button 
                    onClick={initiateCall} 
                    disabled={isInitiatingCall}
                    className="w-full"
                    data-testid="button-initiate-call"
                  >
                    {isInitiatingCall ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Initiating Call...
                      </>
                    ) : (
                      <>
                        <Phone className="w-4 h-4 mr-2" />
                        Test Agent
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Agent Configuration Tab */}
            <TabsContent value="config" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    Agent Configuration
                  </CardTitle>
                  <CardDescription>Customize your AI voice agent behavior</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Voice Selector Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-semibold">AI Voice</Label>
                        {selectedVoiceId && voices.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {voices.find(v => v.voice_id === selectedVoiceId)?.name || 'Select a voice'}
                          </p>
                        )}
                      </div>
                      <Button
                        onClick={fetchVoices}
                        disabled={isLoadingVoices}
                        variant={voices.length > 0 ? "ghost" : "default"}
                        size="sm"
                        data-testid="button-load-voices"
                      >
                        {isLoadingVoices ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-4 h-4 mr-2" />
                            {voices.length > 0 ? 'Refresh' : 'Browse Voices'}
                          </>
                        )}
                      </Button>
                    </div>
                    
                    {voices.length > 0 && (
                      <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                        <div className="p-3 bg-gray-50 dark:bg-gray-900 border-b">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Search by name, accent, or gender..."
                              value={voiceSearch}
                              onChange={(e) => setVoiceSearch(e.target.value)}
                              className="pl-9 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                              data-testid="input-voice-search"
                            />
                          </div>
                        </div>
                        
                        <div className="max-h-64 overflow-y-auto">
                          {voices
                            .filter(voice => 
                              voice.name?.toLowerCase().includes(voiceSearch.toLowerCase()) ||
                              voice.labels?.accent?.toLowerCase().includes(voiceSearch.toLowerCase()) ||
                              voice.labels?.gender?.toLowerCase().includes(voiceSearch.toLowerCase())
                            )
                            .slice(0, 50)
                            .map((voice, index) => (
                              <div
                                key={voice.voice_id}
                                className={`group flex items-center justify-between px-4 py-3 cursor-pointer transition-all border-b last:border-b-0 ${
                                  selectedVoiceId === voice.voice_id 
                                    ? 'bg-primary/5 border-l-4 border-l-primary' 
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-4 border-l-transparent'
                                }`}
                                onClick={() => saveVoice(voice.voice_id)}
                                data-testid={`voice-option-${voice.voice_id}`}
                              >
                                <div className="flex-1 min-w-0 mr-3">
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <p className={`text-sm font-medium truncate ${
                                      selectedVoiceId === voice.voice_id ? 'text-primary' : ''
                                    }`}>
                                      {voice.name}
                                    </p>
                                    {selectedVoiceId === voice.voice_id && (
                                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {voice.labels?.accent && (
                                      <Badge variant="secondary" className="text-xs font-normal px-2 py-0">
                                        {voice.labels.accent}
                                      </Badge>
                                    )}
                                    {voice.labels?.gender && (
                                      <Badge variant="secondary" className="text-xs font-normal px-2 py-0">
                                        {voice.labels.gender}
                                      </Badge>
                                    )}
                                    {voice.labels?.age && (
                                      <Badge variant="secondary" className="text-xs font-normal px-2 py-0">
                                        {voice.labels.age}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                
                                {voice.preview_url && (
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      playVoicePreview(voice.voice_id, voice.preview_url);
                                    }}
                                    variant="ghost"
                                    size="sm"
                                    className="flex-shrink-0 h-8 w-8 p-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                                    disabled={playingVoiceId === voice.voice_id}
                                    data-testid={`button-play-voice-${voice.voice_id}`}
                                  >
                                    {playingVoiceId === voice.voice_id ? (
                                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                    ) : (
                                      <Play className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            ))}
                        </div>
                        
                        {voiceSearch && voices.filter(voice => 
                          voice.name?.toLowerCase().includes(voiceSearch.toLowerCase()) ||
                          voice.labels?.accent?.toLowerCase().includes(voiceSearch.toLowerCase()) ||
                          voice.labels?.gender?.toLowerCase().includes(voiceSearch.toLowerCase())
                        ).length === 0 && (
                          <div className="text-center py-8 px-4">
                            <p className="text-sm text-muted-foreground">
                              No voices found matching "{voiceSearch}"
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Try searching with different keywords
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="first-message">First Message</Label>
                    <Textarea
                      id="first-message"
                      placeholder="Hello! This is Andy from SkyIQ. How can I help you today?"
                      value={firstMessage}
                      onChange={(e) => setFirstMessage(e.target.value)}
                      rows={2}
                      data-testid="textarea-first-message"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="system-prompt">System Prompt</Label>
                    <Textarea
                      id="system-prompt"
                      placeholder="You are Andy, a professional AI voice agent representing SkyIQ. You are knowledgeable, helpful, and friendly. Your goal is to assist customers and prospects with their inquiries about our services..."
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      rows={8}
                      data-testid="textarea-system-prompt"
                    />
                  </div>
                  <Button 
                    onClick={updatePrompt} 
                    disabled={isUpdatingPrompt}
                    className="w-full"
                    data-testid="button-update-prompt"
                  >
                    {isUpdatingPrompt ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Settings className="w-4 h-4 mr-2" />
                        Update Agent
                      </>
                    )}
                  </Button>
                  
                  <div className="mt-6 pt-6 border-t">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Saved Prompts
                      </h3>
                      <Button
                        onClick={savePrompt}
                        disabled={isSavingPrompt || savedPrompts.length >= 3}
                        variant="outline"
                        size="sm"
                        data-testid="button-save-prompt"
                      >
                        {isSavingPrompt ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-3 h-3 mr-1" />
                            Save Prompt
                          </>
                        )}
                      </Button>
                    </div>
                    
                    {savedPrompts.length === 0 ? (
                      <div className="text-center py-6 text-sm text-muted-foreground">
                        No saved prompts yet. Save your current prompt to reuse it later (max 3).
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {savedPrompts.map((savedPrompt, index) => (
                          <div
                            key={index}
                            className="flex items-start gap-2 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            data-testid={`saved-prompt-${index}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="secondary" className="text-xs">
                                  {index + 1}/3
                                </Badge>
                              </div>
                              {savedPrompt.firstMessage && (
                                <p className="text-xs text-muted-foreground mb-1">
                                  <strong>First Message:</strong> {savedPrompt.firstMessage.substring(0, 60)}{savedPrompt.firstMessage.length > 60 ? '...' : ''}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                <strong>System Prompt:</strong> {savedPrompt.systemPrompt.substring(0, 80)}{savedPrompt.systemPrompt.length > 80 ? '...' : ''}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                onClick={() => loadPrompt(savedPrompt)}
                                variant="ghost"
                                size="sm"
                                data-testid={`button-load-prompt-${index}`}
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                              <Button
                                onClick={() => deletePrompt(index)}
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                data-testid={`button-delete-prompt-${index}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Batch Calls Tab - Hidden for now, reserved for future inbound/outbound services */}
            {/* Keeping all batch functionality intact for when we add inbound/outbound distinction */}
            <TabsContent value="batch" className="space-y-4" style={{ display: 'none' }}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Upload Batch */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="h-5 w-5" />
                      Upload Batch
                    </CardTitle>
                    <CardDescription>Upload a CSV file to make multiple AI calls</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="batch-name">Batch Name (Optional)</Label>
                      <Input
                        id="batch-name"
                        placeholder="Enter batch name"
                        value={batchName}
                        onChange={(e) => setBatchName(e.target.value)}
                        data-testid="input-batch-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="csv-file">CSV File</Label>
                      <Input
                        id="csv-file"
                        type="file"
                        accept=".csv"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        data-testid="input-csv-file"
                      />
                      <p className="text-xs text-muted-foreground">
                        CSV should include columns: phone, first_name, last_name, company
                      </p>
                    </div>
                    <Button 
                      onClick={uploadBatch} 
                      disabled={isUploadingBatch || !selectedFile}
                      className="w-full"
                      data-testid="button-upload-batch"
                    >
                      {isUploadingBatch ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Batch
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
                
                {/* Batch Status */}
                <Card>
                  <CardHeader>
                    <CardTitle>Batch Status</CardTitle>
                    <CardDescription>Monitor batch call progress</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {batches.map((batch) => (
                        <div key={batch.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="font-medium">{batch.name}</p>
                            <Badge 
                              variant={batch.status === 'completed' ? 'default' : 
                                      batch.status === 'processing' ? 'secondary' : 'outline'}
                            >
                              {batch.status}
                            </Badge>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>Progress</span>
                              <span>{batch.completed_calls || 0}/{batch.total_calls || 0}</span>
                            </div>
                            <Progress 
                              value={batch.total_calls > 0 ? (batch.completed_calls / batch.total_calls) * 100 : 0} 
                              className="h-2" 
                            />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>✅ {batch.successful_calls || 0} successful</span>
                            <span>❌ {batch.failed_calls || 0} failed</span>
                          </div>
                        </div>
                      ))}
                      {batches.length === 0 && (
                        <div className="text-center py-4 text-muted-foreground">
                          No batches uploaded yet.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
