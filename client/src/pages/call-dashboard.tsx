import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Building
} from "lucide-react";
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
    summary: "Customer inquired about pricing for enterprise plan. Showed interest in scheduling a demo next week.",
    notes: "Follow up on Tuesday to schedule the demo.",
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
    summary: "Customer complained about billing issue. Issue resolved by explaining the pro-rated charges.",
    notes: "",
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
    summary: "Call went to voicemail. No message left.",
    notes: "Try calling back during business hours",
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
    summary: "Customer requested cancellation. Offered 20% discount for 3 months, which they accepted.",
    notes: "Apply discount to next 3 monthly bills",
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
    summary: "Technical support call. Helped resolve login issues by resetting account password.",
    notes: "",
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
  
  // State for calls data and filtering/sorting
  const [calls, setCalls] = useState(placeholderCalls);
  const [filteredCalls, setFilteredCalls] = useState(placeholderCalls);
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
        const durationA = parseInt(a.duration.split('m')[0]) * 60 + parseInt(a.duration.split('m ')[1].split('s')[0]);
        const durationB = parseInt(b.duration.split('m')[0]) * 60 + parseInt(b.duration.split('m ')[1].split('s')[0]);
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
  
  const handleSaveNotes = () => {
    // In a real app, we would save this to the database
    // For now, just update the local state
    setCalls(calls.map(call => 
      call.id === selectedCall.id 
        ? { ...call, notes: callNotes, action: callAction } 
        : call
    ));
    
    toast({
      title: "Call notes saved",
      description: "The call notes have been updated successfully."
    });
    
    setIsDetailOpen(false);
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
            <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
              <Phone className="h-6 w-6" />
              AI Call Assistant
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
                  <CardTitle>All Calls</CardTitle>
                  <CardDescription>
                    View and manage all your AI assistant call history
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
                      <TableHead></TableHead>
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
                        <TableRow key={call.id}>
                          <TableCell>
                            <div className="font-medium">{call.date}</div>
                            <div className="text-sm text-gray-500">{call.time}</div>
                          </TableCell>
                          <TableCell>{call.number}</TableCell>
                          <TableCell>{call.name || "Unknown"}</TableCell>
                          <TableCell>{call.duration}</TableCell>
                          <TableCell>{getStatusBadge(call.status)}</TableCell>
                          <TableCell className="max-w-[200px]">
                            <div className="truncate text-sm" title={call.summary}>
                              {call.summary}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getActionBadge(call.action)}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              onClick={() => handleViewDetails(call)}
                              size="sm"
                            >
                              View More
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
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDetailOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNotes}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}