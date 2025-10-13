import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { io } from 'socket.io-client'; // Import Socket.IO client
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "wouter";
import { 
  Phone, 
  ArrowRightFromLine, 
  Bell, 
  Settings, 
  LogOut,
  Search,
  ArrowUpDown,
  ChevronDown,
  BookmarkCheck,
  AlertTriangle,
  Users,
  Info,
  Home,
  Building,
  FileText,
  Bot
} from "lucide-react";
import AudioWave from "@/components/audio-wave";
import SkyIQText from "@/components/skyiq-text";
import UserAvatar from "@/components/user-avatar";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

// Placeholder call data - in a real app, this would come from the API
const placeholderCalls = [
  { 
    id: 1, 
    date: "2023-10-01", 
    time: "09:30 AM", 
    number: "+1 (555) 123-4567", 
    name: "John Smith",
    duration: "2m 45s", 
    status: "completed",
    summary: "Hot lead! Customer needs enterprise solution for 50+ employees. Budget confirmed at $5K/month. Decision maker identified as CEO. Ready to move forward this quarter.",
    notes: "HIGH PRIORITY: Send proposal by Thursday. Mentioned competitor pricing 20% higher. Strong buying signals detected.",
    flagged: true,
    action: "follow-up"
  },
  { 
    id: 2, 
    date: "2023-10-02", 
    time: "11:15 AM", 
    number: "+1 (555) 987-6543", 
    name: "Sarah Johnson",
    duration: "5m 12s", 
    status: "completed",
    summary: "Customer retention success! Resolved billing concern and upgraded to premium plan. Customer satisfaction increased from frustrated to delighted. Upsell opportunity captured.",
    notes: "Account value increased by $200/month. Customer mentioned referring 3 colleagues. Excellent relationship recovery.",
    flagged: false,
    action: "none"
  },
  { 
    id: 3, 
    date: "2023-10-03", 
    time: "02:45 PM", 
    number: "+1 (555) 444-3333", 
    name: "Unknown",
    duration: "1m 50s", 
    status: "missed",
    summary: "Missed opportunity detected! Caller hung up after 1m 50s - indicates genuine interest. No voicemail left suggests urgency or privacy concerns.",
    notes: "CALLBACK PRIORITY: Timing suggests business call. Research number before callback. Potential high-value prospect.",
    flagged: true,
    action: "call-back"
  },
  { 
    id: 4, 
    date: "2023-10-04", 
    time: "04:20 PM", 
    number: "+1 (555) 222-1111", 
    name: "Michael Brown",
    duration: "3m 33s", 
    status: "completed",
    summary: "Churn prevention win! Customer was leaving due to competitor offer. Applied strategic 20% retention discount. Customer expressed renewed confidence in our service and committed to 12-month extension.",
    notes: "Account saved: $2,400 annual value. Customer appreciates personalized attention. Monitor satisfaction closely.",
    flagged: true,
    action: "discount"
  },
  { 
    id: 5, 
    date: "2023-10-05", 
    time: "10:05 AM", 
    number: "+1 (555) 888-9999", 
    name: "Jennifer Williams",
    duration: "4m 15s", 
    status: "completed",
    summary: "Support excellence achieved! Quickly resolved login issue and discovered customer had been manually workaround for weeks. Provided comprehensive training on advanced features, increasing product adoption by 300%.",
    notes: "Customer delighted with proactive help. Mentioned considering upgrade to professional tier. Strong relationship built.",
    flagged: false,
    action: "none"
  },
  { 
    id: 6, 
    date: "2023-10-05", 
    time: "01:30 PM", 
    number: "+1 (555) 777-6666", 
    name: "Robert Davis",
    duration: "6m 20s", 
    status: "completed",
    summary: "New customer inquiry about features. Explained premium features and sent follow-up email with documentation.",
    notes: "Potential conversion to premium plan",
    flagged: true,
    action: "follow-up"
  },
  { 
    id: 7, 
    date: "2023-10-06", 
    time: "09:15 AM", 
    number: "+1 (555) 333-2222", 
    name: "Lisa Miller",
    duration: "2m 10s", 
    status: "completed",
    summary: "Customer called to confirm appointment. Appointment confirmed for Oct 12 at 2 PM.",
    notes: "",
    flagged: false,
    action: "none"
  },
  { 
    id: 8, 
    date: "2023-10-06", 
    time: "03:45 PM", 
    number: "+1 (555) 111-0000", 
    name: "Unknown",
    duration: "0m 30s", 
    status: "failed",
    summary: "Call dropped due to poor connection.",
    notes: "Try calling back",
    flagged: true,
    action: "call-back"
  }
];

