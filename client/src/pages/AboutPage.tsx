import { Link } from "wouter";
import { ArrowLeft, Leaf, Search, RefreshCw, BarChart3, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-6 -ml-2">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Directory
          </Button>
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Leaf className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            About SolarpunkList
          </h1>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <p className="text-lg text-muted-foreground leading-relaxed">
            SolarpunkList is a web directory of solarpunk intentional communities and regenerative
            land projects. Think of it as a curated guide to the places where technology meets the
            terrain - communities weaving together permaculture with IoT sensors, solar microgrids
            with decentralized governance, and regenerative agriculture with robotics.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 not-prose mt-8">
            <Card className="p-5 space-y-2">
              <Search className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-sm text-foreground">AI Discovery</h3>
              <p className="text-sm text-muted-foreground">
                Our AI engine scours the web weekly using semantic search to discover new communities
                and regenerative projects.
              </p>
            </Card>
            <Card className="p-5 space-y-2">
              <RefreshCw className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-sm text-foreground">Monthly Refresh</h3>
              <p className="text-sm text-muted-foreground">
                Every existing entry is re-researched monthly to catch status changes, new photos,
                updated tech, or dormant projects.
              </p>
            </Card>
            <Card className="p-5 space-y-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-sm text-foreground">Solarpunk Score</h3>
              <p className="text-sm text-muted-foreground">
                Each community is scored across 6 dimensions: energy, land, tech, governance,
                community, and circularity.
              </p>
            </Card>
            <Card className="p-5 space-y-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-sm text-foreground">Rich Profiles</h3>
              <p className="text-sm text-muted-foreground">
                AI-generated profiles with technology stacks, governance models, joining info,
                and sourced evidence.
              </p>
            </Card>
          </div>

          <h2 className="text-xl font-bold text-foreground mt-10">How It Works</h2>
          <p className="text-muted-foreground">
            SolarpunkList uses the Exa Search API for semantic web search and Anthropic's Claude
            for intelligent profile generation. When a new community is discovered, our pipeline
            collects everything available - website content, news articles, social media - and
            generates a comprehensive profile with scored dimensions.
          </p>
          <p className="text-muted-foreground">
            Communities are categorized by lifecycle stage (Forming, Established, Mature, or Dormant)
            and scored on a 0-100 scale across sustainability dimensions. This data is refreshed
            monthly to keep the directory current and trustworthy.
          </p>
        </div>
      </div>
    </div>
  );
}
