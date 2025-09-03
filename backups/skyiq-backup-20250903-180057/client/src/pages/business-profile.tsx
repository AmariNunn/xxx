import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "wouter";
import { 
  Phone, 
  ArrowRightFromLine, 
  Bell, 
  Settings, 
  LogOut, 
  Info,
  Home,
  Upload,
  Link,
  FileText,
  Building,
  Edit2,
  Save,
  Trash2
} from "lucide-react";
import AudioWave from "@/components/audio-wave";
import SkyIQText from "@/components/skyiq-text";
import UserAvatar from "@/components/user-avatar";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Helper function to convert technical file types to user-friendly display format
function getDisplayFileType(fileType: string): string {
  if (!fileType) return "File";
  
  if (fileType.includes("pdf")) return "PDF";
  if (fileType.includes("word") || fileType.includes("docx")) return "DOCX";
  if (fileType.includes("jpeg") || fileType.includes("jpg")) return "JPG";
  if (fileType.includes("png")) return "PNG";
  if (fileType.includes("csv")) return "CSV";
  if (fileType.includes("text/plain")) return "TXT";
  if (fileType.includes("spreadsheet") || fileType.includes("excel") || fileType.includes("xlsx")) return "XLS";
  
  // Return shortened MIME type if no specific match
  return fileType.split('/')[1]?.toUpperCase() || "File";
}

