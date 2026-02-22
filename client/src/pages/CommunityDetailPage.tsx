import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  MapPin,
  Calendar,
  Users,
  Globe,
  Sun,
  Leaf,
  Cpu,
  Landmark,
  RefreshCw,
  Shield,
  ChevronRight,
  Info,
  Camera,
  X,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { StageBadge } from "@/components/StageBadge";
import { ScoreBar } from "@/components/ScoreDisplay";
import { getCountryFlag, getScoreColor, SCORE_DIMENSIONS } from "@/lib/constants";
import type { CommunityWithRelations } from "@shared/schema";

const DIMENSION_ICONS: Record<string, typeof Sun> = {
  sun: Sun,
  leaf: Leaf,
  cpu: Cpu,
  landmark: Landmark,
  users: Users,
  "refresh-cw": RefreshCw,
};

export default function CommunityDetailPage() {
  const params = useParams<{ slug: string }>();

  const { data: community, isLoading, error } = useQuery<CommunityWithRelations>({
    queryKey: ["/api/communities", params.slug],
  });

  if (isLoading) return <DetailSkeleton />;
  if (error || !community) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-foreground">Community Not Found</h2>
          <p className="text-muted-foreground">This community doesn't exist or has been removed.</p>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Directory
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const flag = getCountryFlag(community.locationCountry);
  const techStack = (community.techStack as Record<string, string[]>) || {};
  const lastVerified = community.lastRefreshedAt || community.lastResearchedAt || community.createdAt;
  const formattedDate = lastVerified
    ? new Date(lastVerified).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="relative h-[280px] sm:h-[360px] overflow-hidden">
        {community.heroImageUrl ? (
          <img
            src={community.heroImageUrl}
            alt={community.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-emerald-200 via-emerald-100 to-amber-100 dark:from-emerald-900/40 dark:via-emerald-800/20 dark:to-amber-900/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

        <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
          <Link href="/">
            <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white backdrop-blur-sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </Link>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 lg:p-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <StageBadge stage={community.stage} />
                  {community.isFormingDisclaimer && (
                    <Badge variant="outline" className="bg-amber-500/20 border-amber-400/40 text-amber-100 text-xs">
                      Forming Community
                    </Badge>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight" data-testid="text-community-name">
                  {community.name}
                </h1>
                {community.tagline && (
                  <p className="text-base sm:text-lg text-white/80 max-w-2xl">
                    {community.tagline}
                  </p>
                )}
                <div className="flex items-center gap-4 text-white/70 text-sm flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    {flag && <span>{flag}</span>}
                    {community.locationRegion && `${community.locationRegion}, `}
                    {community.locationCountry}
                  </span>
                  {community.foundedYear && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      Founded {community.foundedYear}
                    </span>
                  )}
                  {community.population && (
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4" />
                      ~{community.population} members
                    </span>
                  )}
                </div>
              </div>

              <div className="hidden sm:flex flex-col items-center gap-1 shrink-0">
                <div
                  className={`w-20 h-20 rounded-2xl flex items-center justify-center font-extrabold text-3xl bg-white/10 backdrop-blur-sm border border-white/20 ${getScoreColor(community.solarpunkScore ?? 0)}`}
                  style={{ color: "white" }}
                >
                  {Math.round(community.solarpunkScore ?? 0)}
                </div>
                <span className="text-xs text-white/60 font-medium">Solarpunk Score</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {community.isFormingDisclaimer && (
              <Card className="p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50">
                <div className="flex gap-3">
                  <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Forming Community</p>
                    <p className="text-sm text-amber-700 dark:text-amber-400/80 mt-0.5">
                      This community is in its early stages. It may not yet have land, permanent residents, or
                      fully built infrastructure. Information may be limited and is subject to change.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {community.overview && (
              <section data-testid="section-overview">
                <h2 className="text-xl font-bold text-foreground mb-3">Overview</h2>
                <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed">
                  {community.overview.split("\n").map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </section>
            )}

            {community.images && community.images.length > 0 && (
              <PhotoGallery images={community.images} communityName={community.name} />
            )}

            {community.landDescription && (
              <section data-testid="section-land">
                <h2 className="text-xl font-bold text-foreground mb-3">The Land</h2>
                <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed">
                  {community.landDescription.split("\n").map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </section>
            )}

            {community.communityLife && (
              <section data-testid="section-community-life">
                <h2 className="text-xl font-bold text-foreground mb-3">Community Life</h2>
                <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed">
                  {community.communityLife.split("\n").map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </section>
            )}

            {community.howToJoin && (
              <section data-testid="section-how-to-join">
                <h2 className="text-xl font-bold text-foreground mb-3">How to Visit / Join</h2>
                <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed">
                  {community.howToJoin.split("\n").map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </section>
            )}

            {Object.keys(techStack).length > 0 && (
              <section data-testid="section-tech-stack">
                <h2 className="text-xl font-bold text-foreground mb-4">Technology Stack</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.entries(techStack).map(([category, items]) => {
                    if (!items || (Array.isArray(items) && items.length === 0)) return null;
                    const techItems = Array.isArray(items) ? items : [];
                    if (techItems.length === 0) return null;
                    return (
                      <Card key={category} className="p-4">
                        <h4 className="text-sm font-semibold text-foreground capitalize mb-2">
                          {category}
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {techItems.map((item: string) => (
                            <Badge key={item} variant="secondary" className="text-xs">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-6">
            <Card className="p-5" data-testid="card-score">
              <h3 className="text-base font-bold text-foreground mb-4">Solarpunk Score</h3>
              <div className="flex items-center justify-center mb-5">
                <div
                  className={`w-24 h-24 rounded-2xl flex items-center justify-center font-extrabold text-4xl border-2 ${
                    (community.solarpunkScore ?? 0) >= 70
                      ? "border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400"
                      : (community.solarpunkScore ?? 0) >= 40
                      ? "border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400"
                      : "border-red-200 dark:border-red-800 text-red-500 dark:text-red-400"
                  }`}
                >
                  {Math.round(community.solarpunkScore ?? 0)}
                </div>
              </div>
              <div className="space-y-3">
                {SCORE_DIMENSIONS.map((dim) => {
                  const score = (community as any)[dim.key] ?? 0;
                  return (
                    <ScoreBar
                      key={dim.key}
                      label={dim.label}
                      score={score}
                    />
                  );
                })}
              </div>
            </Card>

            {community.websiteUrl && (
              <Card className="p-5">
                <h3 className="text-base font-bold text-foreground mb-3">Website</h3>
                <a
                  href={community.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                  data-testid="link-website"
                >
                  <Globe className="w-4 h-4" />
                  <span className="truncate">{community.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
              </Card>
            )}

            {community.tags && community.tags.length > 0 && (
              <Card className="p-5">
                <h3 className="text-base font-bold text-foreground mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {community.tags.map((t) => (
                    <Badge key={t.id} variant="secondary" className="text-xs font-medium">
                      {t.tag}
                    </Badge>
                  ))}
                </div>
              </Card>
            )}

            {community.links && community.links.length > 0 && (
              <Card className="p-5">
                <h3 className="text-base font-bold text-foreground mb-3">Links & Resources</h3>
                <div className="space-y-2">
                  {community.links.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{link.title || link.url}</span>
                    </a>
                  ))}
                </div>
              </Card>
            )}

            <Card className="p-5 bg-muted/30" data-testid="card-confidence">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-bold text-foreground">AI Confidence</h3>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Confidence</span>
                  <span className="font-medium text-foreground">
                    {Math.round((community.aiConfidence ?? 0) * 100)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Sources</span>
                  <span className="font-medium text-foreground">{community.sourcesCount ?? 0}</span>
                </div>
                {formattedDate && (
                  <div className="flex justify-between">
                    <span>Last verified</span>
                    <span className="font-medium text-foreground">{formattedDate}</span>
                  </div>
                )}
              </div>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}

function safeHostname(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function PhotoGallery({
  images,
  communityName,
}: {
  images: CommunityWithRelations["images"];
  communityName: string;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const sortedImages = [...images].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return (
    <>
      <section data-testid="section-gallery">
        <div className="flex items-center gap-2 mb-4">
          <Camera className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-xl font-bold text-foreground">Photos</h2>
          <span className="text-sm text-muted-foreground">({sortedImages.length})</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {sortedImages.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setLightboxIndex(i)}
              className="relative aspect-[4/3] rounded-lg overflow-hidden group cursor-pointer border border-border hover:border-primary/40 transition-colors"
              data-testid={`gallery-image-${i}`}
            >
              <img
                src={img.imageUrl}
                alt={img.altText || `${communityName} photo ${i + 1}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              {safeHostname(img.sourceUrl) && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] text-white/70 truncate block">
                    Source: {safeHostname(img.sourceUrl)}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      </section>

      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
          data-testid="lightbox"
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2 z-10"
            data-testid="lightbox-close"
          >
            <X className="w-6 h-6" />
          </button>

          {lightboxIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
              className="absolute left-4 text-white/70 hover:text-white p-2 z-10"
              data-testid="lightbox-prev"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          {lightboxIndex < sortedImages.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
              className="absolute right-14 text-white/70 hover:text-white p-2 z-10"
              data-testid="lightbox-next"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}

          <img
            src={sortedImages[lightboxIndex].imageUrl}
            alt={sortedImages[lightboxIndex].altText || `${communityName} photo`}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          <div className="absolute bottom-4 text-center text-white/60 text-sm">
            {lightboxIndex + 1} / {sortedImages.length}
            {safeHostname(sortedImages[lightboxIndex].sourceUrl) && (
              <span className="ml-3">
                Source:{" "}
                <a
                  href={sortedImages[lightboxIndex].sourceUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/80 hover:text-white underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {safeHostname(sortedImages[lightboxIndex].sourceUrl)}
                </a>
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <Skeleton className="h-[360px] rounded-none" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-64 rounded-md" />
            <Skeleton className="h-24 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
