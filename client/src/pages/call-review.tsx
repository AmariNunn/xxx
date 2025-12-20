import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { 
  Phone, 
  Download, 
  ArrowRightFromLine, 
  Bell, 
  Settings, 
  LogOut,
  Home,
  Building,
  FileText,
  Volume2,
  Clock,
  Bot,
  PhoneOutgoing,
  MessageSquare,
  Send,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Zap,
  BrainCircuit,
  FileDown,
  PhoneMissed,
  AlertCircle,
  TrendingUp,
  PhoneCall,
  ListChecks,
  BarChart3,
  CheckCircle
} from "lucide-react";
import AudioWave from "@/components/audio-wave";
import SkyIQText from "@/components/skyiq-text";
import UserAvatar from "@/components/user-avatar";
import skyiqLogoWhite from "@assets/skyiq-logo_(1)_(1)_1766139617558.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function CallReview() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [businessLogo, setBusinessLogo] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [lastMatchingCallIds, setLastMatchingCallIds] = useState<number[]>([]);

  const userId = user?.id;

  // Fetch calls data
  const { data: callsData, isLoading } = useQuery({
    queryKey: [`/api/calls/user/${userId}`],
    enabled: !!userId,
  });

  // Fetch business info for branding
  useEffect(() => {
    const fetchBusinessData = async () => {
      try {
        const response = await fetch(`/api/business/${userId}`);
        if (response.ok) {
          const data = await response.json();
          setBusinessLogo(data.data?.logoUrl || null);
          setBusinessName(data.data?.businessName || "");
        }
      } catch (error) {
        console.error("Error fetching business data:", error);
      }
    };

    if (userId) {
      fetchBusinessData();
    }
  }, [userId]);

  const calls = (callsData as any)?.data || [];
  
  // Get accurate total count from API (accounts for Supabase pagination)
  const apiTotalCount = (callsData as any)?.totalCount;

  // Calculate analytics - use API total count if available
  const totalCalls = apiTotalCount ?? calls.length;
  const completedCalls = calls.filter((call: any) => call.status === 'completed').length;
  const missedCalls = calls.filter((call: any) => call.status === 'missed').length;
  const failedCalls = calls.filter((call: any) => call.status === 'failed').length;
  
  const callsWithDuration = calls.filter((call: any) => call.duration);
  const totalDuration = callsWithDuration.reduce((sum: number, call: any) => {
    return sum + (call.duration || 0);
  }, 0);
  const avgDuration = callsWithDuration.length > 0 ? Math.round(totalDuration / callsWithDuration.length) : 0;

  // Get user's timezone for accurate time-based queries
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Chat with data mutation
  const chatMutation = useMutation({
    mutationFn: async (question: string) => {
      const response = await apiRequest('POST', '/api/calls/chat', { 
        question, 
        timezone: userTimezone 
      });
      return response.json();
    },
    onSuccess: (data) => {
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      // Store matching call IDs for AI-enhanced PDF generation
      if (data.matchingCallIds && Array.isArray(data.matchingCallIds)) {
        setLastMatchingCallIds(data.matchingCallIds);
        console.log(`📊 Received ${data.matchingCallIds.length} matching call IDs for AI report`);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to analyze call data",
        variant: "destructive"
      });
      setChatMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I encountered an error analyzing your data. Please try again." }]);
    }
  });

  const handleSendMessage = () => {
    if (!chatInput.trim() || chatMutation.isPending) return;
    
    const question = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: question }]);
    setChatInput("");
    chatMutation.mutate(question);
  };

  // PDF generation state
  const [pdfGenerating, setPdfGenerating] = useState(false);

  // Generate general PDF report (without AI analysis)
  const handleDownloadGeneralPDF = async () => {
    setPdfGenerating(true);
    try {
      const response = await fetch('/api/calls/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ includeTranscripts: true })
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `call-report-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "PDF Generated",
        description: "Your call report has been downloaded with full transcripts.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate PDF report",
        variant: "destructive"
      });
    } finally {
      setPdfGenerating(false);
    }
  };

  // Generate AI-enhanced PDF report (with AI analysis from chat)
  const handleDownloadAIPDF = async () => {
    // Find the last AI response and its corresponding question
    const lastAssistantIndex = chatMessages.findLastIndex(msg => msg.role === 'assistant');
    if (lastAssistantIndex === -1 || lastAssistantIndex === 0) {
      toast({
        title: "No AI Analysis",
        description: "Ask a question first to get an AI-enhanced report.",
        variant: "destructive"
      });
      return;
    }

    const question = chatMessages[lastAssistantIndex - 1]?.content || '';
    const aiResponse = chatMessages[lastAssistantIndex]?.content || '';

    setPdfGenerating(true);
    try {
      // Pass matching call IDs so PDF only includes matching calls with their transcripts
      const response = await fetch('/api/calls/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          question, 
          aiResponse, 
          includeTranscripts: true,
          matchingCallIds: lastMatchingCallIds
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-call-report-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "AI-Enhanced PDF Generated",
        description: "Your AI-enhanced call report has been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate PDF report",
        variant: "destructive"
      });
    } finally {
      setPdfGenerating(false);
    }
  };

  // Generate dynamic quick insights based on user's actual call data
  const dynamicQuestions = useMemo(() => {
    const questions: { icon: string; text: string }[] = [];
    
    // Always include general overview
    questions.push({ icon: "overview", text: "Give me a summary of my recent calls" });
    
    // Add status-based questions
    if (missedCalls > 0) {
      questions.push({ icon: "missed", text: `Show me the ${missedCalls} missed calls and why they failed` });
    }
    if (failedCalls > 0) {
      questions.push({ icon: "failed", text: `What went wrong with the ${failedCalls} failed calls?` });
    }
    
    // Add duration-based questions if there are calls with duration
    const longCalls = calls.filter((c: any) => c.duration > 300).length;
    if (longCalls > 0) {
      questions.push({ icon: "duration", text: `Summarize the ${longCalls} calls over 5 minutes` });
    }
    
    // Add callback/follow-up question
    questions.push({ icon: "callback", text: "Who requested a callback or follow-up?" });
    
    // Add topic analysis
    questions.push({ icon: "topics", text: "What are the main topics discussed in calls?" });
    
    // Add sentiment/outcome question
    if (completedCalls > 0) {
      questions.push({ icon: "outcome", text: "Which calls had positive outcomes?" });
    }
    
    // Limit to 5 most relevant
    return questions.slice(0, 5);
  }, [calls, missedCalls, failedCalls, completedCalls]);

  // Format transcript helper function
  const formatTranscript = (transcript: string) => {
    if (!transcript) return [];
    
    try {
      const parsed = JSON.parse(transcript);
      if (Array.isArray(parsed)) {
        return parsed.map((entry: any, index: number) => ({
          id: index,
          speaker: entry.role === 'agent' ? 'Agent' : 'Customer',
          message: entry.message || entry.content || ''
        }));
      }
    } catch {
      const lines = transcript.split('\n').filter(line => line.trim());
      const formatted = [];
      
      for (const line of lines) {
        if (line.match(/^(Agent|Customer|AI|User):/i)) {
          const [speaker, ...messageParts] = line.split(':');
          formatted.push({
            id: formatted.length,
            speaker: speaker.trim().replace(/^(AI|User)$/i, m => m.toLowerCase() === 'ai' ? 'Agent' : 'Customer'),
            message: messageParts.join(':').trim()
          });
        } else {
          formatted.push({
            id: formatted.length,
            speaker: 'Agent',
            message: line.trim()
          });
        }
      }
      
      return formatted;
    }
    
    return [];
  };

  // Generate transcript download
  const downloadTranscript = (call: any) => {
    const formattedTranscript = formatTranscript(call.transcript);
    const transcriptText = formattedTranscript.length > 0
      ? formattedTranscript.map(entry => `${entry.speaker}: ${entry.message}`).join('\n')
      : 'No transcript available';

    const transcript = `CALL TRANSCRIPT
Business: ${businessName}
Contact: ${call.contactName || call.phoneNumber}
Date: ${call.createdAt ? new Date(call.createdAt).toLocaleDateString() : 'N/A'}
Duration: ${call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : 'N/A'}
Status: ${call.status?.toUpperCase() || 'UNKNOWN'}

SUMMARY:
${call.summary || 'No summary available'}

NOTES:
${call.notes || 'No notes recorded'}

FULL TRANSCRIPT:
${transcriptText}

---
Generated: ${new Date().toLocaleString()}
Source: ${call.isFromTwilio ? 'Automated Call' : 'Manual Entry'}`;

    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${call.contactName || call.phoneNumber}-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Transcript Downloaded",
      description: `Transcript for ${call.contactName || call.phoneNumber} saved to downloads.`,
    });
  };

  // Download call recording audio
  const downloadAudio = (call: any) => {
    if (!call.recordingUrl) {
      toast({
        title: "No Recording Available",
        description: "This call does not have an audio recording.",
        variant: "destructive"
      });
      return;
    }

    const dateStr = call.createdAt 
      ? new Date(call.createdAt).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const a = document.createElement('a');
    a.href = call.recordingUrl;
    a.download = `call-recording-${call.contactName || call.phoneNumber}-${dateStr}.mp3`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    toast({
      title: "Downloading Audio",
      description: `Recording for ${call.contactName || call.phoneNumber} is downloading.`,
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading call data...</div>;
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-lg transform ${
          isMobile ? (isSidebarOpen ? "translate-x-0" : "-translate-x-full") : "translate-x-0"
        } transition-transform duration-300 ease-in-out md:relative md:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          <div className="px-4 py-6 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-2xl font-bold text-primary flex items-center gap-3">
              <Phone className="h-6 w-6" />
              <SkyIQText />
              <AudioWave size="sm" className="text-blue-600" />
            </h1>
          </div>

          <nav className="flex-1 px-2 py-4 space-y-1">
            <Button
              variant="ghost"
              className="w-full justify-start text-left font-normal hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => setLocation('/dashboard')}
            >
              <Home className="mr-3 h-5 w-5" />
              Home
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-left font-normal hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => setLocation('/call-dashboard')}
            >
              <Phone className="mr-3 h-5 w-5" />
              Call Dashboard
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start text-left font-normal"
            >
              <FileText className="mr-3 h-5 w-5" />
              Call Review
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-left font-normal hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => setLocation('/skyiq-agent')}
            >
              <Bot className="mr-3 h-5 w-5" />
              SkyIQ AI Agent
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-left font-normal hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => setLocation('/bulk-caller')}
            >
              <PhoneOutgoing className="mr-3 h-5 w-5" />
              Bulk Caller
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-left font-normal hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => setLocation('/business-profile')}
            >
              <Building className="mr-3 h-5 w-5" />
              Business Profile
            </Button>
          </nav>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="ghost"
              className="w-full justify-start text-left font-normal hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Log Out
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center">
            {businessLogo ? (
              <div className="h-8 w-8 mr-3 rounded-md overflow-hidden">
                <img
                  src={businessLogo}
                  alt="Business Logo"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="h-8 w-8 bg-primary rounded-md flex items-center justify-center text-white text-lg font-semibold mr-3">
                {businessName ? businessName[0] : 'C'}
              </div>
            )}
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
              Call Review & Analytics
            </h2>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <Button 
              onClick={handleDownloadGeneralPDF}
              disabled={pdfGenerating}
              variant="outline"
              data-testid="button-download-general-pdf"
            >
              {pdfGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
              Download Report
            </Button>
            <Button 
              onClick={handleDownloadAIPDF}
              disabled={pdfGenerating || chatMessages.filter(m => m.role === 'assistant').length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-download-ai-pdf"
            >
              {pdfGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BrainCircuit className="mr-2 h-4 w-4" />}
              AI-Enhanced Report
            </Button>
            <UserAvatar size="sm" />
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-auto px-6 py-8">
          {/* Analytics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Phone className="h-8 w-8" style={{ color: '#009AEE' }} />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Calls</p>
                    <p className="text-2xl font-bold">{totalCalls}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <CheckCircle className="h-8 w-8" style={{ color: '#009AEE' }} />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Success Rate</p>
                    <p className="text-2xl font-bold">{totalCalls > 0 ? Math.round(completedCalls/totalCalls * 100) : 0}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Clock className="h-8 w-8" style={{ color: '#009AEE' }} />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Avg Duration</p>
                    <p className="text-2xl font-bold">{Math.floor(avgDuration / 60)}m {avgDuration % 60}s</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <PhoneMissed className="h-8 w-8" style={{ color: '#009AEE' }} />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Missed Calls</p>
                    <p className="text-2xl font-bold">{missedCalls}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Analytics Chat - Inline Card */}
          <Card className="overflow-hidden border-0 shadow-md">
            <div 
              className="bg-gradient-to-r from-blue-600 via-blue-500 to-sky-500 p-4 cursor-pointer animate-subtle-bounce"
              onClick={() => setChatOpen(!chatOpen)}
              data-testid="button-toggle-ai-chat"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img 
                    src={skyiqLogoWhite} 
                    alt="SkyIQ" 
                    className="h-10 w-10 object-contain"
                  />
                  <div>
                    <h3 className="font-semibold text-white flex items-center gap-2">
                      SkyIQ Call Analytics
                    </h3>
                    <p className="text-sm text-blue-100">Ask questions about your call data in natural language</p>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-white hover:bg-white/20"
                >
                  <MessageSquare className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {chatOpen && (
              <CardContent className="p-0">
                <div className="grid md:grid-cols-2">
                  {/* Quick Insights Section - Symmetrical with Chat */}
                  <div className="flex flex-col h-80 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700">
                    {/* Header */}
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Quick Insights</span>
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {dynamicQuestions.length} suggestions
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Scrollable Questions */}
                    <div className="flex-1 overflow-auto p-3 space-y-2">
                      {dynamicQuestions.map((q, i) => {
                        const getIcon = (iconType: string) => {
                          switch (iconType) {
                            case "overview": return <BarChart3 className="h-4 w-4 text-blue-500 shrink-0" />;
                            case "missed": return <PhoneMissed className="h-4 w-4 text-red-500 shrink-0" />;
                            case "failed": return <AlertCircle className="h-4 w-4 text-orange-500 shrink-0" />;
                            case "duration": return <Clock className="h-4 w-4 text-purple-500 shrink-0" />;
                            case "callback": return <PhoneCall className="h-4 w-4 text-green-500 shrink-0" />;
                            case "topics": return <ListChecks className="h-4 w-4 text-indigo-500 shrink-0" />;
                            case "outcome": return <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0" />;
                            default: return <Sparkles className="h-4 w-4 text-blue-500 shrink-0" />;
                          }
                        };
                        
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              setChatMessages([{ role: 'user', content: q.text }]);
                              chatMutation.mutate(q.text);
                            }}
                            disabled={chatMutation.isPending}
                            className="w-full text-left text-sm p-3 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm transition-all disabled:opacity-50"
                            data-testid={`button-example-question-${i}`}
                          >
                            <div className="flex items-center gap-3">
                              {getIcon(q.icon)}
                              <span className="text-gray-700 dark:text-gray-300">{q.text}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Chat Section - Symmetrical with Quick Insights */}
                  <div className="flex flex-col h-80">
                    {/* Header */}
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">AI Chat</span>
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {totalCalls} calls analyzed
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Chat Messages */}
                    <div className="flex-1 overflow-auto p-3 space-y-3">
                      {chatMessages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center p-4">
                          <img 
                            src={skyiqLogoWhite} 
                            alt="SkyIQ" 
                            className="h-10 w-10 object-contain mb-2 bg-blue-500 rounded-full p-1"
                          />
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Select a quick insight or ask your own question
                          </p>
                        </div>
                      )}

                      {chatMessages.map((msg, i) => (
                        <div
                          key={i}
                          className={`p-3 rounded-lg ${
                            msg.role === 'user'
                              ? 'bg-blue-600 text-white ml-6'
                              : 'bg-gray-100 dark:bg-gray-700 mr-6'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      ))}

                      {chatMutation.isPending && (
                        <div className="flex items-center gap-2 text-blue-600 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Analyzing calls...</span>
                        </div>
                      )}
                    </div>

                    {/* Input Area */}
                    <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <div className="flex gap-2">
                        <Textarea
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="Ask anything about your calls..."
                          className="resize-none min-h-[44px] bg-white dark:bg-gray-700"
                          rows={1}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          data-testid="input-chat-question"
                        />
                        <Button
                          onClick={handleSendMessage}
                          disabled={!chatInput.trim() || chatMutation.isPending}
                          className="bg-blue-600 hover:bg-blue-700"
                          data-testid="button-send-chat"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Call Details */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Call Log</CardTitle>
              <CardDescription>
                Complete call history with playback and transcript downloads
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {calls.map((call: any) => (
                  <div key={call.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Phone className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold">{call.contactName || call.caller_number || call.phone_number || call.phoneNumber || 'Unknown'}</h4>
                          <p className="text-sm text-gray-600">
                            {call.caller_number || call.phone_number || call.phoneNumber || 'Unknown'} • 
                            {call.duration ? ` ${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : ' N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={call.status === 'completed' ? 'default' : call.status === 'missed' ? 'destructive' : 'secondary'}>
                          {call.status?.toUpperCase() || 'UNKNOWN'}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadTranscript(call)}
                        >
                          <Download className="mr-1 h-3 w-3" />
                          Transcript
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <span className="font-medium">Summary: </span>
                        <span className="text-gray-700 dark:text-gray-300">
                          {call.summary || 'No summary available'}
                        </span>
                      </div>
                      {call.notes && (
                        <div>
                          <span className="font-medium">Notes: </span>
                          <span className="text-gray-700 dark:text-gray-300">{call.notes}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        {call.isFromTwilio ? (
                          <><Volume2 className="h-3 w-3" /> AI Agent Call</>
                        ) : (
                          <>✍️ Manual entry</>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}