export default function BusinessProfile() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  
  // Business profile state
  const [isEditing, setIsEditing] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [businessLinks, setBusinessLinks] = useState<{title: string, url: string}[]>([]);
  const [businessFiles, setBusinessFiles] = useState<{
    name: string, 
    type: string, 
    size: string, 
    category: "document" | "lead", 
    index: number
  }[]>([]);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  
  // Dialog state for logo upload
  const [logoDialogOpen, setLogoDialogOpen] = useState(false);
  
  // Get current user ID from localStorage
  const userId = Number(localStorage.getItem('userId')) || 1;
  
  // Get business name for display in header
  const [displayBusinessName, setDisplayBusinessName] = useState<string>("");
  
  // Load business data from API
  const { data: businessData, isLoading, error: queryError } = useQuery({
    queryKey: ['/api/business', userId],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", `/api/business/${userId}`);
        if (response.status === 404) {
          // Return empty data structure for new users
          return { 
            data: {
              businessName: "",
              businessEmail: "",
              businessPhone: "",
              businessAddress: "",
              description: "",
              links: [],
              fileNames: [],
              fileTypes: [],
              fileSizes: [],
              logoUrl: null
            }
          };
        }
        if (!response.ok) {
          throw new Error("Failed to fetch business data");
        }
        return response.json();
      } catch (error) {
        console.error("Error fetching business data:", error);
        toast({
          title: "Error loading profile",
          description: "There was an error loading your business profile. Please try refreshing the page.",
          variant: "destructive"
        });
        throw error;
      }
    }
  });
  
  // Update local state when business data is loaded
  useEffect(() => {
    if (businessData?.data) {
      // Set basic business info
      setBusinessName(businessData.data.businessName || "");
      setDisplayBusinessName(businessData.data.businessName || "");
      setBusinessEmail(businessData.data.businessEmail || "");
      setBusinessPhone(businessData.data.businessPhone || "");
      setBusinessAddress(businessData.data.businessAddress || "");
      setBusinessDescription(businessData.data.description || "");
      
      // Transform links data
      const links = [];
      if (businessData.data.links) {
        for (let i = 0; i < businessData.data.links.length; i++) {
          const link = businessData.data.links[i];
          const cleanUrl = link.replace(/^https?:\/\//, "").replace(/^www\./, "");
          const domain = cleanUrl.split('/')[0];
          links.push({ title: domain, url: link });
        }
      }
      setBusinessLinks(links);
      
      // Transform files data (regular files and lead files)
      const files: {
        name: string;
        type: string;
        size: string;
        category: "document" | "lead";
        index: number;
      }[] = [];
      
      // Add regular files
      if (businessData.data.fileNames && businessData.data.fileTypes) {
        for (let i = 0; i < businessData.data.fileNames.length; i++) {
          const size = businessData.data.fileSizes && businessData.data.fileSizes[i] 
            ? businessData.data.fileSizes[i] 
            : "N/A";
          
          files.push({
            name: businessData.data.fileNames[i],
            type: getDisplayFileType(businessData.data.fileTypes[i]),
            size: size,
            category: "document" as "document",
            index: i
          });
        }
      }
      
      // Add lead files
      if (businessData.data.leadNames && businessData.data.leadTypes) {
        for (let i = 0; i < businessData.data.leadNames.length; i++) {
          const size = businessData.data.leadSizes && businessData.data.leadSizes[i] 
            ? businessData.data.leadSizes[i] 
            : "N/A";
          
          files.push({
            name: businessData.data.leadNames[i],
            type: "CSV Leads",
            size: size,
            category: "lead" as "lead",
            index: i
          });
        }
      }
      
      setBusinessFiles(files);
      
      // Set logo URL if available
      if (businessData.data.logoUrl) {
        setLogoUrl(businessData.data.logoUrl);
      }
    } else if (!isLoading) {
      // Keep current values, only set defaults for new users
      if (!businessName) setBusinessName("Your Business Name");
      if (!businessEmail) setBusinessEmail("contact@yourbusiness.com");
      if (!businessPhone) setBusinessPhone("(123) 456-7890");
      if (!businessAddress) setBusinessAddress("123 Business St, Business City, 12345");
      setBusinessDescription("Describe your business and how the Vox Assistant should represent you.");
    }
  }, [businessData, isLoading]);

  // Save profile to database
  const saveProfileMutation = useMutation({
    mutationFn: async (profileData: any) => {
      const response = await apiRequest("POST", `/api/business/${userId}/profile`, profileData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/business', userId] });
      toast({
        title: "Profile updated",
        description: "Your business profile has been updated and saved successfully."
      });
      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to update profile",
        description: error.message || "There was an error updating your profile. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Save logo to database
  const saveLogoMutation = useMutation({
    mutationFn: async (logoUrl: string) => {
      const response = await apiRequest("POST", `/api/business/${userId}/logo`, { logoUrl });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/business', userId] });
      toast({
        title: "Logo updated",
        description: "Your business logo has been updated successfully."
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update logo",
        description: error.message || "There was an error updating your logo. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Delete document file mutation
  const removeFileMutation = useMutation({
    mutationFn: async (index: number) => {
      const response = await apiRequest("DELETE", `/api/business/${userId}/files/${index}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/business', userId] });
      toast({
        title: "File removed",
        description: "The document has been successfully removed from your profile."
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to remove file",
        description: error.message || "There was an error removing your document. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Delete lead file mutation
  const removeLeadMutation = useMutation({
    mutationFn: async (index: number) => {
      const response = await apiRequest("DELETE", `/api/business/${userId}/leads/${index}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/business', userId] });
      toast({
        title: "Lead file removed",
        description: "The lead file has been successfully removed from your profile."
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to remove lead file",
        description: error.message || "There was an error removing your lead file. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleLogout = () => {
    setLocation("/login");
    toast({
      title: "Logged out",
      description: "You have been successfully logged out."
    });
  };
  
  const handleSaveProfile = () => {
    // Prepare the profile data
    const profileData = {
      businessName,
      businessEmail,
      businessPhone,
      businessAddress,
      description: businessDescription
    };
    
    // Save profile data to database
    saveProfileMutation.mutate(profileData);
    
    // If there's a new logo file, upload it
    if (logoFile) {
      // In a real app, we'd upload the file to a server or storage service
      // For this demo, we'll create an object URL to simulate the upload
      const objectUrl = URL.createObjectURL(logoFile);
      setLogoUrl(objectUrl);
      saveLogoMutation.mutate(objectUrl);
      setLogoFile(null);
    }
  };
  
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please upload an image file",
          variant: "destructive"
        });
        return;
      }
      
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload an image smaller than 2MB",
          variant: "destructive"
        });
        return;
      }

      setLogoFile(file);
      
      // Create a preview
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && typeof event.target.result === 'string') {
          setLogoUrl(event.target.result);
          try {
            // Save the logo to database
            saveLogoMutation.mutate(event.target.result);
            setLogoDialogOpen(false);
          } catch (error) {
            toast({
              title: "Failed to update logo",
              description: "Please try again with a different image",
              variant: "destructive"
            });
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Generate a fallback avatar based on business name
  const getNameInitials = () => {
    if (!businessName) return "BP";
    const words = businessName.split(" ");
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
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
            <h1 className="text-xl md:text-2xl font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2 md:gap-3">
              <Phone className="h-5 w-5 md:h-6 md:w-6 flex-shrink-0" />
              <div className="min-w-0">
                <SkyIQText />
              </div>
              <AudioWave size="sm" className="text-blue-600 flex-shrink-0" />
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
            {logoUrl ? (
              <div className="h-8 w-8 rounded-md overflow-hidden mr-3 flex-shrink-0">
                <img 
                  src={logoUrl} 
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
              {businessName ? `${businessName} Profile` : "Business Profile"}
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
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Business Profile</CardTitle>
                  <CardDescription>Manage your business information and branding</CardDescription>
                </div>
                <div className="flex gap-2">
                  {isEditing ? (
                    <Button 
                      onClick={handleSaveProfile} 
                      className="flex items-center gap-1"
                      disabled={saveProfileMutation.isPending}
                    >
                      <Save className="h-4 w-4" />
                      {saveProfileMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => setIsEditing(true)} className="flex items-center gap-1">
                      <Edit2 className="h-4 w-4" />
                      Edit Profile
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Logo and basic info */}
                <div className="space-y-6">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    {logoUrl ? (
                      <Avatar className="h-32 w-32">
                        <AvatarImage src={logoUrl} alt={businessName} />
                        <AvatarFallback className="text-2xl">{getNameInitials()}</AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="h-32 w-32 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-medium">
                        {getNameInitials()}
                      </div>
                    )}
                    <Dialog open={logoDialogOpen} onOpenChange={setLogoDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">Change Logo</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Upload New Logo</DialogTitle>
                          <DialogDescription>
                            Upload a new logo for your business. This will appear on your profile and in the header.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="flex flex-col items-center justify-center gap-4">
                            <Label htmlFor="logo-upload" className="cursor-pointer bg-gray-100 dark:bg-gray-800 rounded-lg p-8 flex flex-col items-center gap-2">
                              <Upload className="h-8 w-8 text-gray-500" />
                              <span className="text-sm text-gray-500">Click to upload or drag and drop</span>
                              <span className="text-xs text-gray-400">SVG, PNG, JPG (max. 2MB)</span>
                              <Input
                                id="logo-upload"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleLogoChange}
                              />
                            </Label>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setLogoDialogOpen(false)}>Cancel</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="business-name">Business Name</Label>
                      <Input
                        id="business-name"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        disabled={!isEditing}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="business-email">Email Address</Label>
                      <Input
                        id="business-email"
                        type="email"
                        value={businessEmail}
                        onChange={(e) => setBusinessEmail(e.target.value)}
                        disabled={!isEditing}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="business-phone">Phone Number</Label>
                      <Input
                        id="business-phone"
                        value={businessPhone}
                        onChange={(e) => setBusinessPhone(e.target.value)}
                        disabled={!isEditing}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="business-address">Business Address</Label>
                      <Input
                        id="business-address"
                        value={businessAddress}
                        onChange={(e) => setBusinessAddress(e.target.value)}
                        disabled={!isEditing}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Business information */}
                <div className="md:col-span-2 space-y-6">
                  <Tabs defaultValue="description" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="description">Description</TabsTrigger>
                      <TabsTrigger value="links">Links</TabsTrigger>
                      <TabsTrigger value="files">Files</TabsTrigger>
                    </TabsList>
                    <TabsContent value="description" className="p-4 border rounded-md mt-4">
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="business-description">Business Description</Label>
                          <Textarea
                            id="business-description"
                            value={businessDescription}
                            onChange={(e) => setBusinessDescription(e.target.value)}
                            disabled={!isEditing}
                            className="mt-1 h-48"
                            placeholder="Describe your business and how the Vox Assistant should represent you."
                          />
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="links" className="p-4 border rounded-md mt-4">
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Business Links</h3>
                        <p className="text-sm text-gray-500">Links to your business website, social media profiles, or other important resources.</p>
                        
                        {businessLinks.length > 0 ? (
                          <div className="space-y-2">
                            {businessLinks.map((link, index) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                                <div className="flex items-center space-x-3">
                                  <Link className="h-4 w-4 text-gray-500" />
                                  <div>
                                    <p className="font-medium">{link.title}</p>
                                    <p className="text-sm text-gray-500 truncate max-w-[300px]">{link.url}</p>
                                  </div>
                                </div>
                                {isEditing && (
                                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-8 text-center text-gray-500">
                            <Info className="h-12 w-12 mx-auto mb-2 opacity-20" />
                            <p>No links added yet</p>
                            <p className="text-sm">Links added in the Business Context panel will appear here</p>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                    <TabsContent value="files" className="p-4 border rounded-md mt-4">
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Business Files</h3>
                        <p className="text-sm text-gray-500">Documents, presentations, or other files related to your business.</p>
                        
                        {businessFiles.length > 0 ? (
                          <div className="space-y-2">
                            {businessFiles.map((file, index) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                                <div className="flex items-center space-x-3">
                                  <FileText className={`h-4 w-4 ${file.category === "lead" ? "text-blue-500" : "text-gray-500"}`} />
                                  <div>
                                    <div className="flex items-center space-x-2">
                                      <p className="font-medium">{file.name}</p>
                                      {file.category === "lead" && (
                                        <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded">Lead</span>
                                      )}
                                    </div>
                                    <div className="flex space-x-2 text-xs text-gray-500">
                                      <span>{file.type}</span>
                                      <span>•</span>
                                      <span>{file.size}</span>
                                    </div>
                                  </div>
                                </div>
                                {isEditing && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-red-500 hover:text-red-700"
                                    onClick={() => {
                                      // Delete based on file category and index
                                      if (file.category === "document") {
                                        removeFileMutation.mutate(file.index);
                                      } else if (file.category === "lead") {
                                        removeLeadMutation.mutate(file.index);
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-8 text-center text-gray-500">
                            <Info className="h-12 w-12 mx-auto mb-2 opacity-20" />
                            <p>No files added yet</p>
                            <p className="text-sm">Files uploaded in the Business Context panel will appear here</p>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}