export default function CallDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  
  // Get current user ID from localStorage (UUID format)
  const userId = localStorage.getItem('userId');
  
  // If no valid userId, don't make API calls that will 404
  if (!userId) {
    console.warn("No userId found in localStorage");
  }
  
  // Load business profile data to get the logo
  const [businessLogo, setBusinessLogo] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>("");

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
  
  const queryClient = useQueryClient(); // Get query client instance
  // Use React Query to manage calls data with proper caching and refresh
  const { data: callsData, isLoading, refetch } = useQuery({
    queryKey: ['/api/calls/user', userId],
    enabled: !!userId, // Only run query if userId exists
    queryFn: async () => {
      if (!userId) {
        throw new Error("No user ID available");
      }
      const response = await apiRequest('GET', `/api/calls/user/${userId}`);
      const data = await response.json();
      
      // Transform database calls to dashboard format
      if (data.data?.length > 0) {
        return data.data.map((call: any) => {
          const callDate = new Date(call.created_at);
          const durationSeconds = call.duration || 0;
          
          // Format date and time using local timezone
          const localDate = callDate.toLocaleDateString(undefined, {
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
          });
          const localTime = callDate.toLocaleTimeString(undefined, {
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
          });
          
          return {
            id: call.id,
            // Keep raw created_at for accurate sorting and display
            created_at: call.created_at,
            date: localDate, // Use local date format
            time: localTime, // Use local time format
            number: call.caller_number || call.phone_number || 'Unknown',
            name: call.contact_name || "Unknown",
            // Keep numeric duration for sorting, plus display string
            durationSeconds: durationSeconds,
            duration: durationSeconds > 0 ? 
              `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s` : 
              '0m 0s',
            // Map database status to UI filter values (completed, missed, failed)
            status: call.status === 'completed' ? 'completed' :
                    call.status === 'failed' ? 'failed' :
                    call.status === 'initiated' || call.status === 'missed' ? 'missed' :
                    call.status === 'in-progress' ? 'completed' :
                    call.status || 'completed',
            // Add transcript for display
            transcript: call.transcript || '',
            summary: call.summary || `${call.call_type === 'outbound' ? 'Outbound' : 'Inbound'} call ${call.status} via ElevenLabs AI agent. ${call.conversation_id ? `Conversation ID: ${call.conversation_id}` : ''}`,
            notes: call.notes || `Call ${call.call_type} - ${call.caller_number} → ${call.called_number}`,
            flagged: call.status === 'initiated' || call.status === 'missed',
            action: call.action || 'none',
            // Keep original database fields for reference
            elevenlabs_call_id: call.elevenlabs_call_id,
            conversation_id: call.conversation_id,
            call_type: call.call_type,
            original_status: call.status // Keep original status for debugging
          };
        });
      }
      
      // Return empty array if no calls found
      return [];
    },
    refetchOnWindowFocus: false, // Temporarily disable to prioritize refetchInterval
    staleTime: 0, // Consider data stale immediately
    gcTime: 0,     // Disable caching to always fetch fresh data
  });

  // Socket.IO connection status
  const [socketConnected, setSocketConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Socket.IO setup for real-time updates with robust reconnection
  useEffect(() => {
    if (!userId) return; // Don't connect without userId
    
    const SERVER_URL = import.meta.env.VITE_API_URL || window.location.origin;
    
    const socket = io(SERVER_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
    });

    socket.on('connect', () => {
      console.log('✅ Connected to Socket.IO server');
      setSocketConnected(true);
      setReconnectAttempts(0);
      
      // Join user-specific room for isolated updates
      socket.emit('joinRoom', `user:${userId}`);
      console.log(`🔐 Joined room: user:${userId}`);
      
      // Refresh data on reconnect to catch any missed updates
      queryClient.invalidateQueries({ queryKey: ['/api/calls/user', userId] });
    });

    socket.on('callCompleted', (completedCall) => {
      console.log('✅ Received callCompleted event:', completedCall);
      console.log('🔄 Refreshing call data for user:', userId);
      
      // Invalidate and refetch the calls data
      queryClient.invalidateQueries({ queryKey: ['/api/calls/user', userId] });
      
      // Show a toast notification for completed calls
      toast({
        title: "Call Completed",
        description: `Call completed and transcript is now available.`,
      });
    });

    socket.on('transcriptUpdate', (data) => {
      console.log('📝 Received transcriptUpdate event:', data);
      // Refresh calls to get updated transcript
      queryClient.invalidateQueries({ queryKey: ['/api/calls/user', userId] });
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from Socket.IO server:', reason);
      setSocketConnected(false);
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}`);
      setReconnectAttempts(attemptNumber);
    });

    socket.on('reconnect_failed', () => {
      console.error('❌ Socket.IO reconnection failed');
      toast({
        title: "Connection Lost",
        description: "Unable to reconnect. Please refresh the page.",
        variant: "destructive",
      });
    });

    // Clean up on component unmount
    return () => {
      socket.disconnect();
    };
  }, [userId, queryClient, toast]);
  
  // Derived state
  const calls = callsData || [];
  const [filteredCalls, setFilteredCalls] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "duration" | "status">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  
  // State for call detail dialog
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [callNotes, setCallNotes] = useState("");

  // Apply filters and sorting
  useEffect(() => {
    let result = [...calls];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(call => 
        call.number.toLowerCase().includes(query) || 
        (call.name && call.name.toLowerCase().includes(query)) ||
        call.summary.toLowerCase().includes(query)
      );
    }
    
    // Apply status filter
    if (filterStatus.length > 0) {
      result = result.filter(call => filterStatus.includes(call.status));
    }
    
    // Apply sorting
    result.sort((a, b) => {
      if (sortBy === 'date') {
        // Use raw created_at for accurate date sorting
        const dateA = new Date(a.created_at || `${a.date} ${a.time}`).getTime();
        const dateB = new Date(b.created_at || `${b.date} ${b.time}`).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      } else if (sortBy === 'duration') {
        // Use numeric duration field for reliable sorting
        const durationA = a.durationSeconds || 0;
        const durationB = b.durationSeconds || 0;
        return sortOrder === 'asc' ? durationA - durationB : durationB - durationA;
      } else if (sortBy === 'status') {
        const statusOrder = { completed: 0, initiated: 1, 'in-progress': 2, failed: 3, missed: 4, unknown: 5 };
        const orderA = statusOrder[a.status as keyof typeof statusOrder] ?? 999;
        const orderB = statusOrder[b.status as keyof typeof statusOrder] ?? 999;
        return sortOrder === 'asc' ? orderA - orderB : orderB - orderA;
      }
      return 0;
    });
    
    setFilteredCalls(result);
  }, [calls, searchQuery, sortBy, sortOrder, filterStatus]);

  const handleLogout = () => {
    setLocation("/login");
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
  };
  
  const handleViewDetails = (call: any) => {
    setSelectedCall(call);
    setCallNotes(call.notes);
    setIsDetailOpen(true);
  };
  
  const handleSaveNotes = async () => {
    if (!selectedCall) return;
    
    try {
      // Save notes to database
      const response = await apiRequest("PATCH", `/api/calls/${selectedCall.id}/notes`, {
        notes: callNotes,
        userId
      });
      
      if (response.ok) {
        // Update the UI
        queryClient.setQueryData(['/api/calls/user', userId], (oldData: any) => {
          if (!oldData) return oldData;
          return oldData.map((call: any) => 
            call.id === selectedCall.id 
              ? { ...call, notes: callNotes }
              : call
          );
        });
        
        setIsDetailOpen(false);
        
        toast({
          title: "Changes saved",
          description: "The call notes have been updated successfully."
        });
      } else {
        const data = await response.json();
        throw new Error(data.message || "Failed to update notes");
      }
    } catch (error) {
      console.error("Error saving notes:", error);
      toast({
        title: "Save failed",
        description: "Could not save the changes. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteCall = async (callId: string) => {
    try {
      // Delete from the database - include userId as query param to verify ownership
      const response = await apiRequest("DELETE", `/api/calls/${callId}?userId=${userId}`);
      
      if (response.ok) {
        // Close the detail dialog if open
        if (selectedCall?.id === callId) {
          setIsDetailOpen(false);
        }
        
        // Force a complete refresh of the query to get latest data
        await queryClient.invalidateQueries({
          queryKey: ['/api/calls/user', userId]
        });
        
        toast({
          title: "Call deleted",
          description: "The call has been permanently removed from the database."
        });
      } else {
        // Handle error response
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete call");
      }
    } catch (error) {
      console.error("Error deleting call:", error);
      toast({
        title: "Deletion failed",
        description: error instanceof Error ? error.message : "There was a problem deleting the call. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Get status badge color
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Completed</Badge>;
      case 'initiated':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Initiated</Badge>;
      case 'in-progress':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">In Progress</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Failed</Badge>;
      case 'missed':
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Missed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };
  

  // Format transcript with speaker labels
  const formatTranscript = (transcript: string) => {
    if (!transcript) return [];
    
    try {
      // Try parsing as JSON first (ElevenLabs format)
      const parsed = JSON.parse(transcript);
      if (Array.isArray(parsed)) {
        return parsed.map((entry: any, index: number) => ({
          id: index,
          speaker: entry.role === 'agent' ? 'Agent' : 'Customer',
          message: entry.message || entry.content || ''
        }));
      }
    } catch {
      // If not JSON, try to parse plain text format
      const lines = transcript.split('\n').filter(line => line.trim());
      const formatted = [];
      
      for (const line of lines) {
        // Check for existing speaker labels
        if (line.match(/^(Agent|Customer|AI|User):/i)) {
          const [speaker, ...messageParts] = line.split(':');
          formatted.push({
            id: formatted.length,
            speaker: speaker.trim().replace(/^(AI|User)$/i, m => m.toLowerCase() === 'ai' ? 'Agent' : 'Customer'),
            message: messageParts.join(':').trim()
          });
        } else {
          // Assume alternating speakers if no label
          formatted.push({
            id: formatted.length,
            speaker: formatted.length % 2 === 0 ? 'Agent' : 'Customer',
            message: line.trim()
          });
        }
      }
      return formatted;
    }
    
    return [];
  };

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
              SkyIQ AI Voice Agent
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
              variant="secondary"
              className="w-full justify-start text-left font-normal"
            >
              <Phone className="mr-3 h-5 w-5" />
              Call Dashboard
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
              onClick={() => setLocation('/business-profile')}
            >
              <Building className="mr-3 h-5 w-5" />
              Business Profile
            </Button>
          </nav>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="ghost"
              className="w-full justify-start text-left font-normal text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={handleLogout}
            >
              <LogOut className="mr-3 h-5 w-5" />
              Log Out
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile sidebar toggle */}
      {isMobile && (
        <button
          className="fixed bottom-4 right-4 z-50 bg-primary text-white p-3 rounded-full shadow-lg"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <ArrowRightFromLine className={`h-6 w-6 transform ${isSidebarOpen ? "rotate-180" : ""}`} />
        </button>
      )}

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
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
              {businessName ? `${businessName} Calls` : "Call Dashboard"}
            </h2>
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
          <Card className="mb-6">
            <CardHeader>
              <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
                <div>
                  <CardTitle>Call Dashboard</CardTitle>
                  <CardDescription>
                    Monitor and manage your AI voice agent call history
                  </CardDescription>
                </div>
                <div className="flex flex-col space-y-2 md:flex-row md:space-x-2 md:space-y-0">
                  <Button 
                    onClick={() => setLocation('/call-review')}
                    className="bg-primary hover:bg-primary/90"
                    data-testid="button-generate-review"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Generate Review
                  </Button>
                  
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                      type="search"
                      placeholder="Search calls..."
                      className="pl-8 w-full md:w-[200px]"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="ml-auto">
                        Status <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuCheckboxItem
                        checked={filterStatus.includes('completed')}
                        onCheckedChange={(checked) => {
                          setFilterStatus(prev => 
                            checked 
                              ? [...prev, 'completed']
                              : prev.filter(s => s !== 'completed')
                          );
                        }}
                      >
                        Completed
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={filterStatus.includes('missed')}
                        onCheckedChange={(checked) => {
                          setFilterStatus(prev => 
                            checked 
                              ? [...prev, 'missed']
                              : prev.filter(s => s !== 'missed')
                          );
                        }}
                      >
                        Missed
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={filterStatus.includes('failed')}
                        onCheckedChange={(checked) => {
                          setFilterStatus(prev => 
                            checked 
                              ? [...prev, 'failed']
                              : prev.filter(s => s !== 'failed')
                          );
                        }}
                      >
                        Failed
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead 
                        className="cursor-pointer"
                        onClick={() => {
                          if (sortBy === 'date') {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortBy('date');
                            setSortOrder('desc');
                          }
                        }}
                      >
                        <div className="flex items-center">
                          Date & Time
                          {sortBy === 'date' && (
                            <ArrowUpDown className={`ml-2 h-4 w-4 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
                          )}
                        </div>
                      </TableHead>
                      <TableHead>Caller</TableHead>
                      <TableHead 
                        className="cursor-pointer"
                        onClick={() => {
                          if (sortBy === 'duration') {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortBy('duration');
                            setSortOrder('desc');
                          }
                        }}
                      >
                        <div className="flex items-center">
                          Duration
                          {sortBy === 'duration' && (
                            <ArrowUpDown className={`ml-2 h-4 w-4 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
                          )}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer"
                        onClick={() => {
                          if (sortBy === 'status') {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortBy('status');
                            setSortOrder('asc');
                          }
                        }}
                      >
                        <div className="flex items-center">
                          Status
                          {sortBy === 'status' && (
                            <ArrowUpDown className={`ml-2 h-4 w-4 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
                          )}
                        </div>
                      </TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead className="text-right">Manage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCalls.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                          No calls match your search criteria
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCalls.map((call) => (
                        <TableRow key={call.id}>
                          <TableCell>
                            <div className="font-medium">{call.date}</div>
                            <div className="text-sm text-gray-500">{call.time}</div>
                          </TableCell>
                          <TableCell>{call.phoneNumber || call.number || 'Unknown'}</TableCell>
                          <TableCell>{call.duration}</TableCell>
                          <TableCell>{getStatusBadge(call.status)}</TableCell>
                          <TableCell className="max-w-[200px]">
                            <div className="truncate text-sm" title={call.summary}>
                              {call.summary}
                            </div>
                          </TableCell>
                          <TableCell className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              onClick={() => handleViewDetails(call)}
                              size="sm"
                            >
                              View More
                            </Button>
                            <Button 
                              variant="ghost" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCall(call.id);
                              }}
                              size="sm"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
      
      {/* Call Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Call Details</DialogTitle>
            <DialogDescription>
              {selectedCall && (
                <div className="flex items-center gap-2 mt-1">
                  {selectedCall.date} | {selectedCall.time} | {selectedCall.duration}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {selectedCall && (
            <div className="space-y-5 py-2">
              <div>
                <h4 className="text-sm font-medium">Phone Number</h4>
                <p className="text-sm">{selectedCall.number}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium">Status</h4>
                <div className="mt-1">{getStatusBadge(selectedCall.status)}</div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium">Call Summary</h4>
                <p className="text-sm mt-1">{selectedCall.summary}</p>
              </div>
              
              {selectedCall.transcript && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Call Transcript</h4>
                  <div className="text-sm p-3 bg-gray-50 dark:bg-gray-800 rounded-md max-h-60 overflow-y-auto space-y-2">
                    {formatTranscript(selectedCall.transcript).map((entry) => (
                      <div key={entry.id} className="leading-relaxed">
                        <span className={`font-semibold ${
                          entry.speaker === 'Agent' 
                            ? 'text-blue-600 dark:text-blue-400' 
                            : 'text-purple-600 dark:text-purple-400'
                        }`}>
                          {entry.speaker}:
                        </span>{' '}
                        <span className="text-gray-700 dark:text-gray-300">"{entry.message}"</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <Separator />
              
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Notes</h4>
                <Textarea
                  placeholder="Add notes about this call..."
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          
          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <Button 
              variant="destructive" 
              onClick={() => handleDeleteCall(selectedCall.id)}
              className="mr-auto"
            >
              Delete Call
            </Button>
            <div className="flex space-x-2">
              <Button variant="ghost" onClick={() => setIsDetailOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveNotes}>
                Save Changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
