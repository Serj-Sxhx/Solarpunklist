import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CommunityCardSkeleton() {
  return (
    <Card className="border-card-border bg-card rounded-xl flex flex-col">
      <Skeleton className="aspect-[16/10] rounded-t-xl rounded-b-none" />
      <div className="p-4 space-y-3">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
        </div>
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <div className="flex justify-between pt-2 border-t border-border/50">
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </Card>
  );
}
