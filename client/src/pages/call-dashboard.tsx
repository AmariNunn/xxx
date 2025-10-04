import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { io } from 'socket.io-client';
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "wouter";
import { 
  Phone, 
  Bell,
  Search,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Activity
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

// Helper function to format transcript with speaker labels
const formatTranscript = (transcript: string): { speaker: string; message: string }[] => {
  if (!transcript || transcript.trim() === '') return [];
  
  try {
    // Try parsing as JSON first (ElevenLabs format)
    const parsed = JSON.parse(transcript);
    if (Array.isArray(parsed)) {
      return parsed.map((item: any) => ({
        speaker: item.role === 'agent' ? 'Agent' : 'Customer',
        message: item.message || item.text || ''
      }));
    }
  } catch {
    // If not JSON, try to parse plain text format
    const lines = transcript.split('\n').filter(line => line.trim());
    const formatted: { speaker: string; message: string }[] = [];
    
    for (const line of lines) {
      // Check for "Speaker: message" format
      const match = line.match(/^(Agent|Customer|AI|User):\s*(.+)$/i);
      if (match) {
        const speaker = match[1].toLowerCase().includes('agent') || match[1].toLowerCase().includes('ai') ? 'Agent' : 'Customer';
        formatted.push({ speaker, message: match[2].trim() });
      } else {
        // If no clear speaker, add as continuation or customer
        if (formatted.length > 0) {
          formatted[formatted.length - 1].message += ' ' + line;
        } else {
          formatted.push({ speaker: 'Customer', message: line });
        }
      }
    }
    
    return formatted.length > 0 ? formatted : [{ speaker: 'Agent', message: transcript }];
  }
  
  return [{ speaker: 'Agent', message: transcript }];
};

export default function CallDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const userId = localStorage.getItem('userId');
  
  const [businessLogo, setBusinessLogo] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>("");

  useEffect(() => {
    if (!userId) return;
    
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
  
  const queryClient = useQueryClient();
  const { data: callsData, isLoading, refetch } = useQuery({
    queryKey: ['/api/calls/user', userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) throw new Error("No user ID available");
      
      const response = await apiRequest('GET', `/api/calls/user/${userId}`);
      const data = await response.json();
      
      if (data.data?.length > 0) {
        return data.data.map((call: any) => {
          const callDate = new Date(call.created_at);
          const durationSeconds = call.duration || 0;
          
          return {
            id: call.id,
            created_at: call.created_at,
            date: callDate.toLocaleDateString(),
            time: callDate.toLocaleTimeString(undefined, {
              hour: '2-digit', 
              minute: '2-digit',
              hour12: true 
            }),
            number: call.caller_number || call.phone_number || 'Unknown',
            name: call.contact_name || "Unknown",
            durationSeconds: durationSeconds,
            duration: durationSeconds > 0 ? 
              `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s` : 
              '0m 0s',
            status: call.status || 'unknown',
            transcript: call.transcript || '',
            summary: call.summary || `Call ${call.status}`,
            notes: call.notes || '',
            conversation_id: call.conversation_id,
            call_type: call.call_type
          };
        });
      }
      
      return [];
    },
    refetchOnWindowFocus: false,
    staleTime: 0,
    gcTime: 0,
  });

  useEffect(() => {
    const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const socket = io(SERVER_URL, {
      transports: ["websocket", "polling"]
    });

    socket.on('connect', () => {
      console.log('✅ Connected to Socket.IO server');
    });

    socket.on('callCompleted', (completedCall) => {
      console.log('✅ Received callCompleted event:', completedCall);
      queryClient.invalidateQueries({ queryKey: ['/api/calls/user', userId] });
      
      toast({
        title: "Call Completed",
        description: `Call has been completed and transcript is available.`,
      });
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from Socket.IO server');
    });

    return () => {
      socket.disconnect();
    };
  }, [userId, queryClient, toast]);
  
  const calls = callsData || [];
  const [filteredCalls, setFilteredCalls] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [callNotes, setCallNotes] = useState("");

  useEffect(() => {
    let result = [...calls];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(call => 
        call.number.toLowerCase().includes(query) || 
        (call.name && call.name.toLowerCase().includes(query)) ||
        call.summary.toLowerCase().includes(query)
      );
    }
    
    if (filterStatus !== "all") {
      result = result.filter(call => call.status === filterStatus);
    }
    
    result.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });
    
    setFilteredCalls(result);
  }, [calls, searchQuery, filterStatus]);

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
  
  const handleSaveNotes = () => {
    toast({
      title: "Call notes saved",
      description: "The call notes have been updated successfully."
    });
    
    refetch();
    setIsDetailOpen(false);
  };
  
  const handleDeleteCall = async (callId: number) => {
    try {
      const response = await apiRequest("DELETE", `/api/calls/${callId}?userId=${userId}`);
      
      if (response.ok) {
        if (selectedCall?.id === callId) {
          setIsDetailOpen(false);
        }
        
        await queryClient.invalidateQueries({
          queryKey: ['/api/calls/user', userId]
        });
        
        toast({
          title: "Call deleted",
          description: "The call has been permanently removed."
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete call");
      }
    } catch (error) {
      console.error("Error deleting call:", error);
      toast({
        title: "Deletion failed",
        description: error instanceof Error ? error.message : "There was a problem deleting the call.",
        variant: "destructive"
      });
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'completed':
        return { icon: CheckCircle, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950', label: 'Completed' };
      case 'initiated':
        return { icon: Activity, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950', label: 'Initiated' };
      case 'in-progress':
        return { icon: Clock, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-950', label: 'In Progress' };
      case 'failed':
        return { icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950', label: 'Failed' };
      case 'missed':
        return { icon: AlertCircle, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950', label: 'Missed' };
      default:
        return { icon: AlertCircle, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-950', label: status };
    }
  };

  // Calculate stats
  const totalCalls = calls.length;
  const completedCalls = calls.filter((c: any) => c.status === 'completed').length;
  const failedCalls = calls.filter((c: any) => c.status === 'failed' || c.status === 'missed').length;
  const avgDuration = calls.length > 0 
    ? Math.round(calls.reduce((sum: number, c: any) => sum + (c.durationSeconds || 0), 0) / calls.length)
    : 0;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <SharedNavigation 
        currentPath="/call-dashboard"
        onLogout={handleLogout}
      />

      <div className="flex-1 overflow-y-auto">
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
                {businessName ? businessName[0] : 'C'}
              </div>
            )}
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-gray-800 dark:text-white">
                Call Dashboard
              </h2>
              <p className="text-sm text-muted-foreground hidden md:block">Monitor your AI agent calls</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="h-9 w-9">
              <Bell className="h-4 w-4" />
            </Button>
            <UserAvatar size="sm" />
          </div>
        </header>

        <main className="px-4 md:px-6 py-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="text-xs">Total Calls</CardDescription>
                <CardTitle className="text-2xl md:text-3xl">{totalCalls}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-xs text-muted-foreground">
                  <Activity className="h-4 w-4 mr-1" />
                  All time
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="text-xs">Completed</CardDescription>
                <CardTitle className="text-2xl md:text-3xl text-green-600 dark:text-green-400">
                  {completedCalls}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-xs text-green-600 dark:text-green-400">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  {totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0}% success rate
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="text-xs">Failed/Missed</CardDescription>
                <CardTitle className="text-2xl md:text-3xl text-red-600 dark:text-red-400">
                  {failedCalls}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-xs text-red-600 dark:text-red-400">
                  <TrendingDown className="h-4 w-4 mr-1" />
                  {totalCalls > 0 ? Math.round((failedCalls / totalCalls) * 100) : 0}% failure rate
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="text-xs">Avg Duration</CardDescription>
                <CardTitle className="text-2xl md:text-3xl">
                  {Math.floor(avgDuration / 60)}m {avgDuration % 60}s
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-xs text-muted-foreground">
                  <Clock className="h-4 w-4 mr-1" />
                  Per call average
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Call History</CardTitle>
                  <CardDescription className="text-sm">View and manage all your calls</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                  <div className="relative flex-1 md:flex-none">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input
                      type="search"
                      placeholder="Search calls..."
                      className="pl-9 w-full md:w-[200px]"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      data-testid="input-search-calls"
                    />
                  </div>
                  
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-full sm:w-[140px]" data-testid="select-status-filter">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="initiated">Initiated</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="missed">Missed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p>Loading calls...</p>
                </div>
              ) : filteredCalls.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Phone className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-lg font-medium">No calls found</p>
                  <p className="text-sm">Try adjusting your search or filters</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredCalls.map((call) => {
                    const statusInfo = getStatusInfo(call.status);
                    const StatusIcon = statusInfo.icon;
                    
                    return (
                      <Card 
                        key={call.id} 
                        className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
                        style={{ borderLeftColor: statusInfo.color.includes('green') ? '#10b981' : statusInfo.color.includes('blue') ? '#3b82f6' : statusInfo.color.includes('red') ? '#ef4444' : statusInfo.color.includes('orange') ? '#f59e0b' : '#6b7280' }}
                        onClick={() => handleViewDetails(call)}
                        data-testid={`call-card-${call.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-start md:items-center justify-between flex-col md:flex-row gap-2">
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${statusInfo.bg}`}>
                                    <StatusIcon className={`h-5 w-5 ${statusInfo.color}`} />
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                                      {call.name}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">{call.number}</p>
                                  </div>
                                </div>
                                <Badge className={`${statusInfo.bg} ${statusInfo.color} border-0`}>
                                  {statusInfo.label}
                                </Badge>
                              </div>
                              
                              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                                {call.summary}
                              </p>
                              
                              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {call.date} at {call.time}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Activity className="h-3 w-3" />
                                  {call.duration}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 md:self-center">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewDetails(call);
                                }}
                                data-testid={`button-view-${call.id}`}
                              >
                                View Details
                                <ChevronRight className="h-4 w-4 ml-1" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
      
      {/* Call Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Call Details</DialogTitle>
            <DialogDescription>
              {selectedCall && (
                <div className="flex flex-wrap items-center gap-2 mt-1 text-sm">
                  <span>{selectedCall.date}</span>
                  <span>•</span>
                  <span>{selectedCall.time}</span>
                  <span>•</span>
                  <span>{selectedCall.duration}</span>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {selectedCall && (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-5 py-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone Number</h4>
                    <p className="text-sm mt-1">{selectedCall.number}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Contact Name</h4>
                    <p className="text-sm mt-1">{selectedCall.name || "Unknown"}</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</h4>
                  {(() => {
                    const statusInfo = getStatusInfo(selectedCall.status);
                    const StatusIcon = statusInfo.icon;
                    return (
                      <Badge className={`${statusInfo.bg} ${statusInfo.color} border-0`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusInfo.label}
                      </Badge>
                    );
                  })()}
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Call Summary</h4>
                  <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">{selectedCall.summary}</p>
                </div>
                
                {selectedCall.transcript && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Transcript</h4>
                    <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg max-h-64 overflow-y-auto">
                      {formatTranscript(selectedCall.transcript).map((line, index) => (
                        <div key={index} className="flex gap-2">
                          <span className={`font-semibold text-sm min-w-[80px] ${
                            line.speaker === 'Agent' 
                              ? 'text-blue-600 dark:text-blue-400' 
                              : 'text-purple-600 dark:text-purple-400'
                          }`}>
                            {line.speaker}:
                          </span>
                          <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                            "{line.message}"
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <Separator />
                
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Notes</h4>
                  <Textarea
                    placeholder="Add notes about this call..."
                    value={callNotes}
                    onChange={(e) => setCallNotes(e.target.value)}
                    rows={3}
                    className="resize-none"
                    data-testid="textarea-call-notes"
                  />
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    variant="destructive"
                    onClick={() => handleDeleteCall(selectedCall.id)}
                    className="w-full sm:w-auto"
                    data-testid="button-delete-call"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Call
                  </Button>
                  <div className="flex gap-2 flex-1">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsDetailOpen(false)}
                      className="flex-1"
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSaveNotes}
                      className="flex-1"
                      data-testid="button-save-notes"
                    >
                      Save Changes
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
