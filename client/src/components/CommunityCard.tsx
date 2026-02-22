import { Link } from "wouter";
import { MapPin, Calendar, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StageBadge } from "@/components/StageBadge";
import { ScoreDisplay } from "@/components/ScoreDisplay";
import { getCountryFlag } from "@/lib/constants";
import type { CommunityWithRelations } from "@shared/schema";

interface CommunityCardProps {
  community: CommunityWithRelations;
}

export function CommunityCard({ community }: CommunityCardProps) {
  const flag = getCountryFlag(community.locationCountry);
  const lastVerified = community.lastRefreshedAt || community.lastResearchedAt || community.createdAt;
  const formattedDate = lastVerified
    ? new Date(lastVerified).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : null;

  return (
    <Link href={`/community/${community.slug}`}>
      <Card
        className="group cursor-pointer border-card-border bg-card transition-all duration-200 hover:shadow-md rounded-xl flex flex-col h-full"
        data-testid={`card-community-${community.slug}`}
      >
        <div className="relative aspect-[16/10] rounded-t-xl overflow-hidden bg-muted">
          {community.heroImageUrl ? (
            <img
              src={community.heroImageUrl}
              alt={community.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/30 dark:to-emerald-800/20">
              <span className="text-4xl opacity-40">🌿</span>
            </div>
          )}
          <div className="absolute top-3 left-3">
            <StageBadge stage={community.stage} size="sm" />
          </div>
          <div className="absolute top-3 right-3">
            <ScoreDisplay score={community.solarpunkScore} size="sm" />
          </div>
        </div>

        <div className="p-4 flex flex-col flex-1 gap-2.5">
          <div>
            <h3 className="font-bold text-base leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-1" data-testid={`text-name-${community.slug}`}>
              {community.name}
            </h3>
            {community.tagline && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                {community.tagline}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {flag && <span className="mr-1">{flag}</span>}
              {community.locationRegion && `${community.locationRegion}, `}
              {community.locationCountry || "Unknown"}
            </span>
          </div>

          {community.tags && community.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-auto">
              {community.tags.slice(0, 4).map((t) => (
                <Badge
                  key={t.id}
                  variant="secondary"
                  className="text-xs font-medium px-2 py-0.5"
                  data-testid={`tag-${t.tag}`}
                >
                  {t.tag}
                </Badge>
              ))}
              {community.tags.length > 4 && (
                <Badge variant="secondary" className="text-xs font-medium px-2 py-0.5">
                  +{community.tags.length - 4}
                </Badge>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2 mt-auto border-t border-border/50">
            {formattedDate && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Verified {formattedDate}
              </span>
            )}
            {community.websiteUrl && (
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
