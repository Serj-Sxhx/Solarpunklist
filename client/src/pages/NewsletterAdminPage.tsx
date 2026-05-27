import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  ArrowLeft,
  Eye,
  Edit2,
  Users,
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
          <div className="flex items-start gap-2 mb-1">
            {item.isFrontier === true && (
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

          {item.summary && (
            <p className={`text-xs text-muted-foreground leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
              {item.summary}
            </p>
          )}
          {expanded && item.trlReasoning && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              TRL Reasoning: {item.trlReasoning}
            </p>
          )}
        </div>

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

// ── Digest Detail View ────────────────────────────────────────────────────────

function DigestDetailView({
  issue,
  cronSecret,
  onBack,
}: {
  issue: NewsletterDigestIssue & { items?: NewsletterItem[] };
  cronSecret: string;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const [editingSubject, setEditingSubject] = useState(false);
  const [editingIntro, setEditingIntro] = useState(false);
  const [subjectDraft, setSubjectDraft] = useState(issue.subject ?? "");
  const [introDraft, setIntroDraft] = useState(issue.introText ?? "");
  const [activeTab, setActiveTab] = useState<"preview" | "edit">("preview");

  const issueQuery = useQuery<NewsletterDigestIssue & { items: NewsletterItem[] }>({
    queryKey: ["/api/newsletter/issues", issue.id],
  });

  const current = issueQuery.data ?? issue;

  const patchIssueMutation = useMutation({
    mutationFn: async (data: { subject?: string; introText?: string; status?: string }) => {
      const res = await apiRequest("PATCH", `/api/newsletter/issues/${issue.id}`, data);
      if (!res.ok) { const b = await res.json(); throw new Error(b.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletter/issues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/newsletter/issues", issue.id] });
      setEditingSubject(false);
      setEditingIntro(false);
      toast({ title: "Saved" });
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/newsletter/issues/${issue.id}/generate`);
      if (!res.ok) { const b = await res.json(); throw new Error(b.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletter/issues", issue.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/newsletter/issues"] });
      toast({ title: "Digest generated" });
    },
    onError: (e: Error) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/newsletter/issues/${issue.id}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cronSecret}`,
        },
      });
      if (!res.ok) { const b = await res.json(); throw new Error(b.error || "Failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletter/issues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/newsletter/issues", issue.id] });
      toast({ title: `Sent to ${data.recipientCount} subscribers` });
    },
    onError: (e: Error) => toast({ title: "Send failed", description: e.message, variant: "destructive" }),
  });

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600",
    generated: "bg-blue-100 text-blue-700",
    approved: "bg-purple-100 text-purple-700",
    sent: "bg-emerald-100 text-emerald-700",
    discarded: "bg-red-100 text-red-600",
  };

  return (
    <div>
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1" data-testid="button-back-issues">
          <ArrowLeft className="w-4 h-4" /> Issues
        </Button>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">
            Issue #{current.issueNumber ?? "—"}
          </span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[current.status ?? ""] || ""}`}>
            {current.status}
          </span>
        </div>
        <div className="ml-auto flex gap-2">
          {current.status !== "sent" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              data-testid="button-generate-digest"
            >
              {generateMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-1" />Generating...</>
              ) : (
                <><FileText className="w-4 h-4 mr-1" />Generate</>
              )}
            </Button>
          )}
          {current.status === "generated" || current.status === "approved" ? (
            <Button
              size="sm"
              onClick={() => {
                if (!cronSecret) {
                  toast({ title: "CRON_SECRET required", description: "Enter your CRON_SECRET to authorize sending.", variant: "destructive" });
                  return;
                }
                sendMutation.mutate();
              }}
              disabled={sendMutation.isPending}
              data-testid="button-send-digest"
            >
              {sendMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-1" />Sending...</>
              ) : (
                <><Send className="w-4 h-4 mr-1" />Send Now</>
              )}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Subject line editor */}
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subject Line</span>
          {!editingSubject && (
            <Button variant="ghost" size="sm" onClick={() => { setEditingSubject(true); setSubjectDraft(current.subject ?? ""); }} data-testid="button-edit-subject">
              <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
            </Button>
          )}
        </div>
        {editingSubject ? (
          <div className="space-y-2">
            <Input
              value={subjectDraft}
              onChange={(e) => setSubjectDraft(e.target.value)}
              placeholder="Email subject line..."
              data-testid="input-subject"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => patchIssueMutation.mutate({ subject: subjectDraft })} disabled={patchIssueMutation.isPending} data-testid="button-save-subject">
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingSubject(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground">
            {current.subject || <span className="text-muted-foreground italic">No subject yet — generate digest to populate</span>}
          </p>
        )}
      </Card>

      {/* Intro text editor */}
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Intro Text</span>
          {!editingIntro && (
            <Button variant="ghost" size="sm" onClick={() => { setEditingIntro(true); setIntroDraft(current.introText ?? ""); }} data-testid="button-edit-intro">
              <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
            </Button>
          )}
        </div>
        {editingIntro ? (
          <div className="space-y-2">
            <Textarea
              value={introDraft}
              onChange={(e) => setIntroDraft(e.target.value)}
              placeholder="Intro paragraph for this issue..."
              rows={4}
              data-testid="input-intro"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => patchIssueMutation.mutate({ introText: introDraft })} disabled={patchIssueMutation.isPending} data-testid="button-save-intro">
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingIntro(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {current.introText || <span className="italic">No intro yet</span>}
          </p>
        )}
      </Card>

      {/* HTML preview / Markdown tabs */}
      {current.generatedHtml && (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-0 border-b border-border px-4">
            <button
              onClick={() => setActiveTab("preview")}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-colors ${activeTab === "preview" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
              data-testid="tab-preview"
            >
              <Eye className="w-3.5 h-3.5" /> HTML Preview
            </button>
            <button
              onClick={() => setActiveTab("edit")}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-colors ${activeTab === "edit" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
              data-testid="tab-edit"
            >
              <Edit2 className="w-3.5 h-3.5" /> Markdown
            </button>
          </div>
          {activeTab === "preview" ? (
            <iframe
              srcDoc={current.generatedHtml}
              className="w-full border-0"
              style={{ height: 700 }}
              title="Digest email preview"
              data-testid="iframe-digest-preview"
            />
          ) : (
            <Textarea
              value={current.generatedMarkdown ?? ""}
              readOnly
              rows={30}
              className="font-mono text-xs rounded-none border-0 resize-none"
              data-testid="textarea-digest-markdown"
            />
          )}
        </Card>
      )}

      {!current.generatedHtml && (
        <Card className="p-10 text-center text-muted-foreground">
          <FileText className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No digest generated yet.</p>
          <p className="text-xs mt-1">Click "Generate" above to create the email from selected items.</p>
        </Card>
      )}
    </div>
  );
}

