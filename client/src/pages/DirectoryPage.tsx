import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CommunityCard } from "@/components/CommunityCard";
import { CommunityCardSkeleton } from "@/components/CommunityCardSkeleton";
import { FilterBar, type FilterState } from "@/components/FilterBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Leaf,
  Sparkles,
  Mail,
  Loader2,
  CheckCircle2,
  Sun,
  Wind,
  Droplets,
  Cpu,
  TreePine,
  Zap,
  Radio,
  Cog,
  Bot,
  Wifi,
  ExternalLink,
  Plus,
  Globe,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CommunityWithRelations } from "@shared/schema";

const REGION_MAP: Record<string, string> = {
  "United States": "North America",
  "USA": "North America",
  "Canada": "North America",
  "Mexico": "North America",
  "Brazil": "South America",
  "Colombia": "South America",
  "Costa Rica": "North America",
  "Portugal": "Europe",
  "Italy": "Europe",
  "Netherlands": "Europe",
  "Scotland": "Europe",
  "United Kingdom": "Europe",
  "Germany": "Europe",
  "France": "Europe",
  "Spain": "Europe",
  "Denmark": "Europe",
  "Sweden": "Europe",
  "India": "Asia",
  "Japan": "Asia",
  "Thailand": "Asia",
  "Australia": "Oceania",
  "New Zealand": "Oceania",
  "Kenya": "Africa",
  "South Africa": "Africa",
};

function getRegion(country: string | null | undefined): string {
  if (!country) return "";
  return REGION_MAP[country] || "";
}

const SOLARPUNK_TECHNOLOGIES = [
  { name: "Solar Microgrids", icon: Sun },
  { name: "Wind Turbines", icon: Wind },
  { name: "Rainwater Harvesting", icon: Droplets },
  { name: "Edge AI Compute", icon: Cpu },
  { name: "Permaculture Design", icon: TreePine },
  { name: "Battery Storage", icon: Zap },
  { name: "LoRa / Mesh Networks", icon: Radio },
  { name: "CNC & 3D Printing", icon: Cog },
  { name: "Autonomous Drones", icon: Bot },
  { name: "IoT Sensor Arrays", icon: Wifi },
];

