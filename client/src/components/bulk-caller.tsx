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
import { Phone, Upload, Loader2, FileText, Edit3, Info, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
        // Phone number pattern: starts with optional +, followed by continuous digits (at least 10)
        const phonePattern = /^\+?\d{10,}$/;
        const phoneIndex = parts.findIndex(p => phonePattern.test(p.replace(/[\s-()]/g, '')));
        
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
    <div className="space-y-6">
      {/* Header with gradient */}
      <div className="relative overflow-hidden rounded-lg border bg-gradient-to-br from-primary/10 via-primary/5 to-background p-8">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Phone className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Bulk Caller</h2>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Reach multiple contacts simultaneously with AI-powered batch calling. Personalize each call with dynamic variables like names, cities, and custom fields.
          </p>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Personalization Info Alert */}
      <Alert className="border-primary/20 bg-primary/5">
        <Sparkles className="h-4 w-4 text-primary" />
        <AlertDescription>
          <strong className="text-primary">Pro tip:</strong> Add custom fields like <code className="px-1.5 py-0.5 rounded bg-background/50">name</code>, <code className="px-1.5 py-0.5 rounded bg-background/50">city</code>, or <code className="px-1.5 py-0.5 rounded bg-background/50">company</code> to personalize each call. Use <code className="px-1.5 py-0.5 rounded bg-background/50">{"{{name}}"}</code> in your AI agent's prompt to reference them!
        </AlertDescription>
      </Alert>

      <Card data-testid="card-bulk-caller" className="border-2">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-xl">Create Batch Campaign</CardTitle>
          <CardDescription>
            Choose between manual entry or CSV upload to add your recipients
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Campaign Name */}
              <FormField
                control={form.control}
                name="batchName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-semibold">Campaign Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., Q1 Sales Outreach" 
                        {...field}
                        data-testid="input-batch-name"
                        className="h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid md:grid-cols-2 gap-6">
                {/* CSV Upload Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Upload className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-base">Option 1: Upload CSV</h3>
                  </div>
                  
                  <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
                    <CardContent className="pt-6">
                      <Input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        disabled={createBatchMutation.isPending}
                        data-testid="input-csv-file"
                        className="cursor-pointer h-11"
                      />
                      {csvFile && (
                        <div className="mt-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                          <p className="text-sm text-green-700 dark:text-green-400 font-medium flex items-center gap-2" data-testid="text-csv-filename">
                            <FileText className="h-4 w-4" />
                            {csvFile.name}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* CSV Format Guide */}
                  <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <div className="space-y-2 text-sm">
                        <p className="font-semibold">CSV Format Requirements:</p>
                        <div className="space-y-1 text-muted-foreground">
                          <p>• <strong>Required:</strong> <code className="px-1 py-0.5 rounded bg-background text-xs">phone_number</code> column</p>
                          <p>• <strong>Optional:</strong> Any custom columns become variables</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-2 border-t">
                      <p className="text-xs font-semibold mb-2 text-muted-foreground">Example CSV:</p>
                      <pre className="text-xs bg-background p-3 rounded border overflow-x-auto">
{`phone_number,name,city,company
+12345678900,John Doe,Nashville,Acme Corp
+14155551234,Jane Smith,San Francisco,Tech Inc
+16175559876,Bob Johnson,Boston,StartupXYZ`}
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Manual Entry Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Edit3 className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-base">Option 2: Manual Entry</h3>
                  </div>

                  <FormField
                    control={form.control}
                    name="recipients"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder="Enter phone numbers (one per line)..."
                            rows={10}
                            {...field}
                            disabled={createBatchMutation.isPending || !!csvFile}
                            data-testid="textarea-recipients"
                            className="font-mono text-sm"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Manual Entry Format Guide */}
                  <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <div className="space-y-2 text-sm">
                        <p className="font-semibold">Format Options:</p>
                        <div className="space-y-1 text-muted-foreground">
                          <p>• Phone only: <code className="px-1 py-0.5 rounded bg-background text-xs">+1234567890</code></p>
                          <p>• With name: <code className="px-1 py-0.5 rounded bg-background text-xs">+1234567890, John Doe</code></p>
                          <p>• Name first: <code className="px-1 py-0.5 rounded bg-background text-xs">Jane Smith, +1234567890</code></p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-2 border-t">
                      <p className="text-xs font-semibold mb-2 text-muted-foreground">Example:</p>
                      <pre className="text-xs bg-background p-3 rounded border">
{`+12345678900, John Doe
Jane Smith, +14155551234
+16175559876`}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule Section */}
              <FormField
                control={form.control}
                name="scheduledDateTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-semibold">Schedule for Later (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        disabled={createBatchMutation.isPending}
                        data-testid="input-scheduled-time"
                        min={new Date().toISOString().slice(0, 16)}
                        className="h-11"
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-sm text-muted-foreground">
                      Leave empty to start calls immediately after creation
                    </p>
                  </FormItem>
                )}
              />

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={createBatchMutation.isPending}
                className="w-full h-12 text-base font-semibold"
                data-testid="button-create-batch"
              >
                {createBatchMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating Batch Call Campaign...
                  </>
                ) : (
                  <>
                    <Phone className="mr-2 h-5 w-5" />
                    Create Batch Call Campaign
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
