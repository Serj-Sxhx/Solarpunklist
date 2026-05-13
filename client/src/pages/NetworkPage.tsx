import { useRef, useEffect, useCallback, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import ForceGraph2D from "react-force-graph-2d";
import type { ForceGraphMethods, NodeObject } from "react-force-graph-2d";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Users, ExternalLink, X, Network, UserPlus } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

// Custom data attached to each force-graph node
interface NodeData {
  nodeType: "org" | "person";
  label: string;
  org?: Organization;
  person?: Person;
}

type FGNode = NodeObject<NodeData>;

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

interface AddYourselfFormData {
  name: string;
  title: string;
  orgId: string;
  bio: string;
  website: string;
  avatarUrl: string;
  website_confirm: string; // honeypot
}

function AddYourselfDialog({
  open,
  onClose,
  organizations,
}: {
  open: boolean;
  onClose: () => void;
  organizations: Organization[];
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<AddYourselfFormData>({
    name: "",
    title: "",
    orgId: "",
    bio: "",
    website: "",
    avatarUrl: "",
    website_confirm: "",
  });

  const mutation = useMutation({
    mutationFn: async (data: AddYourselfFormData) => {
      const resp = await apiRequest("POST", "/api/people/submit", data);
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/graph"] });
      toast({
        title: "Welcome to the network!",
        description: "Your profile has been added to the map.",
      });
      onClose();
      setForm({ name: "", title: "", orgId: "", bio: "", website: "", avatarUrl: "", website_confirm: "" });
    },
    onError: (err: any) => {
      toast({
        title: "Submission failed",
        description: err?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || form.name.trim().length < 2) {
      toast({ title: "Name required", description: "Please enter your name (at least 2 characters).", variant: "destructive" });
      return;
    }
    mutation.mutate(form);
  };

  const set = (field: keyof AddYourselfFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Yourself to the Network</DialogTitle>
          <DialogDescription>
            Join the map of people and organizations driving the solarpunk movement.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Honeypot field — hidden from real users */}
          <div className="hidden" aria-hidden="true">
            <input
              tabIndex={-1}
              autoComplete="off"
              name="website_confirm"
              value={form.website_confirm}
              onChange={set("website_confirm")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="person-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="person-name"
              data-testid="input-person-name"
              placeholder="Your full name"
              value={form.name}
              onChange={set("name")}
              maxLength={120}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="person-title">Title / Role</Label>
            <Input
              id="person-title"
              data-testid="input-person-title"
              placeholder="e.g. Founder, Designer, Farmer"
              value={form.title}
              onChange={set("title")}
              maxLength={120}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="person-org">Affiliated Community or Org</Label>
            <Select
              value={form.orgId}
              onValueChange={(val) => setForm((prev) => ({ ...prev, orgId: val }))}
            >
              <SelectTrigger id="person-org" data-testid="select-person-org">
                <SelectValue placeholder="Select a community or org (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None / Independent</SelectItem>
                {organizations
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((org) => (
                    <SelectItem key={org.id} value={org.id} data-testid={`option-org-${org.id}`}>
                      {org.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="person-bio">Bio</Label>
            <Textarea
              id="person-bio"
              data-testid="input-person-bio"
              placeholder="A short intro — your work, interests, or what you're building"
              value={form.bio}
              onChange={set("bio")}
              maxLength={1000}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="person-website">Website</Label>
            <Input
              id="person-website"
              data-testid="input-person-website"
              placeholder="https://yoursite.com"
              type="url"
              value={form.website}
              onChange={set("website")}
              maxLength={500}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="person-avatar">Photo URL</Label>
            <Input
              id="person-avatar"
              data-testid="input-person-avatar"
              placeholder="https://example.com/your-photo.jpg"
              type="url"
              value={form.avatarUrl}
              onChange={set("avatarUrl")}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">Link to a portrait photo of yourself (optional)</p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-add-person">
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-add-person">
              {mutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding…
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Join the Network
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
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

  const [selectedNode, setSelectedNode] = useState<FGNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods | undefined>(undefined);

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

  const buildGraphData = useCallback(() => {
    if (!data) return { nodes: [] as FGNode[], links: [] as Array<{ source: string; target: string; role?: string | null }> };

    const nodes: FGNode[] = [
      ...data.organizations.map((org) => ({
        id: `org-${org.id}`,
        nodeType: "org" as const,
        label: org.name,
        org,
      })),
      ...data.people.map((person) => ({
        id: `person-${person.id}`,
        nodeType: "person" as const,
        label: person.name,
        person,
      })),
    ];

    const links = data.edges.map((edge) => ({
      source: `person-${edge.personId}`,
      target: `org-${edge.orgId}`,
      role: edge.role,
    }));

    return { nodes, links };
  }, [data]);

  const drawNode = useCallback((node: FGNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const x = node.x ?? 0;
    const y = node.y ?? 0;

    if (node.nodeType === "org") {
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
      ctx.fillStyle = node.org?.type === "external" ? "#065f46" : "#14532d";
      ctx.fill();
      ctx.strokeStyle = "#34d399";
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();
      ctx.font = `bold ${Math.max(8, 11 / globalScale)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ecfdf5";
      ctx.fillText(node.label.length > 18 ? node.label.slice(0, 16) + "…" : node.label, x, y);
    } else {
      const radius = 20;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = "#1e293b";
      ctx.fill();
      ctx.strokeStyle = "#4ade80";
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();

      const avatarUrl = node.person?.avatarUrl;
      if (avatarUrl && imageCache.has(avatarUrl)) {
        const img = imageCache.get(avatarUrl)!;
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius - 1.5 / globalScale, 0, 2 * Math.PI);
        ctx.clip();
        ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
        ctx.restore();
      } else {
        const initials = node.label.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
        ctx.font = `bold ${Math.max(7, 10 / globalScale)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#4ade80";
        ctx.fillText(initials, x, y);
      }

      const fontSize = Math.max(6, 9 / globalScale);
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#d1fae5";
      ctx.fillText(node.label.length > 16 ? node.label.slice(0, 14) + "…" : node.label, x, y + radius + 3 / globalScale);
    }
  }, []);

  const paintPointerArea = useCallback((node: FGNode, color: string, ctx: CanvasRenderingContext2D) => {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    if (node.nodeType === "org") {
      ctx.fillStyle = color;
      ctx.fillRect(x - 40, y - 16, 80, 32);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }, []);

  const handleNodeClick = useCallback((node: FGNode) => {
    setSelectedNode(node);
  }, []);

  const gd = buildGraphData();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Network className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Solarpunk Network</h1>
            <p className="text-sm text-muted-foreground">People and organizations driving the movement</p>
          </div>
          <div className="ml-auto flex items-center gap-3 flex-wrap justify-end">
            {data && (
              <>
                <Badge variant="secondary" className="gap-1">
                  <Users className="w-3 h-3" />
                  {data.people.length} people
                </Badge>
                <Badge variant="outline">{data.organizations.length} orgs</Badge>
              </>
            )}
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setAddDialogOpen(true)}
              data-testid="button-add-yourself"
            >
              <UserPlus className="w-4 h-4" />
              Add Yourself
            </Button>
          </div>
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
              <p className="text-sm text-muted-foreground mt-1">The network will populate after the enrichment pipeline runs.</p>
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
                onBackgroundClick={() => setSelectedNode(null)}
                nodePointerAreaPaint={paintPointerArea}
                cooldownTicks={80}
                d3AlphaDecay={0.02}
                d3VelocityDecay={0.3}
              />
            </div>
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
              <PersonDetail
                person={selectedNode.person!}
                edges={data?.edges ?? []}
                orgs={data?.organizations ?? []}
              />
            ) : (
              <OrgDetail
                org={selectedNode.org!}
                people={data?.people ?? []}
                edges={data?.edges ?? []}
              />
            )}
          </Card>
        )}
      </div>

      <AddYourselfDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        organizations={data?.organizations ?? []}
      />
    </div>
  );
}

function PersonDetail({ person, edges, orgs }: { person: Person; edges: Edge[]; orgs: Organization[] }) {
  const personEdges = edges.filter((e) => e.personId === person.id);
  const personOrgs = personEdges
    .map((e) => ({ org: orgs.find((o) => o.id === e.orgId), role: e.role }))
    .filter((x): x is { org: Organization; role: string | null } => x.org !== undefined);

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
              <Badge key={org.id} variant="secondary" className="text-xs">
                {role ? `${role} @ ` : ""}{org.name}
              </Badge>
            ))}
          </div>
        )}
        {person.bio && <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{person.bio}</p>}
        <div className="flex gap-2 mt-3">
          {person.website && (
            <a href={person.website} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" data-testid="link-person-website">
                <ExternalLink className="w-3.5 h-3.5" />Website
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

function OrgDetail({ org, people: allPeople, edges }: { org: Organization; people: Person[]; edges: Edge[] }) {
  const orgEdges = edges.filter((e) => e.orgId === org.id);
  const orgPeople = orgEdges
    .map((e) => ({ person: allPeople.find((p) => p.id === e.personId), role: e.role }))
    .filter((x): x is { person: Person; role: string | null } => x.person !== undefined);

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
              <ExternalLink className="w-3.5 h-3.5" />Visit
            </Button>
          </a>
        )}
      </div>
      {org.description && <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{org.description}</p>}
      {orgPeople.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">People ({orgPeople.length})</p>
          <div className="flex flex-wrap gap-2">
            {orgPeople.map(({ person, role }) => (
              <div key={person.id} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
                {person.avatarUrl ? (
                  <img src={person.avatarUrl} alt={person.name} className="w-6 h-6 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                    {person.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium text-foreground">{person.name}</p>
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
