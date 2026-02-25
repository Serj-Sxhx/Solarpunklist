import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, CheckCircle2, XCircle, ExternalLink, Globe, MapPin } from "lucide-react";

function parseApiError(err: unknown): string {
  const msg = (err as any)?.message || "Something went wrong";
  try {
    const jsonMatch = msg.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.error || parsed.message || msg;
    }
  } catch {}
  return msg;
}

interface ScrapedEntry {
  name: string;
  url: string | null;
  location: string | null;
  isDuplicateInList: boolean;
  isDuplicateExisting: boolean;
}

interface ResearchResult {
  name: string;
  url: string;
  status: "success" | "error";
  slug?: string;
  error?: string;
}

type Step = "input" | "select" | "processing" | "done";

export default function DirectoryManagerPage() {
  const [step, setStep] = useState<Step>("input");
  const [directoryUrl, setDirectoryUrl] = useState("");
  const [entries, setEntries] = useState<ScrapedEntry[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [results, setResults] = useState<ResearchResult[]>([]);
  const [processingIndex, setProcessingIndex] = useState(-1);

  const scrapeMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest("POST", "/api/admin/scrape-directory", { url });
      return res.json();
    },
    onSuccess: (data: { entries: ScrapedEntry[] }) => {
      setEntries(data.entries);
      const defaultSelected = new Set<number>();
      data.entries.forEach((entry, i) => {
        if (!entry.isDuplicateInList && !entry.isDuplicateExisting) {
          defaultSelected.add(i);
        }
      });
      setSelected(defaultSelected);
      setStep("select");
    },
  });

  const handleScrape = () => {
    if (!directoryUrl.trim()) return;
    scrapeMutation.mutate(directoryUrl.trim());
  };

  const toggleEntry = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selectAll = () => {
    const all = new Set<number>();
    entries.forEach((_, i) => all.add(i));
    setSelected(all);
  };

  const deselectAll = () => {
    setSelected(new Set());
  };

  const selectNonDuplicates = () => {
    const nonDupes = new Set<number>();
    entries.forEach((entry, i) => {
      if (!entry.isDuplicateInList && !entry.isDuplicateExisting) {
        nonDupes.add(i);
      }
    });
    setSelected(nonDupes);
  };

  const handleContinue = async () => {
    const selectedEntries = entries
      .filter((_, i) => selected.has(i))
      .map((e) => ({ name: e.name, url: e.url }));

    if (selectedEntries.length === 0) return;

    setStep("processing");
    setResults([]);
    setProcessingIndex(0);

    const allResults: ResearchResult[] = [];

    for (let i = 0; i < selectedEntries.length; i++) {
      setProcessingIndex(i);
      const entry = selectedEntries[i];
      try {
        const res = await apiRequest("POST", "/api/admin/bulk-research", {
          entries: [entry],
        });
        const data = await res.json();
        const result = data.results?.[0] || {
          name: entry.name,
          url: entry.url,
          status: "error",
          error: "No result returned",
        };
        allResults.push(result);
      } catch (err: unknown) {
        allResults.push({
          name: entry.name,
          url: entry.url || "",
          status: "error",
          error: parseApiError(err),
        });
      }
      setResults([...allResults]);
    }

    setProcessingIndex(-1);
    setStep("done");
    queryClient.invalidateQueries({ queryKey: ["/api/communities"] });
  };

  const totalSelected = selected.size;
  const duplicatesInList = entries.filter((e) => e.isDuplicateInList).length;
  const duplicatesExisting = entries.filter((e) => e.isDuplicateExisting).length;
  const cleanEntries = entries.length - duplicatesInList - duplicatesExisting;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8" data-testid="directory-manager-page">
      <h1 className="text-3xl font-bold mb-2">Directory Manager</h1>
      <p className="text-muted-foreground mb-8">
        Scrape an external directory to bulk-add communities to SolarpunkList.
      </p>

      {step === "input" && (
        <Card data-testid="card-scrape-input">
          <CardHeader>
            <CardTitle>Step 1: Paste Directory URL</CardTitle>
            <CardDescription>
              Enter the URL of an external directory that lists intentional communities, ecovillages, or regenerative projects.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                data-testid="input-directory-url"
                placeholder="https://www.agartha.one/map"
                value={directoryUrl}
                onChange={(e) => setDirectoryUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleScrape()}
                disabled={scrapeMutation.isPending}
              />
              <Button
                data-testid="button-scrape"
                onClick={handleScrape}
                disabled={!directoryUrl.trim() || scrapeMutation.isPending}
              >
                {scrapeMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Scrape
                  </>
                )}
              </Button>
            </div>
            {scrapeMutation.isPending && (
              <p className="text-sm text-muted-foreground mt-3">
                Extracting community listings from the directory. This may take 15-30 seconds...
              </p>
            )}
            {scrapeMutation.isError && (
              <p className="text-sm text-red-500 mt-3" data-testid="text-scrape-error">
                {parseApiError(scrapeMutation.error)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {step === "select" && (
        <Card data-testid="card-select-entries">
          <CardHeader>
            <CardTitle>Step 2: Select Communities to Add</CardTitle>
            <CardDescription>
              Found {entries.length} communities. {cleanEntries} new, {duplicatesExisting} already in directory, {duplicatesInList} duplicates in list.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-4">
              <Button variant="outline" size="sm" onClick={selectAll} data-testid="button-select-all">
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll} data-testid="button-deselect-all">
                Deselect All
              </Button>
              <Button variant="outline" size="sm" onClick={selectNonDuplicates} data-testid="button-select-clean">
                Select Non-Duplicates
              </Button>
              <span className="text-sm text-muted-foreground ml-auto" data-testid="text-selected-count">
                {totalSelected} selected
              </span>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {entries.map((entry, i) => (
                <div
                  key={i}
                  data-testid={`row-entry-${i}`}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    selected.has(i)
                      ? "bg-accent/50 border-primary/20"
                      : "bg-background border-border"
                  } ${entry.isDuplicateInList || entry.isDuplicateExisting ? "opacity-70" : ""}`}
                >
                  <Checkbox
                    data-testid={`checkbox-entry-${i}`}
                    checked={selected.has(i)}
                    onCheckedChange={() => toggleEntry(i)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium truncate ${
                        entry.isDuplicateInList || entry.isDuplicateExisting ? "line-through" : ""
                      }`}>
                        {entry.name}
                      </span>
                      {entry.isDuplicateExisting && (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700 shrink-0" data-testid={`badge-existing-${i}`}>
                          Already in directory
                        </Badge>
                      )}
                      {entry.isDuplicateInList && (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 shrink-0" data-testid={`badge-duplicate-${i}`}>
                          Duplicate in list
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {entry.url && (
                        <span className="flex items-center gap-1 truncate">
                          <Globe className="w-3 h-3 shrink-0" />
                          {entry.url}
                        </span>
                      )}
                      {entry.location && (
                        <span className="flex items-center gap-1 shrink-0">
                          <MapPin className="w-3 h-3" />
                          {entry.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setStep("input");
                  setEntries([]);
                  setSelected(new Set());
                }}
                data-testid="button-back"
              >
                Back
              </Button>
              <Button
                onClick={handleContinue}
                disabled={totalSelected === 0}
                data-testid="button-continue"
              >
                Research & Add {totalSelected} {totalSelected === 1 ? "Community" : "Communities"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(step === "processing" || step === "done") && (
        <Card data-testid="card-processing">
          <CardHeader>
            <CardTitle>
              {step === "processing" ? "Step 3: Researching Communities..." : "Complete!"}
            </CardTitle>
            <CardDescription>
              {step === "processing"
                ? `Processing ${processingIndex + 1} of ${totalSelected}...`
                : `Finished processing ${results.length} communities.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {results.map((result, i) => (
                <div
                  key={i}
                  data-testid={`row-result-${i}`}
                  className="flex items-center gap-3 p-3 rounded-lg border"
                >
                  {result.status === "success" ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{result.name}</span>
                    {result.status === "error" && (
                      <p className="text-xs text-red-500 mt-0.5">{result.error}</p>
                    )}
                  </div>
                  {result.status === "success" && result.slug && (
                    <a
                      href={`/community/${result.slug}`}
                      className="text-sm text-primary hover:underline flex items-center gap-1 shrink-0"
                      data-testid={`link-view-${i}`}
                    >
                      View <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
              {step === "processing" && processingIndex >= 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-accent/30">
                  <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
                  <span className="text-sm text-muted-foreground">
                    Researching {entries.filter((_, i) => selected.has(i))[processingIndex]?.name || "..."}
                  </span>
                </div>
              )}
            </div>

            {step === "done" && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-muted-foreground">
                  {results.filter((r) => r.status === "success").length} added,{" "}
                  {results.filter((r) => r.status === "error").length} failed
                </div>
                <Button
                  onClick={() => {
                    setStep("input");
                    setDirectoryUrl("");
                    setEntries([]);
                    setSelected(new Set());
                    setResults([]);
                  }}
                  data-testid="button-start-over"
                >
                  Start Over
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
