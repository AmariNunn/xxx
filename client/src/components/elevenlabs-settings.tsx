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
import { Mic, Settings, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const elevenlabsSettingsSchema = z.object({
  apiKey: z.string().min(1, "API Key is required"),
  agentId: z.string().min(1, "Agent ID is required"),
  phoneNumberId: z.string().min(1, "Phone Number ID is required"),
});

type ElevenLabsSettingsFormData = z.infer<typeof elevenlabsSettingsSchema>;

interface ElevenLabsSettingsProps {
  userId: string;
}

export default function ElevenLabsSettings({ userId }: ElevenLabsSettingsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ElevenLabsSettingsFormData>({
    resolver: zodResolver(elevenlabsSettingsSchema),
    defaultValues: {
      apiKey: "",
      agentId: "",
      phoneNumberId: "",
    },
  });

  // Fetch current ElevenLabs settings
  const { data: elevenLabsSettings, isLoading } = useQuery({
    queryKey: [`/api/elevenlabs/settings/${userId}`],
    enabled: !!userId,
  }) as { data: { connected: boolean; agentId?: string; apiKey?: string; phoneNumberId?: string } | undefined; isLoading: boolean };

  // Update ElevenLabs settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: ElevenLabsSettingsFormData) => {
      const response = await fetch(`/api/elevenlabs/settings/${userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to connect ElevenLabs account");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Your ElevenLabs credentials have been saved. Your account will now use these credentials for outbound calls.",
      });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: [`/api/elevenlabs/settings/${userId}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to save ElevenLabs credentials. Please check your details.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ElevenLabsSettingsFormData) => {
    updateSettingsMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            ElevenLabs Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  const isConnected = elevenLabsSettings?.connected || false;

  return (
    <Card data-testid="card-elevenlabs-settings">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5" />
          ElevenLabs Integration
          {isConnected && (
            <Badge variant="default" className="bg-green-500 hover:bg-green-600" data-testid="badge-connected">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Connect your ElevenLabs account to use your own AI voice agent for outbound calls.
          Enter your ElevenLabs credentials below to enable personalized call functionality.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isConnected && !isEditing ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">
                  ElevenLabs Connected
                </p>
                <p className="text-sm text-green-600 dark:text-green-400" data-testid="text-agent-id">
                  Agent ID: {elevenLabsSettings?.agentId || 'Not set'}
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  API Key: {elevenLabsSettings?.apiKey || 'Not set'}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
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
                  ElevenLabs Setup
                </p>
                <ol className="list-decimal list-inside space-y-1 text-blue-700 dark:text-blue-300">
                  <li>Log into your ElevenLabs account at elevenlabs.io</li>
                  <li>Go to Settings → API Keys and copy your API Key</li>
                  <li>Create or find your Agent ID in the Conversational AI section</li>
                  <li>Get your Phone Number ID from your phone number settings</li>
                  <li>Enter all three credentials below and save</li>
                </ol>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="apiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Key</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          {...field}
                          data-testid="input-api-key"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="agentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent ID</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="agent_xxxxxxxxxxxxxxxxxxxxxxxx"
                          {...field}
                          data-testid="input-agent-id"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phoneNumberId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number ID</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="pn_xxxxxxxxxxxxxxxxxxxxxxxx"
                          {...field}
                          data-testid="input-phone-number-id"
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
                    data-testid="button-save"
                  >
                    {updateSettingsMutation.isPending ? "Saving..." : "Save Credentials"}
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
