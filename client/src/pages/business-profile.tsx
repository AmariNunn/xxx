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
  Users,
  Upload,
  Link,
  FileText,
  Building,
  Edit2,
  Save
} from "lucide-react";

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
  const [businessFiles, setBusinessFiles] = useState<{name: string, type: string, size: string}[]>([]);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  
  // Dialog state for logo upload
  const [logoDialogOpen, setLogoDialogOpen] = useState(false);
  
  // Mock data load - would be replaced with API call
  useEffect(() => {
    // Simulating data load
    const mockBusinessData = {
      name: "Acme Corporation",
      email: "contact@acmecorp.com",
      phone: "(555) 123-4567",
      address: "123 Business Ave, Suite 100, San Francisco, CA 94107",
      description: "Acme Corporation is a leading provider of innovative solutions for businesses of all sizes. We specialize in AI-powered communication tools that help businesses connect with their customers more effectively.",
      links: [
        { title: "Company Website", url: "https://www.acmecorp.com" },
        { title: "Product Documentation", url: "https://docs.acmecorp.com" }
      ],
      files: [
        { name: "Company Brochure.pdf", type: "PDF", size: "2.4 MB" },
        { name: "Service Agreement.docx", type: "DOCX", size: "1.2 MB" }
      ],
      logoUrl: ""
    };
    
    setBusinessName(mockBusinessData.name);
    setBusinessEmail(mockBusinessData.email);
    setBusinessPhone(mockBusinessData.phone);
    setBusinessAddress(mockBusinessData.address);
    setBusinessDescription(mockBusinessData.description);
    setBusinessLinks(mockBusinessData.links);
    setBusinessFiles(mockBusinessData.files);
    setLogoUrl(mockBusinessData.logoUrl);
  }, []);

  const handleLogout = () => {
    setLocation("/login");
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
  };
  
  const handleSaveProfile = () => {
    // In a real app, we would save this to the database
    // For now, just show success toast
    toast({
      title: "Profile updated",
      description: "Your business profile has been updated successfully."
    });
    setIsEditing(false);
    
    // If there's a new logo file, we'd upload it and update the URL
    if (logoFile) {
      // Simulate a file upload by creating an object URL
      const objectUrl = URL.createObjectURL(logoFile);
      setLogoUrl(objectUrl);
      setLogoFile(null);
      
      // In a real app, we'd upload the file to a server or storage
      console.log("Would upload file:", logoFile.name);
    }
  };
  
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      
      // Create a preview
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && typeof event.target.result === 'string') {
          setLogoUrl(event.target.result);
        }
      };
      reader.readAsDataURL(file);
      
      setLogoDialogOpen(false);
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
              <Phone className="mr-3 h-5 w-5" />
              Dashboard
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
              variant="ghost"
              className="w-full justify-start text-left font-normal hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Users className="mr-3 h-5 w-5" />
              Leads Manager
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
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Business Profile</h2>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon">
              <Bell className="h-5 w-5" />
            </Button>
            {logoUrl ? (
              <Avatar className="h-8 w-8">
                <AvatarImage src={logoUrl} alt={businessName} />
                <AvatarFallback>{getNameInitials()}</AvatarFallback>
              </Avatar>
            ) : (
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white font-medium">
                {getNameInitials()}
              </div>
            )}
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
                    <Button onClick={handleSaveProfile} className="flex items-center gap-1">
                      <Save className="h-4 w-4" />
                      Save Changes
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
                        <Button variant="outline" className="mt-2">Change Logo</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Upload Company Logo</DialogTitle>
                          <DialogDescription>
                            Upload a square image for best results. JPG, PNG, and SVG formats are supported.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <Label htmlFor="logo-upload">Logo Image</Label>
                          <Input
                            id="logo-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleLogoChange}
                          />
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setLogoDialogOpen(false)}>
                            Cancel
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="business-name">Business Name</Label>
                      <Input
                        id="business-name"
                        placeholder="Your Business Name"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        disabled={!isEditing}
                      />
                    </div>
                    <div>
                      <Label htmlFor="business-email">Email</Label>
                      <Input
                        id="business-email"
                        placeholder="contact@yourbusiness.com"
                        value={businessEmail}
                        onChange={(e) => setBusinessEmail(e.target.value)}
                        disabled={!isEditing}
                      />
                    </div>
                    <div>
                      <Label htmlFor="business-phone">Phone</Label>
                      <Input
                        id="business-phone"
                        placeholder="(123) 456-7890"
                        value={businessPhone}
                        onChange={(e) => setBusinessPhone(e.target.value)}
                        disabled={!isEditing}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Business details */}
                <div className="md:col-span-2 space-y-6">
                  <Tabs defaultValue="details">
                    <TabsList className="mb-4">
                      <TabsTrigger value="details">Details</TabsTrigger>
                      <TabsTrigger value="resources">Resources</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="details" className="space-y-6">
                      <div>
                        <Label htmlFor="business-address">Address</Label>
                        <Input
                          id="business-address"
                          placeholder="Your Business Address"
                          value={businessAddress}
                          onChange={(e) => setBusinessAddress(e.target.value)}
                          disabled={!isEditing}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="business-description">Business Description</Label>
                        <Textarea
                          id="business-description"
                          placeholder="Describe your business..."
                          className="min-h-[150px]"
                          value={businessDescription}
                          onChange={(e) => setBusinessDescription(e.target.value)}
                          disabled={!isEditing}
                        />
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="resources" className="space-y-6">
                      {/* Business Links */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label>Important Links</Label>
                          {isEditing && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setBusinessLinks([...businessLinks, { title: "", url: "" }])}
                            >
                              Add Link
                            </Button>
                          )}
                        </div>
                        {businessLinks.length === 0 ? (
                          <div className="text-sm text-gray-500">No links added yet.</div>
                        ) : (
                          <div className="space-y-2">
                            {businessLinks.map((link, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <Link className="h-4 w-4 flex-shrink-0 text-gray-500" />
                                {isEditing ? (
                                  <div className="flex-1 grid grid-cols-2 gap-2">
                                    <Input
                                      placeholder="Link Title"
                                      value={link.title}
                                      onChange={(e) => {
                                        const updatedLinks = [...businessLinks];
                                        updatedLinks[index].title = e.target.value;
                                        setBusinessLinks(updatedLinks);
                                      }}
                                    />
                                    <Input
                                      placeholder="URL"
                                      value={link.url}
                                      onChange={(e) => {
                                        const updatedLinks = [...businessLinks];
                                        updatedLinks[index].url = e.target.value;
                                        setBusinessLinks(updatedLinks);
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <div className="flex-1">
                                    <a 
                                      href={link.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-primary hover:underline"
                                    >
                                      {link.title}
                                    </a>
                                    <span className="text-sm text-gray-500 ml-2">({link.url})</span>
                                  </div>
                                )}
                                {isEditing && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const updatedLinks = [...businessLinks];
                                      updatedLinks.splice(index, 1);
                                      setBusinessLinks(updatedLinks);
                                    }}
                                  >
                                    Remove
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Business Files */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label>Documents & Files</Label>
                          {isEditing && (
                            <Button variant="outline" size="sm">
                              Upload File
                            </Button>
                          )}
                        </div>
                        {businessFiles.length === 0 ? (
                          <div className="text-sm text-gray-500">No files uploaded yet.</div>
                        ) : (
                          <div className="space-y-2">
                            {businessFiles.map((file, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <FileText className="h-4 w-4 flex-shrink-0 text-gray-500" />
                                <div className="flex-1">
                                  <span className="font-medium">{file.name}</span>
                                  <span className="text-sm text-gray-500 ml-2">
                                    {file.type} • {file.size}
                                  </span>
                                </div>
                                {isEditing && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const updatedFiles = [...businessFiles];
                                      updatedFiles.splice(index, 1);
                                      setBusinessFiles(updatedFiles);
                                    }}
                                  >
                                    Remove
                                  </Button>
                                )}
                              </div>
                            ))}
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