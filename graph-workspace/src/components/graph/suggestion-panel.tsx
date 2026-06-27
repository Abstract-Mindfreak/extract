"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Lightbulb, Check, X, Loader2, RefreshCw } from "lucide-react";
import type { SuggestedRelationship } from "@prisma/client";

async function fetchSuggestions(): Promise<SuggestedRelationship[]> {
  const res = await fetch("/api/graphrag/suggested-relationships");
  if (!res.ok) {
    throw new Error("Failed to fetch suggestions");
  }
  const data = await res.json();
  return data.suggestions || [];
}

async function updateSuggestionStatus({ id, status }: { id: string, status: 'APPROVED' | 'REJECTED' }) {
  const res = await fetch(`/api/graphrag/suggested-relationships/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to update suggestion");
  }
  return res.json();
}

export default function SuggestionPanel() {
  const queryClient = useQueryClient();
  const { data: suggestions, isLoading, error, refetch } = useQuery({
    queryKey: ['suggestedRelationships'],
    queryFn: fetchSuggestions,
  });

  const mutation = useMutation({
    mutationFn: updateSuggestionStatus,
    onSuccess: (data, variables) => {
      toast.success(`Suggestion ${variables.status.toLowerCase()}`, {
        description: `${data.suggestion.fromNodeName} -> ${data.suggestion.toNodeName}`,
      });
      queryClient.invalidateQueries({ queryKey: ['suggestedRelationships'] });
    },
    onError: (error) => {
      toast.error("Update failed", {
        description: error.message,
      });
    },
  });

  if (isLoading) {
    return (
      <Card className="border-slate-700/50 bg-slate-900/80 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between px-4 pb-3 pt-4">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-200">
            <Lightbulb className="h-4 w-4 text-slate-400" />
            Relationship Suggestions
          </CardTitle>
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
       <Card className="border-red-700/50 bg-red-900/30">
        <CardHeader className="px-4 pb-3 pt-4">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-red-300">
            <X className="h-4 w-4" />
            Error Loading Suggestions
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-slate-700/50 bg-slate-900/80 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between px-4 pb-3 pt-4">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <Lightbulb className="h-4 w-4 text-slate-400" />
          Relationship Suggestions
          <Badge variant="secondary">{suggestions?.length || 0}</Badge>
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <ScrollArea className="max-h-64">
            {suggestions && suggestions.length > 0 ? (
                <div className="space-y-3 pr-2">
                    {suggestions.map((s) => (
                        <div key={s.id} className="text-xs p-2 rounded-md border border-slate-700 bg-slate-800/50">
                            <div className="flex items-center justify-between">
                                <p className="font-bold text-slate-300">
                                    {s.fromNodeName}
                                    <span className="font-normal text-slate-400 mx-1"> -&gt; </span>
                                    {s.toNodeName}
                                </p>
                                <Badge variant="outline" className="border-amber-500/50 text-amber-400">{s.relation_type}</Badge>
                            </div>
                            <p className="text-slate-400 mt-1.5 italic">"{s.justification}"</p>
                            <div className="flex items-center justify-between mt-2">
                                <span className="text-slate-500">Confidence: {s.confidence.toFixed(2)}</span>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 px-2 text-xs border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                                        onClick={() => mutation.mutate({ id: s.id, status: 'REJECTED' })}
                                        disabled={mutation.isPending}
                                    >
                                        <X className="h-3 w-3 mr-1" /> Reject
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="h-6 px-2 text-xs bg-green-600 hover:bg-green-500"
                                        onClick={() => mutation.mutate({ id: s.id, status: 'APPROVED' })}
                                        disabled={mutation.isPending}
                                    >
                                        <Check className="h-3 w-3 mr-1" /> Approve
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-xs text-slate-400 text-center py-4">No pending suggestions.</p>
            )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
