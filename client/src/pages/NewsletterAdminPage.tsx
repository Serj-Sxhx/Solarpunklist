import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Loader2,
  Zap,
  Play,
  Send,
  RefreshCw,
  Star,
  StarOff,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { NewsletterItem, NewsletterDigestIssue } from "@shared/schema";

const TRL_COLORS: Record<string, string> = {
  "1": "bg-blue-100 text-blue-700",
  "2": "bg-blue-100 text-blue-700",
  "3": "bg-blue-100 text-blue-700",
  "4": "bg-amber-100 text-amber-700",
  "5": "bg-amber-100 text-amber-700",
  "6": "bg-amber-100 text-amber-700",
  "7": "bg-emerald-100 text-emerald-700",
  "8": "bg-emerald-100 text-emerald-700",
  "9": "bg-emerald-100 text-emerald-700",
};

function trlLabel(level: number | null) {
  if (!level) return "TRL ?";
  const desc: Record<number, string> = {
    1: "Basic Research",
    2: "Concept",
    3: "Proof of Concept",
    4: "Lab Validation",
    5: "Env. Validation",
    6: "Prototype Demo",
    7: "Operational Prototype",
    8: "System Qualified",
    9: "Proven Deployment",
  };
  return `TRL ${level} — ${desc[level] || ""}`;
}

