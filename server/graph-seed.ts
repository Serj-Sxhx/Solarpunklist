/**
 * Seeds the social graph with hardcoded known people from Edge City, OSE,
 * and the top solarpunk communities. Runs once if the people table is empty.
 */
import { storage } from "./storage";
import { fetchPersonAvatar } from "./people-image-fetcher";

interface SeedPerson {
  name: string;
  slug: string;
  title: string;
  bio?: string;
  website?: string;
  linkedIn?: string;
  role: string;
}

interface SeedOrg {
  name: string;
  slug: string;
  type: "external" | "community";
  website: string;
  description: string;
  people: SeedPerson[];
}

const SEED_ORGS: SeedOrg[] = [
  {
    name: "Edge City",
    slug: "edge-city",
    type: "external",
    website: "https://www.edgecity.live",
    description:
      "A popup city experiment building the future of cities and communities through month-long residencies.",
    people: [
      {
        name: "Timour Bourdoukan",
        slug: "timour-bourdoukan",
        title: "Co-founder",
        bio: "Co-founder of Edge City, building the future of cities through popup residencies and decentralized governance experiments.",
        website: "https://www.edgecity.live",
        role: "Co-founder",
      },
      {
        name: "Janine Leger",
        slug: "janine-leger",
        title: "Co-founder",
        bio: "Co-founder of Edge City. Works at the intersection of community design, technology, and governance.",
        website: "https://www.edgecity.live",
        role: "Co-founder",
      },
    ],
  },
  {
    name: "Open Source Ecology",
    slug: "open-source-ecology",
    type: "external",
    website: "https://www.opensourceecology.org",
    description:
      "Developing open source industrial machines that can be made for a fraction of commercial costs — the Global Village Construction Set.",
    people: [
      {
        name: "Marcin Jakubowski",
        slug: "marcin-jakubowski",
        title: "Founder & Executive Director",
        bio: "Founder of Open Source Ecology and creator of the Global Village Construction Set. PhD physicist turned open-source farmer and technologist.",
        website: "https://www.opensourceecology.org",
        linkedIn: "https://www.linkedin.com/in/marcin-jakubowski-5a47a49",
        role: "Founder",
      },
      {
        name: "Catarina Mota",
        slug: "catarina-mota",
        title: "Board Member & Open Hardware Advocate",
        bio: "Open hardware researcher and TED Fellow. Has collaborated with OSE on material science and fabrication.",
        website: "https://www.opensourceecology.org",
        role: "Advisor",
      },
    ],
  },
];

export async function seedGraphData(): Promise<void> {
  const existingCount = await storage.getPeopleCount();
  if (existingCount > 0) {
    console.log(`[graph-seed] Skipping — ${existingCount} people already in graph`);
    return;
  }

  console.log("[graph-seed] Seeding social graph with Edge City and OSE people...");

  for (const orgData of SEED_ORGS) {
    // Upsert org
    const org = await storage.upsertOrganization({
      name: orgData.name,
      slug: orgData.slug,
      type: orgData.type,
      website: orgData.website,
      description: orgData.description,
    });

    for (const personData of orgData.people) {
      // Fetch avatar
      let avatarUrl: string | null = null;
      try {
        avatarUrl = await fetchPersonAvatar(personData.name, personData.website);
        if (avatarUrl) console.log(`[graph-seed] Avatar found for ${personData.name}`);
      } catch (err) {
        console.error(`[graph-seed] Avatar fetch failed for ${personData.name}:`, err);
      }

      const person = await storage.upsertPerson({
        name: personData.name,
        slug: personData.slug,
        title: personData.title,
        bio: personData.bio,
        website: personData.website,
        linkedIn: personData.linkedIn,
        avatarUrl,
      });

      await storage.upsertPersonOrgEdge({
        personId: person.id,
        orgId: org.id,
        role: personData.role,
      });
    }
  }

  console.log("[graph-seed] Seed complete.");
}
