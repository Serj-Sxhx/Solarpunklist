export const REGIONS = [
  "North America",
  "South America",
  "Europe",
  "Africa",
  "Asia",
  "Oceania",
] as const;

export const TECHNOLOGIES = [
  "Solar/Wind",
  "IoT/Sensors",
  "Robotics",
  "Aquaponics",
  "Blockchain/DAO",
  "Water Systems",
  "3D Printing",
  "Drones",
  "AI/Automation",
  "Biogas",
  "Mycelium Tech",
] as const;

export const STAGES = ["forming", "established", "mature", "dormant"] as const;

export const VALUES_TAGS = [
  "Open Source",
  "Decentralized Governance",
  "Indigenous Practices",
  "BIPOC-Led",
  "Family-Friendly",
  "Visitors Welcome",
  "Accepting Members",
] as const;

export const SIZE_OPTIONS = [
  { label: "Small (<20)", value: "small" },
  { label: "Medium (20-100)", value: "medium" },
  { label: "Large (100+)", value: "large" },
] as const;

export const SORT_OPTIONS = [
  { label: "Solarpunk Score", value: "score" },
  { label: "Newest Added", value: "newest" },
  { label: "Alphabetical", value: "alpha" },
] as const;

export const STAGE_CONFIG = {
  forming: {
    label: "Forming",
    icon: "🌱",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    dotColor: "bg-amber-500",
  },
  established: {
    label: "Established",
    icon: "🌿",
    color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    dotColor: "bg-emerald-500",
  },
  mature: {
    label: "Mature",
    icon: "🌳",
    color: "bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-300",
    dotColor: "bg-green-700",
  },
  dormant: {
    label: "Dormant",
    icon: "🍂",
    color: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
    dotColor: "bg-gray-400",
  },
} as const;

export const SCORE_DIMENSIONS = [
  { key: "scoreEnergy", label: "Renewable Energy", icon: "sun", weight: 20 },
  { key: "scoreLand", label: "Regenerative Land", icon: "leaf", weight: 20 },
  { key: "scoreTech", label: "Tech Innovation", icon: "cpu", weight: 20 },
  { key: "scoreGovernance", label: "Governance", icon: "landmark", weight: 15 },
  { key: "scoreCommunity", label: "Community", icon: "users", weight: 15 },
  { key: "scoreCircularity", label: "Circularity", icon: "refresh-cw", weight: 10 },
] as const;

export const COUNTRY_FLAGS: Record<string, string> = {
  "United States": "🇺🇸",
  "USA": "🇺🇸",
  "Australia": "🇦🇺",
  "Portugal": "🇵🇹",
  "India": "🇮🇳",
  "Italy": "🇮🇹",
  "Netherlands": "🇳🇱",
  "Scotland": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "United Kingdom": "🇬🇧",
  "Canada": "🇨🇦",
  "Germany": "🇩🇪",
  "France": "🇫🇷",
  "Spain": "🇪🇸",
  "Brazil": "🇧🇷",
  "Costa Rica": "🇨🇷",
  "Mexico": "🇲🇽",
  "Japan": "🇯🇵",
  "Thailand": "🇹🇭",
  "New Zealand": "🇳🇿",
  "Denmark": "🇩🇰",
  "Sweden": "🇸🇪",
  "Colombia": "🇨🇴",
  "Kenya": "🇰🇪",
  "South Africa": "🇿🇦",
};

export function getCountryFlag(country: string | null | undefined): string {
  if (!country) return "";
  return COUNTRY_FLAGS[country] || "";
}

export function getScoreColor(score: number): string {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

export function getScoreBgColor(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}
