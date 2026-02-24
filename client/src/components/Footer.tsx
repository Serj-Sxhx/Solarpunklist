import { useQuery } from "@tanstack/react-query";
import { Users, TrendingUp } from "lucide-react";

export function Footer() {
  const { data: stats } = useQuery<{ totalVisits: number; monthlyAverage: number }>({
    queryKey: ["/api/visit-stats"],
    refetchInterval: 60000,
  });

  return (
    <footer className="border-t border-border/40 bg-background" data-testid="footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            SolarpunkList — AI-powered directory of regenerative communities
          </p>
          {stats && stats.totalVisits > 0 && (
            <div className="flex items-center gap-4" data-testid="text-visit-stats">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="w-3.5 h-3.5" />
                <span>{stats.totalVisits.toLocaleString()} total visits</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{stats.monthlyAverage.toLocaleString()}/mo avg</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
