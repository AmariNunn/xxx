import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock, CheckCircle, XCircle, Loader2, Phone, Trash2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { BatchCall } from "@shared/types";

interface BatchHistoryProps {
  userId: string;
}

export default function BatchHistory({ userId }: BatchHistoryProps) {
  const [batchToDelete, setBatchToDelete] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: batches, isLoading } = useQuery({
    queryKey: [`/api/elevenlabs/batches/${userId}`],
    enabled: !!userId,
    refetchInterval: 30000, // Refetch every 30 seconds to update status
  }) as { data: { data: BatchCall[] } | undefined; isLoading: boolean };

  const deleteBatchMutation = useMutation({
    mutationFn: async (batchId: number) => {
      const response = await fetch(`/api/elevenlabs/batch/${batchId}?userId=${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete batch call");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Batch Call Deleted",
        description: "The batch call has been removed from your history.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/elevenlabs/batches/${userId}`] });
      setBatchToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Delete",
        description: error.message || "Could not delete the batch call.",
        variant: "destructive",
      });
      setBatchToDelete(null);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="secondary" className="gap-1" data-testid={`badge-status-pending`}>
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge variant="default" className="gap-1 bg-blue-500 hover:bg-blue-600" data-testid={`badge-status-in-progress`}>
            <Loader2 className="h-3 w-3 animate-spin" />
            In Progress
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="default" className="gap-1 bg-green-500 hover:bg-green-600" data-testid={`badge-status-completed`}>
            <CheckCircle className="h-3 w-3" />
            Completed
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1" data-testid={`badge-status-failed`}>
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="outline" className="gap-1" data-testid={`badge-status-cancelled`}>
            <XCircle className="h-3 w-3" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const calculateProgress = (batch: BatchCall) => {
    if (batch.total_calls_scheduled === 0) return 0;
    return Math.round((batch.total_calls_dispatched / batch.total_calls_scheduled) * 100);
  };

  const getResultBadge = (batch: BatchCall) => {
    // First check status - if pending or in_progress, always show In Progress
    if (batch.status === 'pending' || batch.status === 'in_progress') {
      return (
        <Badge variant="secondary" className="gap-1" data-testid={`badge-result-waiting`}>
          <Clock className="h-3 w-3" />
          In Progress
        </Badge>
      );
    }
    
    // If batch failed or was cancelled, always show Failed
    if (batch.status === 'failed' || batch.status === 'cancelled') {
      return (
        <Badge variant="destructive" className="gap-1" data-testid={`badge-result-failed`}>
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>
      );
    }
    
    // For completed batches, check if calls were dispatched
    if (batch.total_calls_dispatched > 0) {
      return (
        <Badge variant="default" className="gap-1 bg-green-500 hover:bg-green-600" data-testid={`badge-result-success`}>
          <CheckCircle className="h-3 w-3" />
          Success
        </Badge>
      );
    }
    
    // Completed with no calls dispatched = failed
    return (
      <Badge variant="destructive" className="gap-1" data-testid={`badge-result-failed`}>
        <XCircle className="h-3 w-3" />
        Failed
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Batch Call History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const batchList = batches?.data || [];

  return (
    <>
      <Card data-testid="card-batch-history">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Batch Call History
          </CardTitle>
          <CardDescription>
            Track the status and progress of your bulk call campaigns
          </CardDescription>
        </CardHeader>
        <CardContent>
          {batchList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-batches">
              <Phone className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No batch calls yet</p>
              <p className="text-sm">Create your first bulk call campaign above</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead className="text-center">Progress</TableHead>
                    <TableHead className="text-center">Calls</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchList.map((batch) => {
                    const progress = calculateProgress(batch);
                    return (
                      <TableRow key={batch.id} data-testid={`row-batch-${batch.id}`}>
                        <TableCell className="font-medium" data-testid={`text-batch-name-${batch.id}`}>
                          {batch.batch_name}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(batch.status)}
                        </TableCell>
                        <TableCell>
                          {getResultBadge(batch)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-2">
                            <Progress value={progress} className="h-2" data-testid={`progress-batch-${batch.id}`} />
                            <span className="text-xs text-muted-foreground text-center" data-testid={`text-progress-${batch.id}`}>
                              {progress}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center" data-testid={`text-calls-${batch.id}`}>
                          <div className="flex flex-col">
                            <span className="font-semibold">{batch.total_calls_dispatched}</span>
                            <span className="text-xs text-muted-foreground">of {batch.total_calls_scheduled}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground" data-testid={`text-created-${batch.id}`}>
                          {new Date(batch.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setLocation('/call-dashboard')}
                              className="gap-1.5"
                              data-testid={`button-view-calls-${batch.id}`}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              View Calls
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setBatchToDelete(batch.id)}
                              disabled={deleteBatchMutation.isPending}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              data-testid={`button-delete-${batch.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={batchToDelete !== null} onOpenChange={(open) => !open && setBatchToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Batch Call?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this batch call campaign? This will remove it from your history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBatchMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => batchToDelete && deleteBatchMutation.mutate(batchToDelete)}
              disabled={deleteBatchMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteBatchMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
