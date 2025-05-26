import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Phone, Settings, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const twilioSettingsSchema = z.object({
  accountSid: z.string().min(34, "Account SID must be 34 characters").startsWith("AC", "Account SID must start with 'AC'"),
  authToken: z.string().min(32, "Auth Token must be at least 32 characters"),
  phoneNumber: z.string().min(10, "Phone number is required").regex(/^\+?[1-9]\d{1,14}$/, "Please enter a valid phone number"),
});

type TwilioSettingsFormData = z.infer<typeof twilioSettingsSchema>;

interface TwilioSettingsProps {
  userId: number;
}

export default function TwilioSettings({ userId }: TwilioSettingsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<TwilioSettingsFormData>({
    resolver: zodResolver(twilioSettingsSchema),
    defaultValues: {
      accountSid: "",
      authToken: "",
      phoneNumber: "",
    },
  });

  // Fetch current Twilio settings
  const { data: twilioSettings, isLoading } = useQuery({
    queryKey: [`/api/twilio/settings/${userId}`],
    enabled: !!userId,
  }) as { data: { connected: boolean; phoneNumber?: string; accountSid?: string } | undefined; isLoading: boolean };

  // Update Twilio settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: TwilioSettingsFormData) => {
      const response = await fetch(`/api/twilio/settings/${userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to connect Twilio account");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Your Twilio account has been connected. Real calls will now be tracked automatically.",
      });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: [`/api/twilio/settings/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/calls/user/${userId}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect Twilio account. Please check your credentials.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TwilioSettingsFormData) => {
    updateSettingsMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Twilio Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  const isConnected = twilioSettings?.connected;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Twilio Integration
          {isConnected && (
            <Badge variant="default" className="bg-green-500 hover:bg-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Connect your Twilio account to automatically track real calls in your dashboard.
          Each call will be logged with details like duration, caller ID, and status.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isConnected && !isEditing ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">
                  Twilio Connected
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  Phone: {twilioSettings.phoneNumber}
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  Account: {twilioSettings.accountSid}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <Button
              onClick={() => setIsEditing(true)}
              variant="outline"
              className="w-full"
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
                  Real Call Tracking Setup
                </p>
                <ol className="list-decimal list-inside space-y-1 text-blue-700 dark:text-blue-300">
                  <li>Log into your Twilio Console at twilio.com</li>
                  <li>Copy your Account SID and Auth Token</li>
                  <li>Enter your Twilio phone number</li>
                  <li>Save settings to start automatic call tracking</li>
                </ol>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="accountSid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account SID</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="authToken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Auth Token</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Your Twilio Auth Token"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="+1234567890"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={updateSettingsMutation.isPending}
                    className="flex-1"
                  >
                    {updateSettingsMutation.isPending ? "Connecting..." : "Connect Twilio"}
                  </Button>
                  {isEditing && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditing(false)}
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