import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Upload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const batchCallSchema = z.object({
  batchName: z.string().min(1, "Batch name is required"),
  recipients: z.string().min(1, "At least one phone number is required"),
  scheduledDateTime: z.string().optional(),
});

type BatchCallFormData = z.infer<typeof batchCallSchema>;

interface BulkCallerProps {
  userId: string;
}

export default function BulkCaller({ userId }: BulkCallerProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<BatchCallFormData>({
    resolver: zodResolver(batchCallSchema),
    defaultValues: {
      batchName: "",
      recipients: "",
      scheduledDateTime: "",
    },
  });

  // Parse phone numbers from text (one per line or comma-separated)
  const parsePhoneNumbers = (text: string): Array<{ phone_number: string }> => {
    const lines = text.split(/[\n,]/).map(line => line.trim()).filter(Boolean);
    return lines.map(phone => ({ phone_number: phone }));
  };

  // Parse CSV file
  const parseCsvFile = async (file: File): Promise<Array<{ phone_number: string; name?: string }>> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        // Skip header row if it exists
        const dataLines = lines.slice(1);
        
        const recipients = dataLines.map(line => {
          const parts = line.split(',').map(p => p.trim());
          // Assume format: phone_number, name (optional)
          return {
            phone_number: parts[0],
            ...(parts[1] && { name: parts[1] })
          };
        }).filter(r => r.phone_number);
        
        resolve(recipients);
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  // Create batch call mutation
  const createBatchMutation = useMutation({
    mutationFn: async (data: BatchCallFormData) => {
      let recipients;
      
      if (csvFile) {
        recipients = await parseCsvFile(csvFile);
      } else {
        recipients = parsePhoneNumbers(data.recipients);
      }

      if (recipients.length === 0) {
        throw new Error("No valid phone numbers found");
      }

      // Convert scheduled datetime to unix timestamp if provided
      let scheduledTimeUnix;
      if (data.scheduledDateTime) {
        scheduledTimeUnix = Math.floor(new Date(data.scheduledDateTime).getTime() / 1000);
      }

      const response = await fetch(`/api/elevenlabs/batch-call/${userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          batchName: data.batchName,
          recipients,
          ...(scheduledTimeUnix && { scheduledTimeUnix }),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create batch call");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Batch Call Created!",
        description: `Successfully scheduled ${data.data.total_calls_scheduled} calls. Check the history below for status updates.`,
      });
      form.reset();
      setCsvFile(null);
      queryClient.invalidateQueries({ queryKey: [`/api/elevenlabs/batches/${userId}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Create Batch Call",
        description: error.message || "Please check your inputs and try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BatchCallFormData) => {
    createBatchMutation.mutate(data);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
      toast({
        title: "CSV File Loaded",
        description: `${file.name} ready to process`,
      });
    } else {
      toast({
        title: "Invalid File",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
    }
  };

  return (
    <Card data-testid="card-bulk-caller">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Bulk Call Campaign
        </CardTitle>
        <CardDescription>
          Create a batch call campaign to reach multiple contacts at once using your ElevenLabs AI agent.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="batchName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Campaign Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Q1 Sales Outreach" 
                      {...field}
                      data-testid="input-batch-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <FormLabel>Upload CSV File</FormLabel>
                  <div className="mt-2">
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      disabled={createBatchMutation.isPending}
                      data-testid="input-csv-file"
                      className="cursor-pointer"
                    />
                  </div>
                  {csvFile && (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1" data-testid="text-csv-filename">
                      ✓ {csvFile.name}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Format: phone_number, name (one per line)
                  </p>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="h-px w-8 bg-border" />
                  <span className="text-sm">OR</span>
                  <div className="h-px w-8 bg-border" />
                </div>

                <div className="flex-1" />
              </div>

              <FormField
                control={form.control}
                name="recipients"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Enter Phone Numbers</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter phone numbers (one per line or comma-separated)&#10;+1234567890&#10;+0987654321"
                        rows={6}
                        {...field}
                        disabled={createBatchMutation.isPending || !!csvFile}
                        data-testid="textarea-recipients"
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      {csvFile ? "CSV file will be used" : "One phone number per line or comma-separated"}
                    </p>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="scheduledDateTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Schedule for Later (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      {...field}
                      disabled={createBatchMutation.isPending}
                      data-testid="input-scheduled-time"
                      min={new Date().toISOString().slice(0, 16)}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to start calls immediately
                  </p>
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={createBatchMutation.isPending}
              className="w-full"
              data-testid="button-create-batch"
            >
              {createBatchMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Batch Call...
                </>
              ) : (
                <>
                  <Phone className="mr-2 h-4 w-4" />
                  Create Batch Call
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
