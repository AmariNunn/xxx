import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Phone, Users, Info, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import UserAvatar from "@/components/user-avatar";
import BusinessContextPanel from "@/components/business-context-panel";
import SharedNavigation from "@/components/shared-navigation";
import { useAuth } from "@/hooks/useAuth";

// Type for call data
interface CallData {
  id: number;
  user_id: string;
  phone_number: string;
  contact_name?: string;
  duration: number;
  status: string;
  notes?: string;
  summary?: string;
  transcript: string;
  twilio_call_sid?: string;
  direction?: string;
  recording_url?: string;
  is_from_twilio: boolean;
  created_at: string;
  call_type: string;
  called_number: string;
  conversation_id?: string;
  elevenlabs_call_id?: string;
  client_data?: any;
  batch_id?: string;
  caller_number: string;
}


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

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  
  // Get current user from auth hook
  const { user } = useAuth();
  const userId = user?.id;

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
  
  // Fetch all ElevenLabs calls for this user
  const { data: callsData, isLoading: callsLoading, error: callsError } = useQuery({
    queryKey: ['/api/calls/user', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const response = await fetch(`/api/calls/user/${userId}`);
      if (response.ok) {
        const data = await response.json();
        const calls = data.data || [];
        
        // Filter to only show ElevenLabs calls (calls with conversation_id or elevenlabs_call_id)
        return calls.filter((call: CallData) => {
          return call.conversation_id || call.elevenlabs_call_id;
        });
      }
      return [];
    },
    enabled: !!userId
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
      {/* Shared Navigation */}
      <SharedNavigation 
        currentPath="/dashboard"
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
                      {callsLoading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                            Loading calls...
                          </TableCell>
                        </TableRow>
                      ) : callsError ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-red-500">
                            Error loading calls: {callsError.message}
                          </TableCell>
                        </TableRow>
                      ) : !userId ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-yellow-500">
                            No user ID found. Please log in again.
                          </TableCell>
                        </TableRow>
                      ) : recentCalls.length > 0 ? (
                        recentCalls.map((call: CallData) => (
                          <TableRow key={call.id}>
                            <TableCell>{new Date(call.created_at).toLocaleDateString()}</TableCell>
                            <TableCell>{new Date(call.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</TableCell>
                            <TableCell>{call.phone_number}</TableCell>
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
                                    : call.status === "initiated"
                                    ? "bg-blue-100 text-blue-800"
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
                            No recent ElevenLabs calls found. Your call history will appear here after making calls.
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