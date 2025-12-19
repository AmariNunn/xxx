import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Calendar, Settings, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const calComSettingsSchema = z.object({
  apiKey: z.string().min(1, "Cal.com API Key is required"),
  eventTypeId: z.string().min(1, "Event Type ID is required"),
  enabled: z.boolean().default(false),
});

type CalComSettingsFormData = z.infer<typeof calComSettingsSchema>;

interface CalComSettingsProps {
  userId: string;
}

export default function CalComSettings({ userId }: CalComSettingsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CalComSettingsFormData>({
    resolver: zodResolver(calComSettingsSchema),
    defaultValues: {
      apiKey: "",
      eventTypeId: "",
      enabled: false,
    },
  });

  // Fetch current Cal.com settings
  const { data: calComSettings, isLoading } = useQuery({
    queryKey: [`/api/calcom/settings/${userId}`],
    enabled: !!userId,
  }) as { data: { connected: boolean; eventTypeId?: string; apiKey?: string; enabled?: boolean } | undefined; isLoading: boolean };

  // Update Cal.com settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: CalComSettingsFormData) => {
      const response = await fetch(`/api/calcom/settings/${userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save Cal.com settings");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success!",
        description: data.enabled 
          ? "Cal.com has been enabled. Your AI agent can now book appointments during calls!"
          : "Cal.com settings saved. Enable it to allow appointment booking.",
      });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: [`/api/calcom/settings/${userId}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save Cal.com settings. Please check your credentials.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CalComSettingsFormData) => {
    updateSettingsMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Cal.com Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  const isConnected = calComSettings?.connected || false;
  const isEnabled = calComSettings?.enabled || false;

  return (
    <Card data-testid="card-calcom-settings">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Cal.com Integration
          {isConnected && (
            <Badge variant="default" className={isEnabled ? "" : "bg-gray-400 hover:bg-gray-500"} style={isEnabled ? { backgroundColor: '#009AEE' } : {}} data-testid="badge-connected">
              <CheckCircle className="h-3 w-3 mr-1" />
              {isEnabled ? "Enabled" : "Connected"}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Let your AI agent book appointments in Cal.com during phone calls. 
          Your agent will check availability and schedule meetings automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isConnected && !isEditing ? (
          <div className="space-y-4">
            <div className={`flex items-center justify-between p-4 rounded-lg border ${isEnabled ? 'bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800' : 'bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800'}`}>
              <div>
                <p className={`font-medium ${isEnabled ? '' : 'text-gray-800 dark:text-gray-200'}`} style={isEnabled ? { color: '#007ACC' } : {}}>
                  Cal.com {isEnabled ? "Enabled" : "Connected"}
                </p>
                <p className={`text-sm ${isEnabled ? '' : 'text-gray-600 dark:text-gray-400'}`} style={isEnabled ? { color: '#009AEE' } : {}} data-testid="text-event-type-id">
                  Event Type ID: {calComSettings?.eventTypeId || 'Not set'}
                </p>
                {isEnabled && (
                  <p className="text-sm" style={{ color: '#009AEE' }}>
                    AI agent can book appointments during calls
                  </p>
                )}
              </div>
              {isEnabled ? (
                <CheckCircle className="h-8 w-8" style={{ color: '#009AEE' }} />
              ) : (
                <AlertCircle className="h-8 w-8 text-gray-400" />
              )}
            </div>
            <Button
              onClick={() => setIsEditing(true)}
              variant="outline"
              className="w-full"
              data-testid="button-update-settings"
            >
              <Settings className="h-4 w-4 mr-2" />
              Update Settings
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                  Cal.com Setup Instructions
                </p>
                <ol className="list-decimal list-inside space-y-1 text-blue-700 dark:text-blue-300">
                  <li>Log into your Cal.com account at cal.com</li>
                  <li>Go to Settings → Developer → API Keys</li>
                  <li>Create a new API key and copy it</li>
                  <li>Go to Event Types and find your event type</li>
                  <li>Copy the Event Type ID from the URL (number after /event-types/)</li>
                  <li>Enter both credentials below</li>
                  <li>Enable Cal.com to allow your AI to book appointments</li>
                </ol>
                <a 
                  href="https://cal.com/docs/api-reference/v2/introduction" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 mt-3 text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View Cal.com API Docs
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="apiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cal.com API Key</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="cal_live_xxxxxxxxxxxxxxxxxxxxxxxx"
                          {...field}
                          data-testid="input-api-key"
                        />
                      </FormControl>
                      <FormDescription>
                        Your Cal.com API key (starts with cal_live_)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="eventTypeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Type ID</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="123456"
                          {...field}
                          data-testid="input-event-type-id"
                        />
                      </FormControl>
                      <FormDescription>
                        The ID of the event type to book (numeric value from your Cal.com event type URL)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Enable Cal.com Booking
                        </FormLabel>
                        <FormDescription>
                          Allow your AI agent to book appointments in Cal.com during calls
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-enabled"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={updateSettingsMutation.isPending}
                    className="flex-1"
                    data-testid="button-save"
                  >
                    {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                  </Button>
                  {isEditing && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