// ── Issues list panel ─────────────────────────────────────────────────────────

function IssueRow({
  issue,
  onOpen,
}: {
  issue: NewsletterDigestIssue;
  onOpen: () => void;
}) {
  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600",
    generated: "bg-blue-100 text-blue-700",
    approved: "bg-purple-100 text-purple-700",
    sent: "bg-emerald-100 text-emerald-700",
    discarded: "bg-red-100 text-red-600",
  };

  return (
    <Card className="p-4 hover:bg-accent/30 transition-colors cursor-pointer" onClick={onOpen} data-testid={`card-issue-${issue.id}`}>
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
            <p className="text-xs text-muted-foreground line-clamp-1">{issue.subject}</p>
          )}
          {issue.sentAt && (
            <p className="text-xs text-muted-foreground mt-1">
              Sent {new Date(issue.sentAt).toLocaleDateString()} · {issue.recipientCount ?? 0} recipients
            </p>
          )}
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground rotate-[-90deg] shrink-0" />
      </div>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NewsletterAdminPage() {
  const { toast } = useToast();
  const [trlFilter, setTrlFilter] = useState<"" | "1-3" | "4-6" | "7-9">("");
  const [frontierOnly, setFrontierOnly] = useState(false);
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [activeIssue, setActiveIssue] = useState<(NewsletterDigestIssue & { items?: NewsletterItem[] }) | null>(null);
  const [cronSecret, setCronSecret] = useState("");
  const [showSubscribers, setShowSubscribers] = useState(false);

  const itemsQuery = useQuery<NewsletterItem[]>({
    queryKey: ["/api/newsletter/items"],
  });

  const issuesQuery = useQuery<NewsletterDigestIssue[]>({
    queryKey: ["/api/newsletter/issues"],
  });

  const subscribersQuery = useQuery<any[]>({
    queryKey: ["/api/newsletter/subscribers"],
    enabled: showSubscribers,
  });

  const researchMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/newsletter/research");
      if (!res.ok) { const b = await res.json(); throw new Error(b.error || "Failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletter/items"] });
      toast({ title: `Research complete: ${data.itemsNew} new items found` });
    },
    onError: (e: Error) => toast({ title: "Research failed", description: e.message, variant: "destructive" }),
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/newsletter/generate");
      if (!res.ok) { const b = await res.json(); throw new Error(b.error || "Failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletter/issues"] });
      setActiveIssue(data);
      toast({ title: "Digest generated — opening preview" });
    },
    onError: (e: Error) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
  });

  const createIssueMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/newsletter/issues");
      if (!res.ok) { const b = await res.json(); throw new Error(b.error || "Failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletter/issues"] });
      setActiveIssue(data);
      toast({ title: "New draft issue created" });
    },
    onError: (e: Error) => toast({ title: "Failed to create issue", description: e.message, variant: "destructive" }),
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<NewsletterItem> }) => {
      const res = await apiRequest("PATCH", `/api/newsletter/items/${id}`, data);
      if (!res.ok) { const b = await res.json(); throw new Error(b.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/newsletter/items"] }),
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const bulkSelectMutation = useMutation({
    mutationFn: async ({ ids, data }: { ids: string[]; data: Partial<NewsletterItem> }) => {
      const res = await apiRequest("PATCH", "/api/newsletter/items/bulk", { ids, data });
      if (!res.ok) { const b = await res.json(); throw new Error(b.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/newsletter/items"] }),
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

  if (activeIssue) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <DigestDetailView
            issue={activeIssue}
            cronSecret={cronSecret}
            onBack={() => setActiveIssue(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">🌿 SolarpunkDigest Admin</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {items.length} items · {selectedCount} selected · {frontierCount} frontier
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSubscribers((s) => !s)}
              data-testid="button-toggle-subscribers"
            >
              <Users className="w-4 h-4 mr-1" /> Subscribers
            </Button>
            {selectedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                data-testid="button-generate-digest"
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-1" />Generating...</>
                ) : (
                  <><FileText className="w-4 h-4 mr-1" />Generate Digest ({selectedCount})</>
                )}
              </Button>
            )}
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
        </div>

        {/* CRON_SECRET input for sending */}
        <Card className="p-3 mb-5 bg-amber-50/60 border-amber-200">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-amber-700 shrink-0">CRON_SECRET</span>
            <Input
              type="password"
              placeholder="Enter CRON_SECRET to authorize sending..."
              value={cronSecret}
              onChange={(e) => setCronSecret(e.target.value)}
              className="h-8 text-xs flex-1"
              data-testid="input-cron-secret"
            />
            <span className="text-xs text-amber-600 shrink-0">Required to send</span>
          </div>
        </Card>

        {/* Subscriber list (collapsible) */}
        {showSubscribers && (
          <Card className="p-4 mb-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Active Subscribers ({subscribersQuery.data?.length ?? "…"})
            </h2>
            {subscribersQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading...
              </div>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1">
                {subscribersQuery.data?.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between text-xs text-muted-foreground" data-testid={`row-subscriber-${sub.id}`}>
                    <span>{sub.email}</span>
                    <span className="text-gray-400">{sub.name || "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Items panel */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
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
                  onClick={() => {
                    const ids = filteredItems.filter((i) => !i.isSelected).map((i) => i.id);
                    if (ids.length > 0) bulkSelectMutation.mutate({ ids, data: { isSelected: true } });
                  }}
                  disabled={bulkSelectMutation.isPending}
                  data-testid="button-select-all"
                >
                  Select all visible
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7 text-muted-foreground"
                  onClick={() => {
                    const ids = filteredItems.filter((i) => i.isSelected).map((i) => i.id);
                    if (ids.length > 0) bulkSelectMutation.mutate({ ids, data: { isSelected: false } });
                  }}
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
                  <IssueRow
                    key={issue.id}
                    issue={issue}
                    onOpen={() => setActiveIssue(issue)}
                  />
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
                  "Click 'Generate Digest'",
                  "Edit subject & intro in preview",
                  "Enter CRON_SECRET + Send",
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
