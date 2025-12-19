import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { 
  MessageSquare,
  ArrowLeft,
  Search,
  Trash2,
  Phone,
  Home,
  FileText,
  Bot,
  Building,
  PhoneOutgoing,
  Send,
  ArrowRightFromLine
} from "lucide-react";

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
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import SkyIQText from "@/components/skyiq-text";
import UserAvatar from "@/components/user-avatar";

interface SmsConversation {
  id: number;
  user_id: string;
  phone_number: string;
  message: string;
  direction: 'inbound' | 'outbound';
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  twilio_message_sid: string | null;
  error_message: string | null;
  metadata: any;
  created_at: string;
}

interface ConversationSummary {
  phone_number: string;
  last_message: string;
  last_message_time: string;
  message_count: number;
  direction: 'inbound' | 'outbound';
}

export default function SmsConversationsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);

  // Fetch user profile to get user ID
  const { data: profile } = useQuery<any>({
    queryKey: ['/api/profile'],
  });

  const userId = profile?.id;

  // Fetch all SMS conversations for the user
  const { data: allConversations = [], isLoading } = useQuery<SmsConversation[]>({
    queryKey: ['/api/sms/user', userId],
    enabled: !!userId,
  });

  // Fetch conversation thread for selected phone number
  const { data: threadMessages = [] } = useQuery<SmsConversation[]>({
    queryKey: ['/api/sms/thread', userId, selectedPhone],
    enabled: !!userId && !!selectedPhone,
  });

  // Group conversations by phone number
  const conversationSummaries: ConversationSummary[] = allConversations.reduce((acc: ConversationSummary[], msg: SmsConversation) => {
    const existing = acc.find(s => s.phone_number === msg.phone_number);
    if (existing) {
      existing.message_count++;
      // Update if this message is more recent
      if (new Date(msg.created_at) > new Date(existing.last_message_time)) {
        existing.last_message = msg.message;
        existing.last_message_time = msg.created_at;
        existing.direction = msg.direction;
      }
    } else {
      acc.push({
        phone_number: msg.phone_number,
        last_message: msg.message,
        last_message_time: msg.created_at,
        message_count: 1,
        direction: msg.direction,
      });
    }
    return acc;
  }, []).sort((a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime());

  // Filter conversations by search query
  const filteredConversations = conversationSummaries.filter(conv =>
    conv.phone_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.last_message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Delete all messages for a phone number
  const deleteMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      // Note: This would need a backend endpoint to delete all messages for a phone number
      // For now, we'll show a toast that this feature is coming soon
      throw new Error("Delete endpoint not yet implemented");
    },
    onSuccess: (_, phoneNumber) => {
      queryClient.invalidateQueries({ queryKey: ['/api/sms/user', userId] });
      if (selectedPhone === phoneNumber) {
        setSelectedPhone(null);
      }
      toast({
        title: "Conversation deleted",
        description: "All messages with this number have been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Coming soon",
        description: "Delete functionality will be available in the next update.",
        variant: "default",
      });
    },
  });

  const handleDeleteConversation = (phoneNumber: string) => {
    if (confirm(`Delete all messages with ${phoneNumber}?`)) {
      deleteMutation.mutate(phoneNumber);
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <SkyIQText className="text-white text-xs font-bold" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              SkyIQ
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => navigate("/dashboard")}
            data-testid="link-dashboard"
          >
            <Home className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => navigate("/call-dashboard")}
            data-testid="link-call-dashboard"
          >
            <Phone className="mr-2 h-4 w-4" />
            Call Dashboard
          </Button>
          <Button
            variant="default"
            className="w-full justify-start bg-blue-600 text-white hover:bg-blue-700"
            data-testid="link-sms-conversations"
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            SMS Conversations
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => navigate("/bulk-caller")}
            data-testid="link-bulk-caller"
          >
            <PhoneOutgoing className="mr-2 h-4 w-4" />
            Bulk Caller
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => navigate("/skyiq-agent")}
            data-testid="link-skyiq-agent"
          >
            <Bot className="mr-2 h-4 w-4" />
            SkyIQ Agent
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => navigate("/business-profile")}
            data-testid="link-business-profile"
          >
            <Building className="mr-2 h-4 w-4" />
            Business Profile
          </Button>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <UserAvatar />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-slate-900 dark:text-slate-100">
                {profile?.business_name || profile?.email}
              </p>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                onClick={() => {
                  fetch("/api/logout", { method: "POST" }).then(() => navigate("/login"));
                }}
                data-testid="button-logout"
              >
                <ArrowRightFromLine className="mr-1 h-3 w-3" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
                <MessageSquare className="h-8 w-8 text-blue-600" />
                SMS Conversations
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                View and manage all your AI-powered SMS conversations
              </p>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden p-8">
          <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Conversations List */}
            <Card className="lg:col-span-1 flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Conversations ({filteredConversations.length})
                </CardTitle>
                <CardDescription>
                  Click a number to view the full conversation
                </CardDescription>
                {/* Search */}
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search phone numbers or messages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-conversations"
                  />
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full">
                  {isLoading ? (
                    <div className="p-8 text-center text-slate-500">
                      Loading conversations...
                    </div>
                  ) : filteredConversations.length === 0 ? (
                    <div className="p-8 text-center">
                      <MessageSquare className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                      <p className="text-slate-500">
                        {searchQuery ? "No conversations found" : "No SMS conversations yet"}
                      </p>
                      <p className="text-sm text-slate-400 mt-2">
                        Conversations will appear here when customers text your Twilio number
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filteredConversations.map((conv) => (
                        <div
                          key={conv.phone_number}
                          className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors ${
                            selectedPhone === conv.phone_number ? 'bg-blue-50 dark:bg-blue-950' : ''
                          }`}
                          onClick={() => setSelectedPhone(conv.phone_number)}
                          data-testid={`conversation-${conv.phone_number}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-slate-900 dark:text-slate-100">
                                  {conv.phone_number}
                                </p>
                                <Badge variant={conv.direction === 'inbound' ? 'default' : 'secondary'} className="text-xs">
                                  {conv.direction === 'inbound' ? 'Received' : 'Sent'}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                                {conv.last_message}
                              </p>
                              <div className="flex items-center gap-3 mt-2">
                                <p className="text-xs text-slate-500">
                                  {format(new Date(conv.last_message_time), 'MMM d, h:mm a')}
                                </p>
                                <Badge variant="outline" className="text-xs">
                                  {conv.message_count} {conv.message_count === 1 ? 'message' : 'messages'}
                                </Badge>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteConversation(conv.phone_number);
                              }}
                              data-testid={`button-delete-${conv.phone_number}`}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Conversation Thread */}
            <Card className="lg:col-span-2 flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {selectedPhone ? (
                    <>
                      <MessageSquare className="h-5 w-5" />
                      {selectedPhone}
                    </>
                  ) : (
                    <>
                      <MessageSquare className="h-5 w-5" />
                      Select a Conversation
                    </>
                  )}
                </CardTitle>
                {selectedPhone && (
                  <CardDescription>
                    Full conversation history with this number
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                {!selectedPhone ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <MessageSquare className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                      <p className="text-slate-500">Select a conversation to view messages</p>
                    </div>
                  </div>
                ) : (
                  <ScrollArea className="h-full p-6">
                    <div className="space-y-4">
                      {threadMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                          data-testid={`message-${msg.id}`}
                        >
                          <div className={`max-w-[70%] ${msg.direction === 'outbound' ? 'order-2' : 'order-1'}`}>
                            <div className={`rounded-lg p-4 ${
                              msg.direction === 'outbound'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                            }`}>
                              <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                            </div>
                            <div className={`mt-1 flex items-center gap-2 text-xs text-slate-500 ${
                              msg.direction === 'outbound' ? 'justify-end' : 'justify-start'
                            }`}>
                              <span>{format(new Date(msg.created_at), 'MMM d, h:mm a')}</span>
                              {msg.direction === 'outbound' && (
                                <>
                                  <span>•</span>
                                  <Badge
                                    variant={msg.status === 'delivered' ? 'default' : msg.status === 'failed' ? 'destructive' : 'secondary'}
                                    className="text-xs"
                                  >
                                    {msg.status}
                                  </Badge>
                                </>
                              )}
                            </div>
                            {msg.error_message && (
                              <p className="mt-1 text-xs text-red-500">Error: {msg.error_message}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
