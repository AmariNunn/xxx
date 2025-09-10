import { useState, useEffect, useMemo, Fragment } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
  Clock,
  PlusCircle,
  BookmarkCheck,
  AlertTriangle,
  Users,
  Info,
  Home,
  Building,
  FileText
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
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const queryClient = useQueryClient();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  // Get current user ID from localStorage
  const userId = Number(localStorage.getItem('userId')) || 1;

  // Load business profile data to get the logo
  const [businessLogo, setBusinessLogo] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>("");

  // Fetch user's business profile when component mounts
  useEffect(() => {
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

  // Use React Query to manage calls data with proper caching and refresh
  const { data: callsData, isLoading, refetch } = useQuery({
    queryKey: ['/api/calls/user', userId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/calls/user/${userId}`);
      const data = await response.json();

      // If we have database calls, use them
      if (data.data?.length > 0) {
        return data.data;
      }

      // If no calls in database yet, seed with placeholder data
      try {
        // Upload placeholder calls to the database for this user
        const seedPromises = placeholderCalls.map(call => 
          apiRequest("POST", "/api/calls", {
            ...call,
            userId
          })
        );

        // Wait for all calls to be created
        await Promise.all(seedPromises);

        // Then fetch the newly created calls
        const freshResponse = await apiRequest('GET', `/api/calls/user/${userId}`);
        const freshData = await freshResponse.json();
        return freshData.data || [];
      } catch (error) {
        console.error("Error seeding initial calls:", error);
        return [];
      }
    },
    refetchOnWindowFocus: true,
    staleTime: 0, // Consider data stale immediately
    gcTime: 0     // Disable caching to always fetch fresh data
  });



  // Use only Twilio calls
  const allCalls = useMemo(() => {
    const twilioCall = callsData || [];
    
    // Sort by date, most recent first
    return twilioCall.sort((a: any, b: any) => {
      const dateA = new Date(`${a.date} ${a.time}`).getTime();
      const dateB = new Date(`${b.date} ${b.time}`).getTime();
      return dateB - dateA; // Most recent first
    });
  }, [callsData]);

  // Derived state
  const calls = allCalls;
  const [filteredCalls, setFilteredCalls] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "duration" | "status">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterAction, setFilterAction] = useState<string[]>([]);

  // State for call detail dialog
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [callNotes, setCallNotes] = useState("");
  const [callAction, setCallAction] = useState<"none" | "follow-up" | "call-back" | "discount">("none");

  // Auto-refresh state
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(3); // minutes
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Collapsible transcript state
  const [expandedTranscripts, setExpandedTranscripts] = useState<Set<number>>(new Set());
  const [customerOnlyView, setCustomerOnlyView] = useState<Set<number>>(new Set());
  const [transcriptSearch, setTranscriptSearch] = useState<{[key: number]: string}>({});

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

    // Apply action filter
    if (filterAction.length > 0) {
      result = result.filter(call => filterAction.includes(call.action));
    }

    // Apply sorting
    result.sort((a, b) => {
      if (sortBy === 'date') {
        const dateA = new Date(`${a.date} ${a.time}`).getTime();
        const dateB = new Date(`${b.date} ${b.time}`).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      } else if (sortBy === 'duration') {
        // Handle both string ("2m 30s") and number (150) duration formats
        const getDurationInSeconds = (duration: any) => {
          if (typeof duration === 'number') return duration;
          if (typeof duration === 'string') {
            if (duration.includes('m') && duration.includes('s')) {
              const parts = duration.split('m ');
              const minutes = parseInt(parts[0]) || 0;
              const seconds = parseInt(parts[1]?.split('s')[0]) || 0;
              return minutes * 60 + seconds;
            }
            // Handle pure number as string
            const numValue = parseInt(duration);
            return isNaN(numValue) ? 0 : numValue;
          }
          return 0;
        };
        
        const durationA = getDurationInSeconds(a.duration);
        const durationB = getDurationInSeconds(b.duration);
        return sortOrder === 'asc' ? durationA - durationB : durationB - durationA;
      } else if (sortBy === 'status') {
        const statusOrder = { completed: 0, missed: 1, failed: 2 };
        return sortOrder === 'asc' 
          ? statusOrder[a.status as keyof typeof statusOrder] - statusOrder[b.status as keyof typeof statusOrder]
          : statusOrder[b.status as keyof typeof statusOrder] - statusOrder[a.status as keyof typeof statusOrder];
      }
      return 0;
    });

    setFilteredCalls(result);
  }, [calls, searchQuery, sortBy, sortOrder, filterStatus, filterAction]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const intervalId = setInterval(async () => {
      try {
        // Refresh call data
        await refetch();
        setLastRefresh(new Date());
        
        toast({
          title: "Data Refreshed",
          description: "Conversation data has been updated.",
        });
      } catch (error) {
        console.error("Auto-refresh error:", error);
      }
    }, refreshInterval * 60 * 1000); // Convert minutes to milliseconds

    return () => clearInterval(intervalId);
  }, [autoRefreshEnabled, refreshInterval, refetch, queryClient, userId, toast]);

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
    setCallAction(call.action);
    setIsDetailOpen(true);
  };

  const toggleTranscript = (callId: number) => {
    setExpandedTranscripts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(callId)) {
        newSet.delete(callId);
      } else {
        newSet.add(callId);
      }
      return newSet;
    });
  };

  const toggleCustomerOnlyView = (callId: number) => {
    setCustomerOnlyView(prev => {
      const newSet = new Set(prev);
      if (newSet.has(callId)) {
        newSet.delete(callId);
      } else {
        newSet.add(callId);
      }
      return newSet;
    });
  };

  const updateTranscriptSearch = (callId: number, searchTerm: string) => {
    setTranscriptSearch(prev => ({
      ...prev,
      [callId]: searchTerm
    }));
  };

  const getCustomerSentiment = (message: string) => {
    const positiveWords = ['thank', 'thanks', 'great', 'excellent', 'good', 'perfect', 'awesome', 'fantastic', 'wonderful', 'amazing'];
    const negativeWords = ['problem', 'issue', 'frustrated', 'angry', 'disappointed', 'terrible', 'awful', 'hate', 'worst', 'horrible'];
    const urgentWords = ['urgent', 'asap', 'immediately', 'emergency', 'quickly', 'hurry', 'rush', 'critical'];
    
    const lowerMessage = message.toLowerCase();
    const hasPositive = positiveWords.some(word => lowerMessage.includes(word));
    const hasNegative = negativeWords.some(word => lowerMessage.includes(word));
    const hasUrgent = urgentWords.some(word => lowerMessage.includes(word));
    
    if (hasUrgent) return { sentiment: 'urgent', color: 'text-red-600', icon: '🚨' };
    if (hasNegative) return { sentiment: 'negative', color: 'text-red-500', icon: '😞' };
    if (hasPositive) return { sentiment: 'positive', color: 'text-green-500', icon: '😊' };
    return { sentiment: 'neutral', color: 'text-gray-500', icon: '😐' };
  };

  const extractCustomerInfo = (message: string) => {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const phoneRegex = /(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\d{10})/;
    const companyRegex = /\b(company|business|corp|corporation|inc|llc|ltd)\b/i;
    
    const info = [];
    if (emailRegex.test(message)) info.push('📧 Email');
    if (phoneRegex.test(message)) info.push('📞 Phone');
    if (companyRegex.test(message)) info.push('🏢 Company');
    
    return info;
  };

  const handleSaveNotes = () => {
    // Save to database (would be implemented in a full version)
    // For now just show successful message

    toast({
      title: "Call notes saved",
      description: "The call notes have been updated successfully."
    });

    // Refresh data
    refetch();

    // Close dialog
    setIsDetailOpen(false);
  };

  // Function to handle call deletion with database persistence

  const handleDeleteCall = async (callId: number) => {
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
      case 'missed':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Missed</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Failed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Get action badge
  const getActionBadge = (action: string) => {
    switch (action) {
      case 'follow-up':
        return (
          <Badge variant="outline" className="border-blue-500 text-blue-500">
            <Clock className="h-3 w-3 mr-1" /> 
            Follow-up
          </Badge>
        );
      case 'call-back':
        return (
          <Badge variant="outline" className="border-orange-500 text-orange-500">
            <Phone className="h-3 w-3 mr-1" /> 
            Call Back
          </Badge>
        );
      case 'discount':
        return (
          <Badge variant="outline" className="border-purple-500 text-purple-500">
            <PlusCircle className="h-3 w-3 mr-1" /> 
            Apply Discount
          </Badge>
        );
      default:
        return null;
    }
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
              variant="secondary"
              className="w-full justify-start text-left font-normal"
            >
              <Phone className="mr-3 h-5 w-5" />
              Call Dashboard
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-left font-normal hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => setLocation('/business-profile')}
            >
              <Building className="mr-3 h-5 w-5" />
              Business Profile
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-left font-normal hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Settings className="mr-3 h-5 w-5" />
              Settings
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
        <header className="bg-white dark:bg-gray-800 shadow-sm px-4 md:px-6 py-4 flex justify-between items-center sticky top-0 z-10">
          <h2 className="text-lg md:text-2xl font-semibold text-blue-600 dark:text-blue-400 truncate min-w-0">
            Create Your Dashboard
          </h2>
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
                  <CardTitle>All Calls</CardTitle>
                  <CardDescription>
                    View and manage all your Vox Assistant call history
                  </CardDescription>
                </div>
                <div className="flex flex-col space-y-2 md:flex-row md:space-x-2 md:space-y-0">

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

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">
                        Action <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuCheckboxItem
                        checked={filterAction.includes('follow-up')}
                        onCheckedChange={(checked) => {
                          setFilterAction(prev => 
                            checked 
                              ? [...prev, 'follow-up']
                              : prev.filter(a => a !== 'follow-up')
                          );
                        }}
                      >
                        Follow-up
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={filterAction.includes('call-back')}
                        onCheckedChange={(checked) => {
                          setFilterAction(prev => 
                            checked 
                              ? [...prev, 'call-back']
                              : prev.filter(a => a !== 'call-back')
                          );
                        }}
                      >
                        Call Back
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={filterAction.includes('discount')}
                        onCheckedChange={(checked) => {
                          setFilterAction(prev => 
                            checked 
                              ? [...prev, 'discount']
                              : prev.filter(a => a !== 'discount')
                          );
                        }}
                      >
                        Apply Discount
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
                      <TableHead>Phone</TableHead>
                      <TableHead>Name</TableHead>
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
                      <TableHead>Action</TableHead>
                      <TableHead className="text-right">Manage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCalls.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                          No calls match your search criteria
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCalls.map((call) => (
                        <Fragment key={call.id}>
                          <TableRow>
                            <TableCell>
                              <div className="font-medium">{new Date(call.createdAt || call.date).toLocaleDateString()}</div>
                              <div className="text-sm text-gray-500">{new Date(call.createdAt || call.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span>{call.phoneNumber || call.number || 'Unknown'}</span>
                              </div>
                            </TableCell>
                            <TableCell>{call.contactName || call.name || "Unknown"}</TableCell>
                            <TableCell>{typeof call.duration === 'number' ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : call.duration}</TableCell>
                            <TableCell>{getStatusBadge(call.status)}</TableCell>
                            <TableCell className="max-w-[200px]">
                              <div className="truncate text-sm" title={call.summary}>
                                {call.summary}
                              </div>
                            </TableCell>
                            <TableCell>
                              {getActionBadge(call.action)}
                            </TableCell>
                            <TableCell className="flex justify-end gap-2">
                              {call.recordingUrl && (
                                <Button 
                                  variant="ghost" 
                                  onClick={() => window.open(call.recordingUrl, '_blank')}
                                  size="sm"
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                >
                                  🎵 Audio
                                </Button>
                              )}
                              {call.transcript && (
                                <Button 
                                  variant="ghost" 
                                  onClick={() => toggleTranscript(call.id)}
                                  size="sm"
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  📝 {expandedTranscripts.has(call.id) ? 'Hide' : 'Show'} Transcript
                                </Button>
                              )}
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
                          
                          {/* Collapsible Transcript Row */}
                          {expandedTranscripts.has(call.id) && call.transcript && (
                            <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                              <TableCell colSpan={8} className="p-0">
                                <div className="p-6">
                                  <div className="max-w-none bg-white dark:bg-gray-800 rounded-lg border">
                                    {/* Call Summary Section */}
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 border-b border-l-4 border-blue-500">
                                      <h3 className="font-semibold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-2">
                                        📊 AI Summary
                                      </h3>
                                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                        {call.summary}
                                      </p>
                                    </div>

                                    {/* Enhanced Transcript Content */}
                                    <div className="p-4">
                                      <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                                          Conversation Transcript
                                        </h3>
                                        <div className="flex items-center gap-2">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => toggleCustomerOnlyView(call.id)}
                                            className={customerOnlyView.has(call.id) ? "bg-blue-100 text-blue-700" : ""}
                                          >
                                            👤 {customerOnlyView.has(call.id) ? 'Show All' : 'Customer Only'}
                                          </Button>
                                        </div>
                                      </div>

                                      {/* Search Box */}
                                      <div className="mb-4">
                                        <div className="relative">
                                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                          <Input
                                            placeholder="Search in transcript..."
                                            value={transcriptSearch[call.id] || ''}
                                            onChange={(e) => updateTranscriptSearch(call.id, e.target.value)}
                                            className="pl-10"
                                          />
                                        </div>
                                      </div>
                                      
                                      <div className="space-y-3 max-h-96 overflow-y-auto">
                                        {call.transcript.split('\n').filter((line: string) => line.trim()).map((line: string, index: number) => {
                                          const isCustomer = line.toLowerCase().includes('customer:') || line.toLowerCase().includes('caller:');
                                          const isAgent = line.toLowerCase().includes('agent:') || line.toLowerCase().includes('assistant:');
                                          
                                          // Skip agent messages if customer-only view is enabled
                                          if (customerOnlyView.has(call.id) && isAgent) {
                                            return null;
                                          }

                                          // Skip messages that don't match search if search is active
                                          if (transcriptSearch[call.id] && !line.toLowerCase().includes(transcriptSearch[call.id].toLowerCase())) {
                                            return null;
                                          }
                                          
                                          // Remove speaker prefixes for cleaner display
                                          const cleanLine = line.replace(/^(customer:|caller:|agent:|assistant:)\s*/i, '');
                                          
                                          if (isCustomer) {
                                            const sentiment = getCustomerSentiment(cleanLine);
                                            const customerInfo = extractCustomerInfo(cleanLine);
                                            
                                            return (
                                              <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-400">
                                                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0">
                                                  C
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-center justify-between mb-1">
                                                    <div className="text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center gap-2">
                                                      Customer
                                                      <span className={`text-xs ${sentiment.color}`}>
                                                        {sentiment.icon}
                                                      </span>
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                      {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                    </div>
                                                  </div>
                                                  <p className="text-gray-800 dark:text-gray-200 leading-relaxed">{cleanLine}</p>
                                                  {customerInfo.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-1">
                                                      {customerInfo.map((info, idx) => (
                                                        <span key={idx} className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">
                                                          {info}
                                                        </span>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          } else if (isAgent) {
                                            return (
                                              <div key={index} className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0">
                                                  A
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-center justify-between mb-1">
                                                    <div className="text-sm font-medium text-green-600 dark:text-green-400">Assistant</div>
                                                    <div className="text-xs text-gray-500">
                                                      {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                    </div>
                                                  </div>
                                                  <p className="text-gray-800 dark:text-gray-200 leading-relaxed">{cleanLine}</p>
                                                </div>
                                              </div>
                                            );
                                          } else if (cleanLine.trim()) {
                                            return (
                                              <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                                <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0">
                                                  •
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed italic">{cleanLine}</p>
                                                </div>
                                              </div>
                                            );
                                          }
                                          return null;
                                        })}
                                      </div>
                                    </div>

                                    {/* Call Notes Section */}
                                    {call.notes && (
                                      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 border-t border-l-4 border-yellow-500">
                                        <h3 className="font-semibold text-yellow-600 dark:text-yellow-400 mb-2 flex items-center gap-2">
                                          📝 Call Notes
                                        </h3>
                                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                          {call.notes}
                                        </p>
                                      </div>
                                    )}

                                    {/* Enhanced Action Buttons */}
                                    <div className="p-4 border-t bg-gray-50 dark:bg-gray-800 flex justify-between items-center">
                                      <div className="text-sm text-gray-600 dark:text-gray-400">
                                        {call.transcript.split('\n').filter(line => line.toLowerCase().includes('customer:') || line.toLowerCase().includes('caller:')).length} customer messages
                                      </div>
                                      <div className="flex gap-2">
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          onClick={() => {
                                            // Download customer-only transcript
                                            const customerLines = call.transcript.split('\n')
                                              .filter(line => line.toLowerCase().includes('customer:') || line.toLowerCase().includes('caller:'))
                                              .map(line => line.replace(/^(customer:|caller:)\s*/i, ''));
                                            
                                            const customerTranscript = `CUSTOMER TRANSCRIPT\\n===================\\nDate: ${call.date}\\nTime: ${call.time}\\nDuration: ${call.duration}\\nContact: ${call.name || call.number}\\n\\nCUSTOMER MESSAGES ONLY:\\n${customerLines.join('\\n')}\\n\\nSUMMARY:\\n${call.summary}\\n\\nNOTES:\\n${call.notes || 'No additional notes'}`;
                                            const blob = new Blob([customerTranscript], { type: 'text/plain' });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `customer-transcript-${call.name || call.number}-${new Date().toISOString().split('T')[0]}.txt`;
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                            URL.revokeObjectURL(url);
                                          }}
                                        >
                                          👤 Customer Only
                                        </Button>
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          onClick={() => {
                                            const transcript = `CALL TRANSCRIPT\\n===================\\nDate: ${call.date}\\nTime: ${call.time}\\nDuration: ${call.duration}\\nContact: ${call.name || call.number}\\n\\nSUMMARY:\\n${call.summary}\\n\\nTRANSCRIPT:\\n${call.transcript}\\n\\nNOTES:\\n${call.notes || 'No additional notes'}`;
                                            const blob = new Blob([transcript], { type: 'text/plain' });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `transcript-${call.name || call.number}-${new Date().toISOString().split('T')[0]}.txt`;
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                            URL.revokeObjectURL(url);
                                          }}
                                        >
                                          📄 Full Transcript
                                        </Button>
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          onClick={() => toggleTranscript(call.id)}
                                        >
                                          ⬆️ Collapse
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Review Call Button */}
          <div className="mt-6 flex justify-center">
            <Button 
              onClick={() => setLocation('/call-review')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
              size="lg"
            >
              <FileText className="mr-2 h-5 w-5" />
              Review All Calls & Generate Report
            </Button>
          </div>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium">Phone Number</h4>
                  <p className="text-sm">{selectedCall.number}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium">Contact Name</h4>
                  <p className="text-sm">{selectedCall.name || "Unknown"}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium">Status</h4>
                <div className="mt-1">{getStatusBadge(selectedCall.status)}</div>
              </div>

              <div>
                <h4 className="text-sm font-medium">Call Summary</h4>
                <p className="text-sm mt-1">{selectedCall.summary}</p>
              </div>

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

              <div className="space-y-3">
                <h4 className="text-sm font-medium">Action Required</h4>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={callAction === "none" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCallAction("none")}
                  >
                    None
                  </Button>
                  <Button
                    variant={callAction === "follow-up" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCallAction("follow-up")}
                    className="flex items-center gap-1"
                  >
                    <Clock className="h-3 w-3" /> Follow Up
                  </Button>
                  <Button
                    variant={callAction === "call-back" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCallAction("call-back")}
                    className="flex items-center gap-1"
                  >
                    <Phone className="h-3 w-3" /> Call Back
                  </Button>
                  <Button
                    variant={callAction === "discount" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCallAction("discount")}
                    className="flex items-center gap-1"
                  >
                    <PlusCircle className="h-3 w-3" /> Apply Discount
                  </Button>
                </div>
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