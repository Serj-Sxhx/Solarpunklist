import { useRef, useEffect, useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ForceGraph2D from "react-force-graph-2d";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, ExternalLink, X, Network } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

interface Organization {
  id: string;
  name: string;
  slug: string;
  type: string;
  website: string | null;
  description: string | null;
}

interface Person {
  id: string;
  name: string;
  slug: string;
  title: string | null;
  bio: string | null;
  website: string | null;
  avatarUrl: string | null;
  linkedIn: string | null;
}

interface Edge {
  id: string;
  personId: string;
  orgId: string;
  role: string | null;
}

interface GraphData {
  organizations: Organization[];
  people: Person[];
  edges: Edge[];
}

interface GraphNode {
  id: string;
  nodeType: "org" | "person";
  label: string;
  data: Organization | Person;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string;
  target: string;
  role?: string | null;
}

// Cache for loaded avatar images
const imageCache = new Map<string, HTMLImageElement>();

function loadImage(url: string): Promise<HTMLImageElement> {
  if (imageCache.has(url)) return Promise.resolve(imageCache.get(url)!);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { imageCache.set(url, img); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

export default function NetworkPage() {
  useSEO({
    title: "Network — People & Orgs | SolarpunkList",
    description: "Explore the people and organizations behind the solarpunk movement. A living network map of founders, builders, and community leaders.",
    ogTitle: "SolarpunkList Network",
    ogDescription: "People and orgs driving the solarpunk movement.",
  });

  const { data, isLoading, error } = useQuery<GraphData>({
    queryKey: ["/api/graph"],
  });

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);

  // Preload avatar images
  useEffect(() => {
    if (!data) return;
    data.people.forEach((p) => {
      if (p.avatarUrl) loadImage(p.avatarUrl).catch(() => {});
    });
  }, [data]);

  // Responsive dimensions
  useEffect(() => {
    function update() {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: Math.max(500, window.innerHeight - 200),
        });
      }
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const graphData = useCallback((): { nodes: GraphNode[]; links: GraphLink[] } => {
    if (!data) return { nodes: [], links: [] };

    const nodes: GraphNode[] = [
      ...data.organizations.map((org) => ({
        id: `org-${org.id}`,
        nodeType: "org" as const,
        label: org.name,
        data: org,
      })),
      ...data.people.map((person) => ({
        id: `person-${person.id}`,
        nodeType: "person" as const,
        label: person.name,
        data: person,
      })),
    ];

    const links: GraphLink[] = data.edges.map((edge) => ({
      source: `person-${edge.personId}`,
      target: `org-${edge.orgId}`,
      role: edge.role,
    }));

    return { nodes, links };
  }, [data]);

  const drawNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const graphNode = node as GraphNode;
    const x = node.x ?? 0;
    const y = node.y ?? 0;

    if (graphNode.nodeType === "org") {
      // Org node: rounded rectangle / pill
      const w = 80;
      const h = 32;
      const r = 8;
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + r, y - h / 2);
      ctx.lineTo(x + w / 2 - r, y - h / 2);
      ctx.quadraticCurveTo(x + w / 2, y - h / 2, x + w / 2, y - h / 2 + r);
      ctx.lineTo(x + w / 2, y + h / 2 - r);
      ctx.quadraticCurveTo(x + w / 2, y + h / 2, x + w / 2 - r, y + h / 2);
      ctx.lineTo(x - w / 2 + r, y + h / 2);
      ctx.quadraticCurveTo(x - w / 2, y + h / 2, x - w / 2, y + h / 2 - r);
      ctx.lineTo(x - w / 2, y - h / 2 + r);
      ctx.quadraticCurveTo(x - w / 2, y - h / 2, x - w / 2 + r, y - h / 2);
      ctx.closePath();

      // Determine color by org type
      const org = graphNode.data as Organization;
      const isExternal = org.type === "external";
      ctx.fillStyle = isExternal ? "#065f46" : "#14532d";
      ctx.fill();
      ctx.strokeStyle = "#34d399";
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();

      // Label
      ctx.font = `bold ${Math.max(8, 11 / globalScale)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ecfdf5";
      ctx.fillText(graphNode.label.length > 18 ? graphNode.label.slice(0, 16) + "…" : graphNode.label, x, y);
    } else {
      // Person node: circle with avatar or initials
      const person = graphNode.data as Person;
      const radius = 20;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = "#1e293b";
      ctx.fill();
      ctx.strokeStyle = "#4ade80";
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();

      if (person.avatarUrl && imageCache.has(person.avatarUrl)) {
        const img = imageCache.get(person.avatarUrl)!;
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius - 1.5 / globalScale, 0, 2 * Math.PI);
        ctx.clip();
        ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
        ctx.restore();
      } else {
        // Initials fallback
        const initials = graphNode.label
          .split(" ")
          .slice(0, 2)
          .map((w: string) => w[0])
          .join("")
          .toUpperCase();
        ctx.font = `bold ${Math.max(7, 10 / globalScale)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#4ade80";
        ctx.fillText(initials, x, y);
      }

      // Name label below circle
      const fontSize = Math.max(6, 9 / globalScale);
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#d1fae5";
      ctx.fillText(
        graphNode.label.length > 16 ? graphNode.label.slice(0, 14) + "…" : graphNode.label,
        x,
        y + radius + 3 / globalScale
      );
    }
  }, []);

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node as GraphNode);
  }, []);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const gd = graphData();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Network className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
              Solarpunk Network
            </h1>
            <p className="text-sm text-muted-foreground">
              People and organizations driving the movement
            </p>
          </div>
          {data && (
            <div className="ml-auto flex gap-3">
              <Badge variant="secondary" className="gap-1">
                <Users className="w-3 h-3" />
                {data.people.length} people
              </Badge>
              <Badge variant="outline" className="gap-1">
                {data.organizations.length} orgs
              </Badge>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center h-96">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-96">
            <p className="text-muted-foreground">Failed to load graph data.</p>
          </div>
        )}

        {data && gd.nodes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-96 text-center gap-4">
            <Network className="w-12 h-12 text-muted-foreground" />
            <div>
              <p className="font-semibold text-foreground">Graph is being seeded</p>
              <p className="text-sm text-muted-foreground mt-1">
                The network will populate after the enrichment pipeline runs.
              </p>
            </div>
          </div>
        )}

        {data && gd.nodes.length > 0 && (
          <div className="relative rounded-xl border border-border/60 overflow-hidden bg-[#0a1628]">
            <div ref={containerRef} className="w-full" data-testid="network-graph">
              <ForceGraph2D
                ref={graphRef}
                graphData={gd}
                width={dimensions.width}
                height={dimensions.height}
                nodeCanvasObject={drawNode}
                nodeCanvasObjectMode={() => "replace"}
                nodeLabel={() => ""}
                linkColor={() => "rgba(74, 222, 128, 0.3)"}
                linkWidth={1}
                backgroundColor="#0a1628"
                onNodeClick={handleNodeClick}
                onBackgroundClick={handleBackgroundClick}
                nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                  const graphNode = node as GraphNode;
                  if (graphNode.nodeType === "org") {
                    ctx.fillStyle = color;
                    ctx.fillRect(node.x - 40, node.y - 16, 80, 32);
                  } else {
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, 20, 0, 2 * Math.PI);
                    ctx.fillStyle = color;
                    ctx.fill();
                  }
                }}
                cooldownTicks={80}
                d3AlphaDecay={0.02}
                d3VelocityDecay={0.3}
              />
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 flex gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full border border-green-400 bg-slate-800 inline-block" />
                Person
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-6 h-3 rounded bg-green-900 border border-green-400 inline-block" />
                Organization
              </span>
            </div>

            <div className="absolute bottom-4 right-4 text-xs text-gray-500">
              Scroll to zoom · Drag to pan · Click to inspect
            </div>
          </div>
        )}

        {/* Detail panel */}
        {selectedNode && (
          <Card className="mt-4 p-5 border-border/60 relative">
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-3 right-3 h-7 w-7 p-0"
              onClick={() => setSelectedNode(null)}
              data-testid="button-close-node-detail"
            >
              <X className="w-4 h-4" />
            </Button>

            {selectedNode.nodeType === "person" ? (
              <PersonDetail person={selectedNode.data as Person} edges={data?.edges ?? []} orgs={data?.organizations ?? []} />
            ) : (
              <OrgDetail org={selectedNode.data as Organization} people={data?.people ?? []} edges={data?.edges ?? []} />
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function PersonDetail({
  person,
  edges,
  orgs,
}: {
  person: Person;
  edges: Edge[];
  orgs: Organization[];
}) {
  const personEdges = edges.filter((e) => e.personId === person.id);
  const personOrgs = personEdges
    .map((e) => ({ org: orgs.find((o) => o.id === e.orgId), role: e.role }))
    .filter((x) => x.org);

  return (
    <div className="flex gap-4">
      <div className="shrink-0">
        {person.avatarUrl ? (
          <img
            src={person.avatarUrl}
            alt={person.name}
            className="w-16 h-16 rounded-full object-cover border-2 border-primary/30"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
            {person.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="font-bold text-lg text-foreground leading-tight" data-testid="text-node-name">{person.name}</h2>
        {person.title && <p className="text-sm text-primary font-medium">{person.title}</p>}
        {personOrgs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {personOrgs.map(({ org, role }) => (
              <Badge key={org!.id} variant="secondary" className="text-xs">
                {role ? `${role} @ ` : ""}{org!.name}
              </Badge>
            ))}
          </div>
        )}
        {person.bio && <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{person.bio}</p>}
        <div className="flex gap-2 mt-3">
          {person.website && (
            <a href={person.website} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" data-testid="link-person-website">
                <ExternalLink className="w-3.5 h-3.5" />
                Website
              </Button>
            </a>
          )}
          {person.linkedIn && (
            <a href={person.linkedIn} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" data-testid="link-person-linkedin">
                LinkedIn
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function OrgDetail({
  org,
  people: allPeople,
  edges,
}: {
  org: Organization;
  people: Person[];
  edges: Edge[];
}) {
  const orgEdges = edges.filter((e) => e.orgId === org.id);
  const orgPeople = orgEdges
    .map((e) => ({ person: allPeople.find((p) => p.id === e.personId), role: e.role }))
    .filter((x) => x.person);

  return (
    <div>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Network className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-bold text-lg text-foreground leading-tight" data-testid="text-node-name">{org.name}</h2>
          <Badge variant="outline" className="text-xs capitalize mt-0.5">{org.type}</Badge>
        </div>
        {org.website && (
          <a href={org.website} target="_blank" rel="noopener noreferrer" className="ml-auto">
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" data-testid="link-org-website">
              <ExternalLink className="w-3.5 h-3.5" />
              Visit
            </Button>
          </a>
        )}
      </div>
      {org.description && (
        <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{org.description}</p>
      )}
      {orgPeople.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            People ({orgPeople.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {orgPeople.map(({ person, role }) => (
              <div key={person!.id} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
                {person!.avatarUrl ? (
                  <img src={person!.avatarUrl} alt={person!.name} className="w-6 h-6 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                    {person!.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium text-foreground">{person!.name}</p>
                  {role && <p className="text-[10px] text-muted-foreground">{role}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
