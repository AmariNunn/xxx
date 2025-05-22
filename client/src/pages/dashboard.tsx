import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Phone, Users, Info, ArrowRightFromLine, Bell, Settings, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import BusinessContextPanel from "@/components/business-context-panel";

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
import { useLocation } from "wouter";

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

  // For business info form
  const businessInfoForm = useForm<BusinessInfoData>({
    resolver: zodResolver(businessInfoSchema),
    defaultValues: {
      businessDescription: "",
      industry: "",
      targetAudience: "",
    },
  });

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

  const handleFileUpload = () => {
    if (csvFile) {
      toast({
        title: "File uploaded",
        description: `Successfully uploaded ${csvFile.name}`,
      });
      console.log("CSV file uploaded:", csvFile);
      setCsvFile(null);
      // Reset file input
      const fileInput = document.getElementById("csv-upload") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
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
              variant="ghost"
              className="w-full justify-start text-left font-normal hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Info className="mr-3 h-5 w-5" />
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
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Dashboard</h2>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon">
              <Bell className="h-5 w-5" />
            </Button>
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white font-medium">
              JD
            </div>
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
                      {placeholderCalls.map((call) => (
                        <TableRow key={call.id}>
                          <TableCell>{call.date}</TableCell>
                          <TableCell>{call.time}</TableCell>
                          <TableCell>{call.number}</TableCell>
                          <TableCell>{call.duration}</TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                call.status === "Completed"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {call.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-center mt-4">
                  <Button variant="outline">View All Calls</Button>
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