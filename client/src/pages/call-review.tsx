import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Clock
} from "lucide-react";
import AudioWave from "@/components/audio-wave";
import SkyIQText from "@/components/skyiq-text";
import UserAvatar from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

export default function CallReview() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [businessLogo, setBusinessLogo] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>("");

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

  // Calculate analytics
  const totalCalls = calls.length;
  const completedCalls = calls.filter((call: any) => call.status === 'completed').length;
  const missedCalls = calls.filter((call: any) => call.status === 'missed').length;
  const failedCalls = calls.filter((call: any) => call.status === 'failed').length;
  
  const callsWithDuration = calls.filter((call: any) => call.duration);
  const totalDuration = callsWithDuration.reduce((sum: number, call: any) => {
    return sum + (call.duration || 0);
  }, 0);
  const avgDuration = callsWithDuration.length > 0 ? Math.round(totalDuration / callsWithDuration.length) : 0;

  // Generate PDF report
  const downloadPDFReport = () => {
    const reportContent = generateReportHTML();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(reportContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
    
    toast({
      title: "PDF Report Ready",
      description: "Print dialog opened. Save as PDF to download your call review report.",
    });
  };

  // Generate transcript download
  const downloadTranscript = (call: any) => {
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
${call.transcript || 'Full conversation transcript will appear here once call recording is enabled for your account.'}

---
Generated: ${new Date().toLocaleString()}
Source: ${call.isFromTwilio ? 'Automatically Captured' : 'Manual Entry'}`;

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

  

  const generateReportHTML = () => {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Call Review Report - ${businessName}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0; }
        .stat-card { padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .call-item { margin: 15px 0; padding: 15px; border-left: 4px solid #2563eb; background: #f8f9fa; }
        .priority { border-left-color: #dc2626; }
        .completed { border-left-color: #16a34a; }
        .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔴 LIVE CALL OPERATIONS REPORT</h1>
        <h2>${businessName}</h2>
        <p>Generated: ${new Date().toLocaleString()}</p>
    </div>

    <div class="stats-grid">
        <div class="stat-card">
            <h3>📊 Call Overview</h3>
            <p><strong>Total Calls:</strong> ${totalCalls}</p>
            <p><strong>Completed:</strong> ${completedCalls} (${totalCalls > 0 ? Math.round(completedCalls/totalCalls * 100) : 0}%)</p>
            <p><strong>Missed:</strong> ${missedCalls}</p>
            <p><strong>Failed:</strong> ${failedCalls}</p>
        </div>
        <div class="stat-card">
            <h3>⏱️ Performance</h3>
            <p><strong>Success Rate:</strong> ${totalCalls > 0 ? Math.round(completedCalls/totalCalls * 100) : 0}%</p>
            <p><strong>Avg Duration:</strong> ${Math.floor(avgDuration / 60)}m ${avgDuration % 60}s</p>
            <p><strong>Total Talk Time:</strong> ${Math.floor(totalDuration / 60)}m ${totalDuration % 60}s</p>
        </div>
    </div>

    <h3>🚨 Priority Callbacks</h3>
    ${calls.filter((call: any) => call.status === 'missed').map((call: any) => `
    <div class="call-item priority">
        <strong>${call.contactName || call.phoneNumber}</strong><br>
        <em>Missed: ${call.createdAt ? new Date(call.createdAt).toLocaleDateString() : 'Recently'}</em><br>
        Action: CALL BACK IMMEDIATELY
    </div>`).join('') || '<p>✅ No urgent callbacks needed</p>'}

    <h3>📞 Recent Call Details</h3>
    ${calls.slice(-10).map((call: any) => `
    <div class="call-item ${call.status === 'completed' ? 'completed' : ''}">
        <strong>${call.contactName || call.phoneNumber}</strong><br>
        <em>${call.createdAt ? new Date(call.createdAt).toLocaleDateString() : 'Recent'} - ${call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : 'N/A'}</em><br>
        <strong>Status:</strong> ${call.status?.toUpperCase() || 'UNKNOWN'}<br>
        <strong>Summary:</strong> ${call.summary || 'No summary'}<br>
        <strong>Notes:</strong> ${call.notes || 'No notes'}
    </div>`).join('')}

    <div class="footer">
        <p>Report generated from VoxIntel Platform</p>
        <p>Data includes both manual entries and integrated call tracking</p>
    </div>
</body>
</html>`;
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
          <div className="flex items-center gap-4">
            <Button 
              onClick={downloadPDFReport}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Download className="mr-2 h-4 w-4" />
              Download PDF Report
            </Button>
            <Button variant="outline" size="icon">
              <Bell className="h-5 w-5" />
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
                  <Phone className="h-8 w-8 text-blue-600" />
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
                  <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 font-bold">✓</span>
                  </div>
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
                  <Clock className="h-8 w-8 text-orange-600" />
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
                  <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600 font-bold">!</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Missed Calls</p>
                    <p className="text-2xl font-bold">{missedCalls}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

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
                          <h4 className="font-semibold">{call.contactName || call.phoneNumber}</h4>
                          <p className="text-sm text-gray-600">
                            {call.createdAt ? new Date(call.createdAt).toLocaleDateString() : 'Recent'} • 
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
                          <><Volume2 className="h-3 w-3" /> Automatically captured</>
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