export default function DirectoryPage() {
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    regions: [],
    stages: [],
    sort: "score",
  });

  const [email, setEmail] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitUrl, setSubmitUrl] = useState("");
  const [submitError, setSubmitError] = useState("");
  const { toast } = useToast();

  const { data: communities, isLoading } = useQuery<CommunityWithRelations[]>({
    queryKey: ["/api/communities"],
  });

  const subscribeMutation = useMutation({
    mutationFn: async (emailAddr: string) => {
      const res = await apiRequest("POST", "/api/subscribe", { email: emailAddr });
      return res.json();
    },
    onSuccess: () => {
      setEmail("");
      setShowSuccess(true);
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest("POST", "/api/submit-community", { url });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit community");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setShowSubmit(false);
      setSubmitUrl("");
      setSubmitError("");
      queryClient.invalidateQueries({ queryKey: ["/api/communities"] });
      toast({
        title: `${data.name} added!`,
        description: "The community has been researched and added to the directory.",
      });
    },
    onError: (error: Error) => {
      setSubmitError(error.message);
      toast({
        title: "Submission failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmitCommunity = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    const trimmed = submitUrl.trim();
    if (!trimmed) return;

    try {
      const parsed = new URL(trimmed);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        setSubmitError("URL must start with http:// or https://");
        return;
      }
    } catch {
      setSubmitError("Please enter a valid URL (e.g. https://example.com)");
      return;
    }

    submitMutation.mutate(trimmed);
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim() && email.includes("@")) {
      subscribeMutation.mutate(email.trim());
    }
  };

  const filtered = useMemo(() => {
    if (!communities) return [];

    let result = communities.filter((c) => c.isPublished);

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.tagline?.toLowerCase().includes(q) ||
          c.locationCountry?.toLowerCase().includes(q) ||
          c.locationRegion?.toLowerCase().includes(q) ||
          c.tags?.some((t) => t.tag.toLowerCase().includes(q))
      );
    }

    if (filters.regions.length > 0) {
      result = result.filter((c) => {
        const region = getRegion(c.locationCountry);
        return filters.regions.includes(region);
      });
    }

    if (filters.stages.length > 0) {
      result = result.filter((c) => c.stage && filters.stages.includes(c.stage));
    }

    if (filters.sort === "score") {
      result.sort((a, b) => {
        if (a.stage === "dormant" && b.stage !== "dormant") return 1;
        if (b.stage === "dormant" && a.stage !== "dormant") return -1;
        return (b.solarpunkScore ?? 0) - (a.solarpunkScore ?? 0);
      });
    } else if (filters.sort === "newest") {
      result.sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return db - da;
      });
    } else if (filters.sort === "alpha") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [communities, filters]);

  return (
    <div className="min-h-screen bg-background">
      <section className="relative bg-gradient-to-br from-emerald-50 via-background to-amber-50/30 dark:from-emerald-950/20 dark:via-background dark:to-amber-950/10 border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                  AI-Powered Directory
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground leading-tight tracking-tight" data-testid="text-hero-title">
                Discover Regenerative
                <br />
                <span className="text-primary">Communities</span> Worldwide
              </h1>
              <p className="mt-3 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
                Explore solarpunk intentional communities and regenerative land projects.
                Auto-discovered by AI, updated monthly, scored for sustainability.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 gap-2 bg-[#1dd66b] text-[#ffffff]"
                onClick={() => { setShowSubmit(true); setSubmitUrl(""); setSubmitError(""); }}
                data-testid="button-submit-project"
              >
                <Plus className="w-4 h-4" />
                Submit Your Project
              </Button>
            </div>

            <div className="lg:w-80 shrink-0">
              <div className="bg-white/60 dark:bg-card/60 backdrop-blur-sm border border-border/60 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Stay Updated</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Get notified when new communities are discovered.
                </p>
                <form onSubmit={handleSubscribe} className="flex gap-2" data-testid="form-subscribe">
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-9 text-sm bg-background"
                    required
                    data-testid="input-email"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="h-9 px-4 shrink-0"
                    disabled={subscribeMutation.isPending}
                    data-testid="button-subscribe"
                  >
                    {subscribeMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Join"
                    )}
                  </Button>
                </form>
                {subscribeMutation.isError && (
                  <p className="text-xs text-destructive mt-2" data-testid="text-subscribe-error">
                    Something went wrong. Please try again.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          totalCount={filtered.length}
        />

        <div className="mt-6 flex gap-6">
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {Array.from({ length: 9 }).map((_, i) => (
                  <CommunityCardSkeleton key={i} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Leaf className="w-7 h-7 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">No communities found</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Try adjusting your filters or search terms to discover more communities.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filtered.map((community) => (
                  <CommunityCard key={community.id} community={community} />
                ))}
              </div>
            )}
          </div>

          <aside className="hidden xl:block w-72 shrink-0" data-testid="sidebar-technologies">
            <div className="sticky top-20">
              <Card className="p-5 border-border/60">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">Solarpunk Tech</h3>
                </div>

                <ul className="space-y-2.5 mb-5">
                  {SOLARPUNK_TECHNOLOGIES.map((tech) => {
                    const Icon = tech.icon;
                    return (
                      <li key={tech.name} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                        <Icon className="w-4 h-4 text-primary/70 shrink-0" />
                        <span>{tech.name}</span>
                      </li>
                    );
                  })}
                </ul>

                <div className="border-t border-border/60 pt-4 mb-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    We consult on local-first AI data centers to run robots, drones, IoT and all solarpunk technology needs. From microgrids to mesh networks, we help communities build resilient tech infrastructure.
                  </p>
                </div>

                <a
                  href="https://cal.com/serj-hunt-5otgyc/60-min-meeting"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                  data-testid="link-contact-us"
                >
                  <Button className="w-full gap-2" size="sm">
                    <ExternalLink className="w-4 h-4" />
                    Contact Us
                  </Button>
                </a>
              </Card>
            </div>
          </aside>
        </div>
      </main>

      <Dialog open={showSubmit} onOpenChange={(open) => { if (!submitMutation.isPending) { setShowSubmit(open); setSubmitError(""); } }}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-submit">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Submit Your Project
            </DialogTitle>
            <DialogDescription>
              Paste the URL of a solarpunk community or regenerative land project. Our AI will research it and add it to the directory.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitCommunity} className="space-y-4">
            <div>
              <Input
                type="url"
                placeholder="https://example-community.org"
                value={submitUrl}
                onChange={(e) => { setSubmitUrl(e.target.value); setSubmitError(""); }}
                disabled={submitMutation.isPending}
                className="h-10"
                autoFocus
                data-testid="input-submit-url"
              />
              {submitError && (
                <p className="text-sm text-destructive mt-2" data-testid="text-submit-error">{submitError}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full gap-2"
              disabled={submitMutation.isPending || !submitUrl.trim()}
              data-testid="button-submit-url"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Researching community...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Research & Add
                </>
              )}
            </Button>
            {submitMutation.isPending && (
              <p className="text-xs text-muted-foreground text-center">
                This may take 30–60 seconds while our AI researches the project.
              </p>
            )}
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-success">
          <DialogHeader>
            <div className="flex justify-center mb-3">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
            </div>
            <DialogTitle className="text-center">You're In!</DialogTitle>
            <DialogDescription className="text-center">
              Thanks for subscribing. We'll notify you when new solarpunk communities are discovered.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center mt-2">
            <Button
              variant="outline"
              onClick={() => setShowSuccess(false)}
              data-testid="button-close-success"
            >
              Continue Browsing
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
