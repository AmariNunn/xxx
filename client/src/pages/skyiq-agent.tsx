import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { 
  Phone,
  Bell, 
  Settings,
  Loader2,
  Mic,
  Bot
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
        <header className="bg-white dark:bg-gray-800 shadow-sm px-4 md:px-6 py-4 flex flex-col md:flex-row md:justify-between md:items-center gap-4 sticky top-0 z-10">
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
              <h2 className="text-lg md:text-xl font-semibold text-gray-800 dark:text-white">
                SkyIQ AI Voice Agent
              </h2>
              <p className="text-sm text-muted-foreground hidden md:block">AI-powered call automation</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="h-9 w-9">
              <Bell className="h-4 w-4" />
            </Button>
            <UserAvatar size="sm" />
          </div>
        </header>

        {/* Main content */}
        <main className="px-4 md:px-6 py-6 md:py-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 md:space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single" className="text-sm md:text-base">Preview</TabsTrigger>
              <TabsTrigger value="config" className="text-sm md:text-base">Configuration</TabsTrigger>
            </TabsList>
            
            {/* Single Call Tab */}
            <TabsContent value="single" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                    <Mic className="h-5 w-5" />
                    Agent Preview
                  </CardTitle>
                  <CardDescription className="text-sm">Validate agent configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm md:text-base">Phone Number</Label>
                    <Input
                      id="phone"
                      placeholder="+1 (555) 123-4567"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      data-testid="input-phone"
                      className="text-base"
                    />
                  </div>
                  <Button 
                    onClick={initiateCall} 
                    disabled={isInitiatingCall}
                    className="w-full h-11 text-base"
                    data-testid="button-initiate-call"
                  >
                    {isInitiatingCall ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
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
                  <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                    <Bot className="h-5 w-5" />
                    Agent Configuration
                  </CardTitle>
                  <CardDescription className="text-sm">Customize your AI voice agent behavior</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="first-message" className="text-sm md:text-base">First Message</Label>
                    <Textarea
                      id="first-message"
                      placeholder="Hello! This is Andy from SkyIQ. How can I help you today?"
                      value={firstMessage}
                      onChange={(e) => setFirstMessage(e.target.value)}
                      rows={2}
                      data-testid="textarea-first-message"
                      className="text-base resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="system-prompt" className="text-sm md:text-base">System Prompt</Label>
                    <Textarea
                      id="system-prompt"
                      placeholder="You are Andy, a professional AI voice agent representing SkyIQ. You are knowledgeable, helpful, and friendly. Your goal is to assist customers and prospects with their inquiries about our services..."
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      rows={6}
                      data-testid="textarea-system-prompt"
                      className="text-base resize-none"
                    />
                  </div>
                  <Button 
                    onClick={updatePrompt} 
                    disabled={isUpdatingPrompt}
                    className="w-full h-11 text-base"
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
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
