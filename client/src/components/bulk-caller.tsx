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

  // Normalize phone number to E.164 format (required by ElevenLabs)
  const normalizePhoneNumber = (phone: string): string => {
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');
    
    // If it already starts with +, return as-is
    if (phone.trim().startsWith('+')) {
      return phone.trim();
    }
    
    // If it's 11 digits and starts with 1, add + prefix (US number)
    if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      return `+${digitsOnly}`;
    }
    
    // If it's 10 digits, assume US and add +1 prefix
    if (digitsOnly.length === 10) {
      return `+1${digitsOnly}`;
    }
    
    // For other cases, just add + if it has digits
    if (digitsOnly.length > 0) {
      return `+${digitsOnly}`;
    }
    
    return phone;
  };

  // Parse phone numbers from text (one per line)
  // Supports formats: 
  // - Just phone: "+1234567890" or "1234567890"
  // - With name: "+1234567890, John Doe" or "John Doe, +1234567890"
  const parsePhoneNumbers = (text: string): Array<{ phone_number: string; name?: string }> => {
    const lines = text.split(/[\n]/).map(line => line.trim()).filter(Boolean);
    return lines.map(line => {
      // Check if line contains a comma (separating phone and name)
      if (line.includes(',')) {
        const parts = line.split(',').map(p => p.trim());
        // Determine which part is the phone number (contains digits and +)
        const phoneIndex = parts.findIndex(p => /[\d+]/.test(p));
        if (phoneIndex !== -1) {
          const phone = parts[phoneIndex];
          const nameIndex = phoneIndex === 0 ? 1 : 0;
          const name = parts[nameIndex];
          return {
            phone_number: normalizePhoneNumber(phone),
            ...(name && { name })
          };
        }
      }
      // No comma, just phone number
      return { phone_number: normalizePhoneNumber(line) };
    }).filter(r => r.phone_number);
  };

  // Parse CSV file - supports ElevenLabs format with custom columns
  const parseCsvFile = async (file: File): Promise<Array<any>> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length === 0) {
          resolve([]);
          return;
        }
        
        // Parse header row to get column names
        const headers = lines[0].split(',').map(h => h.trim());
        const phoneIndex = headers.findIndex(h => h.toLowerCase() === 'phone_number');
        
        if (phoneIndex === -1) {
          reject(new Error('CSV must have a phone_number column'));
          return;
        }
        
        // Parse data rows
        const dataLines = lines.slice(1);
        const recipients = dataLines.map(line => {
          const values = line.split(',').map(v => v.trim());
          const recipient: any = {};
          
          // Map all columns to the recipient object
          headers.forEach((header, index) => {
            const value = values[index];
            if (value) {
              if (header.toLowerCase() === 'phone_number') {
                recipient.phone_number = normalizePhoneNumber(value);
              } else {
                recipient[header] = value;
              }
            }
          });
          
          return recipient;
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
      console.log('🔍 Starting batch call creation...');
      console.log('User ID:', userId);
      
      let recipients;
      
      if (csvFile) {
        recipients = await parseCsvFile(csvFile);
      } else {
        recipients = parsePhoneNumbers(data.recipients);
      }

      console.log('📞 Recipients parsed:', recipients);

      if (recipients.length === 0) {
        throw new Error("No valid phone numbers found");
      }

      // Convert scheduled datetime to unix timestamp if provided
      let scheduledTimeUnix;
      if (data.scheduledDateTime) {
        scheduledTimeUnix = Math.floor(new Date(data.scheduledDateTime).getTime() / 1000);
      }

      const url = `/api/elevenlabs/batch-call/${userId}`;
      const payload = {
        batchName: data.batchName,
        recipients,
        ...(scheduledTimeUnix && { scheduledTimeUnix }),
      };

      console.log('🚀 Making request to:', url);
      console.log('📦 Payload:', payload);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', response.headers);

      // Read response body once as text
      const responseText = await response.text();
      console.log('📡 Response body (first 500 chars):', responseText.substring(0, 500));

      // Try to parse as JSON
      let responseData;
      try {
        responseData = JSON.parse(responseText);
        console.log('✅ Successfully parsed JSON:', responseData);
      } catch (e) {
        console.error('❌ Failed to parse as JSON');
        console.error('❌ Response was:', responseText.substring(0, 500));
        throw new Error(`Server returned invalid JSON. Response: ${responseText.substring(0, 200)}`);
      }

      if (!response.ok) {
        const errorMessage = responseData.message || "Failed to create batch call";
        throw new Error(errorMessage);
      }

      return responseData;
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
                    CSV must include phone_number column. Optional: name, city, or any custom fields for personalization.
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
                        placeholder="Enter phone numbers (one per line)&#10;+1234567890, John Doe&#10;Jane Smith, +0987654321&#10;+1122334455"
                        rows={6}
                        {...field}
                        disabled={createBatchMutation.isPending || !!csvFile}
                        data-testid="textarea-recipients"
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      {csvFile ? "CSV file will be used" : "One per line. Format: phone or phone, name"}
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
