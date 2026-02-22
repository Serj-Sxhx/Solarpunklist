import { useState } from "react";
import { Search, SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { REGIONS, STAGES, STAGE_CONFIG, SORT_OPTIONS } from "@/lib/constants";

export interface FilterState {
  search: string;
  regions: string[];
  stages: string[];
  sort: string;
}

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  totalCount: number;
}

export function FilterBar({ filters, onFiltersChange, totalCount }: FilterBarProps) {
  const [searchValue, setSearchValue] = useState(filters.search);

  const handleSearchSubmit = () => {
    onFiltersChange({ ...filters, search: searchValue });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearchSubmit();
  };

  const toggleArrayFilter = (
    key: "regions" | "stages",
    value: string
  ) => {
    const current = filters[key];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [key]: updated });
  };

  const activeFilterCount =
    filters.regions.length + filters.stages.length + (filters.search ? 1 : 0);

  const clearAllFilters = () => {
    setSearchValue("");
    onFiltersChange({ search: "", regions: [], stages: [], sort: "score" });
  };

  return (
    <div className="space-y-3" data-testid="filter-bar">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search communities..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onBlur={handleSearchSubmit}
            className="w-full h-9 pl-9 pr-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="input-search"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="default" data-testid="button-filter-region">
                <MapPinIcon />
                Region
                {filters.regions.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                    {filters.regions.length}
                  </Badge>
                )}
                <ChevronDown className="w-3.5 h-3.5 ml-1" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-3">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Region</p>
                {REGIONS.map((region) => (
                  <label
                    key={region}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={filters.regions.includes(region)}
                      onCheckedChange={() => toggleArrayFilter("regions", region)}
                      data-testid={`checkbox-region-${region}`}
                    />
                    <span className="text-sm">{region}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="default" data-testid="button-filter-stage">
                <SlidersHorizontal className="w-4 h-4" />
                Stage
                {filters.stages.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                    {filters.stages.length}
                  </Badge>
                )}
                <ChevronDown className="w-3.5 h-3.5 ml-1" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-3">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Stage</p>
                {STAGES.map((stage) => {
                  const config = STAGE_CONFIG[stage];
                  return (
                    <label
                      key={stage}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={filters.stages.includes(stage)}
                        onCheckedChange={() => toggleArrayFilter("stages", stage)}
                        data-testid={`checkbox-stage-${stage}`}
                      />
                      <span className={`inline-block w-2 h-2 rounded-full ${config.dotColor}`} />
                      <span className="text-sm">{config.label}</span>
                    </label>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          <Select
            value={filters.sort}
            onValueChange={(val) => onFiltersChange({ ...filters, sort: val })}
          >
            <SelectTrigger className="w-[160px]" data-testid="select-sort">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {filters.regions.map((r) => (
            <Badge
              key={r}
              variant="secondary"
              className="text-xs cursor-pointer gap-1"
              onClick={() => toggleArrayFilter("regions", r)}
              data-testid={`active-filter-${r}`}
            >
              {r}
              <X className="w-3 h-3" />
            </Badge>
          ))}
          {filters.stages.map((s) => (
            <Badge
              key={s}
              variant="secondary"
              className="text-xs cursor-pointer gap-1"
              onClick={() => toggleArrayFilter("stages", s)}
              data-testid={`active-filter-${s}`}
            >
              {STAGE_CONFIG[s as keyof typeof STAGE_CONFIG]?.label || s}
              <X className="w-3 h-3" />
            </Badge>
          ))}
          {activeFilterCount > 1 && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs h-6 px-2">
              Clear all
            </Button>
          )}
        </div>
        <span className="text-sm text-muted-foreground shrink-0" data-testid="text-result-count">
          {totalCount} {totalCount === 1 ? "community" : "communities"}
        </span>
      </div>
    </div>
  );
}

function MapPinIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
  );
}
