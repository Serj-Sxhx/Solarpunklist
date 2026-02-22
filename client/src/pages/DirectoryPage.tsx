import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CommunityCard } from "@/components/CommunityCard";
import { CommunityCardSkeleton } from "@/components/CommunityCardSkeleton";
import { FilterBar, type FilterState } from "@/components/FilterBar";
import { Leaf, Sparkles } from "lucide-react";
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

export default function DirectoryPage() {
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    regions: [],
    stages: [],
    sort: "score",
  });

  const { data: communities, isLoading } = useQuery<CommunityWithRelations[]>({
    queryKey: ["/api/communities"],
  });

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

        <div className="mt-6">
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
      </main>
    </div>
  );
}
