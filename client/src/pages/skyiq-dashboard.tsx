import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { PhoneCall, Upload, Settings, BarChart3, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function SkyIQDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('calls');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [isUpdatingPrompt, setIsUpdatingPrompt] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    // Simulate loading
    setTimeout(() => setIsLoading(false), 1000);
  }, []);

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
        body: JSON.stringify({ phone_number: phoneNumber })
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Call Initiated',
          description: `Calling ${phoneNumber}...`
        });
        setPhoneNumber('');
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Call Failed',
        description: error.message,
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

    setIsUpdatingPrompt(true);
    try {
      const response = await fetch('/api/prompt', {
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
          title: 'Prompt Updated',
          description: 'AI agent prompt has been updated successfully'
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsUpdatingPrompt(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">SkyIQ Dashboard</h1>
            <p className="text-muted-foreground">AI Voice Agent Management Platform</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              ElevenLabs Connected
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Supabase Connected
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
              <PhoneCall className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Batches</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0s</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="calls">Call History</TabsTrigger>
            <TabsTrigger value="single-call">Make Call</TabsTrigger>
            <TabsTrigger value="batch">Batch Calls</TabsTrigger>
            <TabsTrigger value="settings">Agent Settings</TabsTrigger>
          </TabsList>

          {/* Call History Tab */}
          <TabsContent value="calls" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Calls</CardTitle>
                <CardDescription>View and monitor all voice agent calls</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  No calls yet. Initiate your first call or upload a batch.
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Single Call Tab */}
          <TabsContent value="single-call" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Initiate Single Call</CardTitle>
                <CardDescription>Make a one-time call to a specific number</CardDescription>
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
                      <PhoneCall className="w-4 h-4 mr-2" />
                      Initiate Call
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Batch Calls Tab */}
          <TabsContent value="batch" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Upload Batch</CardTitle>
                <CardDescription>Upload a CSV file to make multiple calls</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Batch calling functionality will be available once the database schema is fully synced.
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Agent Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AI Agent Configuration</CardTitle>
                <CardDescription>Customize your AI voice agent's behavior and responses</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                    placeholder="You are Andy, a professional AI voice agent for SkyIQ..."
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    rows={12}
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}