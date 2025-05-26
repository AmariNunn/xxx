import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Phone, Users, Info, ArrowRightFromLine, Bell, Settings, LogOut, Building } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import UserAvatar from "@/components/user-avatar";
import BusinessContextPanel from "@/components/business-context-panel";
import TwilioSettings from "@/components/twilio-settings";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
// Schema for business info form
const businessInfoSchema = z.object({
  businessDescription: z.string().min(10, { message: "Description must be at least 10 characters" }),
  industry: z.string().min(1, { message: "Industry is required" }),
  targetAudience: z.string().min(1, { message: "Target audience is required" }),
});

type BusinessInfoData = z.infer<typeof businessInfoSchema>;

// Placeholder call data
const placeholderCalls = [
  { id: 1, date: "2023-10-01", time: "09:30 AM", number: "+1 (555) 123-4567", duration: "2m 45s", status: "Completed" },
  { id: 2, date: "2023-10-02", time: "11:15 AM", number: "+1 (555) 987-6543", duration: "5m 12s", status: "Completed" },
  { id: 3, date: "2023-10-03", time: "02:45 PM", number: "+1 (555) 444-3333", duration: "1m 50s", status: "Missed" },
  { id: 4, date: "2023-10-04", time: "04:20 PM", number: "+1 (555) 222-1111", duration: "3m 33s", status: "Completed" },
];

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  
  // Get current user ID from localStorage
  const userId = Number(localStorage.getItem('userId')) || 1;

  // For business info form
  const businessInfoForm = useForm<BusinessInfoData>({
    resolver: zodResolver(businessInfoSchema),
    defaultValues: {
      businessDescription: "",
      industry: "",
      targetAudience: "",
    },
  });
  
  // Load business profile data to get the logo
  const [businessLogo, setBusinessLogo] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>("");
  
  // Fetch recent calls for this user
  const { data: callsData } = useQuery({
    queryKey: ['/api/calls/user', userId],
    queryFn: async () => {
      const response = await fetch(`/api/calls/user/${userId}`);
      if (response.ok) {
        const data = await response.json();
        return data.data || [];
      }
      return [];
    }
  });
  
  // Use the latest 4 calls for the dashboard
  const recentCalls = callsData ? callsData.slice(0, 4) : [];

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

  const onBusinessInfoSubmit = (data: BusinessInfoData) => {
    toast({
      title: "Business info updated",
      description: "Your business information has been saved successfully.",
    });
    console.log("Business info submitted:", data);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCsvFile(e.target.files[0]);
    }
  };

  // Lead file upload mutation
  const uploadLeadMutation = useMutation({
    mutationFn: async (leadData: {
      fileUrl: string;
      fileName: string;
      fileType: string;
      fileSize?: string;
    }) => {
      const response = await apiRequest("POST", `/api/business/${userId}/leads`, leadData);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['/api/business', userId] });
      
      toast({
        title: "Leads Uploaded Successfully",
        description: "Your lead file has been saved and will appear in your Business Profile.",
      });
      
      // Reset file input
      const fileInput = document.getElementById("csv-upload") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      setCsvFile(null);
    },
    onError: () => {
      toast({
        title: "Upload Failed",
        description: "There was a problem uploading your lead file. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Format file size to human-readable string
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " bytes";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleFileUpload = () => {
    if (csvFile) {
      toast({
        title: "File Upload Started",
        description: `Uploading ${csvFile.name}...`,
      });
      
      // Create a mock file URL (in production, this would be a real cloud storage URL)
      const mockFileUrl = `lead://${userId}/${Date.now()}-${encodeURIComponent(csvFile.name)}`;
      const fileSizeString = formatFileSize(csvFile.size);
      
      // Save lead file to database
      uploadLeadMutation.mutate({
        fileUrl: mockFileUrl,
        fileName: csvFile.name,
        fileType: csvFile.type || 'text/csv',
        fileSize: fileSizeString
      });
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
              onClick={() => setLocation('/call-dashboard')}
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
              {businessName ? `${businessName} Dashboard` : "Dashboard"}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Call Log */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Call Log</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Phone Number</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentCalls.length > 0 ? (
                        recentCalls.map((call) => (
                          <TableRow key={call.id}>
                            <TableCell>{call.date || new Date(call.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell>{call.time || new Date(call.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</TableCell>
                            <TableCell>{call.number || call.phoneNumber}</TableCell>
                            <TableCell>
                              {call.duration ? 
                                (typeof call.duration === 'number' ? 
                                  `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` 
                                  : call.duration) 
                                : '0m 0s'}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  (call.status === "completed" || call.status === "Completed") 
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {call.status}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                            No calls found. Your call history will appear here.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-center mt-4">
                  <Button variant="outline" onClick={() => setLocation('/call-dashboard')}>View All Calls</Button>
                </div>
              </CardContent>
            </Card>

            {/* Upload Leads */}
            <Card>
              <CardHeader>
                <CardTitle>Upload Leads</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 border-2 border-dashed rounded-lg text-center">
                  <div className="space-y-4">
                    <div className="flex items-center justify-center">
                      <Users className="h-10 w-10 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-500">
                      Upload your CSV file with lead information for automated calling
                    </p>
                    <Input
                      id="csv-upload"
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="cursor-pointer"
                    />
                    {csvFile && (
                      <p className="text-sm text-primary font-medium">Selected: {csvFile.name}</p>
                    )}
                    <Button
                      onClick={handleFileUpload}
                      disabled={!csvFile}
                      className="w-full"
                    >
                      Upload Leads
                    </Button>
                  </div>
                  <Separator className="my-4" />
                  <p className="text-xs text-gray-500">
                    Supported format: CSV with columns for name, phone, and email
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Twilio Integration */}
            <div className="lg:col-span-2">
              <TwilioSettings userId={userId} />
            </div>

            {/* Business Context */}
            <div className="lg:col-span-3">
              <BusinessContextPanel />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}