function ItemCard({
  item,
  onToggleSelect,
  onToggleFrontier,
}: {
  item: NewsletterItem;
  onToggleSelect: (id: string, current: boolean | null) => void;
  onToggleFrontier: (id: string, current: boolean | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`border rounded-xl p-4 transition-all ${item.isSelected === true ? "border-primary/60 bg-primary/5" : "border-border/60 bg-card"}`}
      data-testid={`card-newsletter-item-${item.id}`}
    >
      <div className="flex items-start gap-3">
        {/* Select checkbox */}
        <button
          onClick={() => onToggleSelect(item.id, item.isSelected)}
          className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
          data-testid={`button-select-item-${item.id}`}
          title={item.isSelected ? "Deselect" : "Select for digest"}
        >
          {item.isSelected === true ? (
            <CheckSquare className="w-5 h-5 text-primary" />
          ) : (
            <Square className="w-5 h-5" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-start gap-2 mb-1">
            {item.isFrontier && (
              <span className="inline-flex items-center gap-1 shrink-0 bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                <Zap className="w-3 h-3" /> Frontier
              </span>
            )}
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-foreground hover:text-primary leading-snug line-clamp-2"
            >
              {item.title}
            </a>
            <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground" />
          </div>

          {/* Meta badges */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TRL_COLORS[String(item.trlLevel)] ?? "bg-gray-100 text-gray-600"}`}
            >
              {trlLabel(item.trlLevel)}
            </span>
            {item.subcategoryTags?.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {item.sourceDomain && (
              <span className="text-xs text-muted-foreground">{item.sourceDomain}</span>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              Score: {((item.frontierScore ?? 0) * 100).toFixed(0)}
            </span>
          </div>

          {/* Summary */}
          {item.summary && (
            <p className={`text-xs text-muted-foreground leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
              {item.summary}
            </p>
          )}

          {/* TRL Reasoning */}
          {expanded && item.trlReasoning && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              TRL Reasoning: {item.trlReasoning}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onToggleFrontier(item.id, item.isFrontier)}
            className="text-muted-foreground hover:text-amber-500 transition-colors"
            data-testid={`button-frontier-item-${item.id}`}
            title={item.isFrontier ? "Remove frontier star" : "Mark as frontier"}
          >
            {item.isFrontier === true ? (
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            ) : (
              <StarOff className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-muted-foreground hover:text-foreground transition-colors ml-1"
            data-testid={`button-expand-item-${item.id}`}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function IssueCard({ issue }: { issue: NewsletterDigestIssue }) {
  const { toast } = useToast();

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/newsletter/issues/${issue.id}/generate`);
      if (!res.ok) { const b = await res.json(); throw new Error(b.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsletter/issues"] });
      toast({ title: "Digest generated successfully" });
    },
    onError: (e: Error) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/newsletter/issues/${issue.id}/send`);
      if (!res.ok) { const b = await res.json(); throw new Error(b.error || "Failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsletter/issues"] });
      toast({ title: `Sent to ${data.recipientCount} subscribers` });
    },
    onError: (e: Error) => toast({ title: "Send failed", description: e.message, variant: "destructive" }),
  });

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600",
    generated: "bg-blue-100 text-blue-700",
    sent: "bg-emerald-100 text-emerald-700",
  };

  return (
    <Card className="p-4" data-testid={`card-issue-${issue.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-foreground">
              Issue #{issue.issueNumber ?? "—"}
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[issue.status ?? ""] || ""}`}>
              {issue.status}
            </span>
          </div>
          {issue.subject && (
            <p className="text-sm text-muted-foreground line-clamp-1">{issue.subject}</p>
          )}
          {issue.sentAt && (
            <p className="text-xs text-muted-foreground mt-1">
              Sent {new Date(issue.sentAt).toLocaleDateString()} · {issue.recipientCount ?? 0} recipients
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {issue.status !== "sent" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              data-testid={`button-generate-issue-${issue.id}`}
            >
              {generateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <><FileText className="w-4 h-4 mr-1" />Generate</>
              )}
            </Button>
          )}
          {issue.status === "generated" && (
            <Button
              size="sm"
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
              data-testid={`button-send-issue-${issue.id}`}
            >
              {sendMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <><Send className="w-4 h-4 mr-1" />Send</>
              )}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function NewsletterAdminPage() {
  const { toast } = useToast();
  const [trlFilter, setTrlFilter] = useState<"" | "1-3" | "4-6" | "7-9">("");
  const [frontierOnly, setFrontierOnly] = useState(false);
  const [selectedOnly, setSelectedOnly] = useState(false);

  const itemsQuery = useQuery<NewsletterItem[]>({
    queryKey: ["/api/admin/newsletter/items"],
  });

  const issuesQuery = useQuery<NewsletterDigestIssue[]>({
    queryKey: ["/api/admin/newsletter/issues"],
  });

  const researchMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/newsletter/run-research");
      if (!res.ok) { const b = await res.json(); throw new Error(b.error || "Failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsletter/items"] });
      toast({ title: `Research complete: ${data.itemsNew} new items found` });
    },
    onError: (e: Error) => toast({ title: "Research failed", description: e.message, variant: "destructive" }),
  });

  const createIssueMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/newsletter/issues");
      if (!res.ok) { const b = await res.json(); throw new Error(b.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsletter/issues"] });
      toast({ title: "New draft issue created" });
    },
    onError: (e: Error) => toast({ title: "Failed to create issue", description: e.message, variant: "destructive" }),
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<NewsletterItem> }) => {
      const res = await apiRequest("PATCH", `/api/admin/newsletter/items/${id}`, data);
      if (!res.ok) { const b = await res.json(); throw new Error(b.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/newsletter/items"] }),
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const bulkSelectMutation = useMutation({
    mutationFn: async ({ ids, data }: { ids: string[]; data: Partial<NewsletterItem> }) => {
      const res = await apiRequest("POST", "/api/admin/newsletter/items/bulk-update", { ids, data });
      if (!res.ok) { const b = await res.json(); throw new Error(b.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/newsletter/items"] }),
    onError: (e: Error) => toast({ title: "Bulk update failed", description: e.message, variant: "destructive" }),
  });

  const items = itemsQuery.data ?? [];

  const filteredItems = items.filter((item) => {
    if (frontierOnly && !item.isFrontier) return false;
    if (selectedOnly && !item.isSelected) return false;
    if (trlFilter) {
      const [min, max] = trlFilter.split("-").map(Number);
      if (item.trlLevel === null || item.trlLevel < min || item.trlLevel > max) return false;
    }
    return true;
  });

  const selectedCount = items.filter((i) => i.isSelected).length;
  const frontierCount = items.filter((i) => i.isFrontier).length;

  const handleSelectAll = () => {
    const ids = filteredItems.filter((i) => !i.isSelected).map((i) => i.id);
    if (ids.length > 0) bulkSelectMutation.mutate({ ids, data: { isSelected: true } });
  };

  const handleDeselectAll = () => {
    const ids = filteredItems.filter((i) => i.isSelected).map((i) => i.id);
    if (ids.length > 0) bulkSelectMutation.mutate({ ids, data: { isSelected: false } });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">🌿 SolarpunkDigest Admin</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {items.length} items · {selectedCount} selected · {frontierCount} frontier
            </p>
          </div>
          <Button
            onClick={() => researchMutation.mutate()}
            disabled={researchMutation.isPending}
            className="gap-2"
            data-testid="button-run-research"
          >
            {researchMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Researching...</>
            ) : (
              <><Play className="w-4 h-4" /> Run Research</>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Items panel */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              {/* TRL filter */}
              <div className="flex items-center gap-1 text-sm">
                <span className="text-muted-foreground text-xs">TRL:</span>
                {(["", "1-3", "4-6", "7-9"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setTrlFilter(v)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      trlFilter === v
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                    data-testid={`button-filter-trl-${v || "all"}`}
                  >
                    {v || "All"}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setFrontierOnly((f) => !f)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  frontierOnly ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"
                }`}
                data-testid="button-filter-frontier"
              >
                <Zap className="w-3 h-3" /> Frontier
              </button>

              <button
                onClick={() => setSelectedOnly((s) => !s)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedOnly ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                }`}
                data-testid="button-filter-selected"
              >
                <CheckSquare className="w-3 h-3" /> Selected only
              </button>

              <div className="ml-auto flex gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7"
                  onClick={handleSelectAll}
                  disabled={bulkSelectMutation.isPending}
                  data-testid="button-select-all"
                >
                  Select all visible
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7 text-muted-foreground"
                  onClick={handleDeselectAll}
                  disabled={bulkSelectMutation.isPending}
                  data-testid="button-deselect-all"
                >
                  Deselect all
                </Button>
              </div>
            </div>

            {itemsQuery.isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                {items.length === 0
                  ? "No items yet. Click 'Run Research' to discover new content."
                  : "No items match the current filters."}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onToggleSelect={(id, current) =>
                      updateItemMutation.mutate({ id, data: { isSelected: !current } })
                    }
                    onToggleFrontier={(id, current) =>
                      updateItemMutation.mutate({ id, data: { isFrontier: !current } })
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* Issues panel */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Digest Issues</h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => createIssueMutation.mutate()}
                disabled={createIssueMutation.isPending || selectedCount === 0}
                title={selectedCount === 0 ? "Select items first" : "Create new draft issue"}
                data-testid="button-create-issue"
              >
                {createIssueMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <><RefreshCw className="w-3.5 h-3.5 mr-1" /> New Issue</>
                )}
              </Button>
            </div>

            {issuesQuery.isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : !issuesQuery.data?.length ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No issues yet. Select items then create a new issue.
              </p>
            ) : (
              <div className="space-y-3">
                {issuesQuery.data.map((issue) => (
                  <IssueCard key={issue.id} issue={issue} />
                ))}
              </div>
            )}

            <Card className="p-4 bg-muted/40">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Workflow</h3>
              <ol className="text-xs text-muted-foreground space-y-1.5 list-none">
                {[
                  "Run Research to discover items",
                  "Star ⚡ frontier discoveries",
                  "✓ Select items for the digest",
                  "Create a new issue",
                  "Generate the digest with AI",
                  "Send to all subscribers",
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
