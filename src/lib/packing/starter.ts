import { LOCATION_TYPES } from "@/lib/constants";
import type { PackingCategory } from "./categories";

type LocationType = (typeof LOCATION_TYPES)[number];

export type StarterItem = {
  name: string;
  category: PackingCategory;
};

/**
 * The "Starter list" seed. Everything packs the seven no-brainers, then a vibe's
 * own kit on top, so a beach trip and a snow trip visibly disagree from the
 * first tap. Pure and free of `server-only` so the board can preview how many
 * items a starter tap would add before anyone commits to it.
 */

const EVERYWHERE: StarterItem[] = [
  { name: "Phone charger", category: "gear" },
  { name: "Power bank", category: "gear" },
  { name: "Sunglasses", category: "gear" },
  { name: "Water bottle", category: "gear" },
  { name: "Toiletries kit", category: "toiletries" },
  { name: "Mini first-aid kit", category: "toiletries" },
  { name: "ID proof", category: "docs" },
];

const VIBE_ITEMS: Record<LocationType, StarterItem[]> = {
  beach: [
    { name: "Swimsuit", category: "clothes" },
    { name: "Flip-flops", category: "clothes" },
    { name: "Sun hat", category: "clothes" },
    { name: "Sunscreen SPF 50", category: "toiletries" },
    { name: "Beach towel", category: "gear" },
    { name: "Dry bag for phones", category: "gear" },
    { name: "After-sun aloe gel", category: "toiletries" },
    { name: "Beach snacks", category: "snacks" },
  ],
  mountain: [
    { name: "Warm jacket", category: "clothes" },
    { name: "Thermals", category: "clothes" },
    { name: "Trekking shoes", category: "gear" },
    { name: "Rain shell", category: "clothes" },
    { name: "Beanie & gloves", category: "clothes" },
    { name: "Trekking pole", category: "gear" },
    { name: "Energy bars", category: "snacks" },
    { name: "Sunscreen & lip balm", category: "toiletries" },
  ],
  city: [
    { name: "Comfortable walking shoes", category: "clothes" },
    { name: "Light layers", category: "clothes" },
    { name: "Small day bag", category: "gear" },
    { name: "Umbrella", category: "gear" },
    { name: "Metro/recharge card", category: "docs" },
    { name: "Hand sanitiser", category: "toiletries" },
    { name: "Snack stash", category: "snacks" },
  ],
  forest: [
    { name: "Insect repellent", category: "toiletries" },
    { name: "Raincoat", category: "clothes" },
    { name: "Closed shoes", category: "gear" },
    { name: "Long sleeves", category: "clothes" },
    { name: "Torch", category: "gear" },
    { name: "Ziplock bags", category: "gear" },
    { name: "Trail mix", category: "snacks" },
  ],
  desert: [
    { name: "Wide-brim hat", category: "clothes" },
    { name: "Scarf for dust", category: "clothes" },
    { name: "Sunscreen SPF 50", category: "toiletries" },
    { name: "Lots of water", category: "gear" },
    { name: "Lip balm", category: "toiletries" },
    { name: "Dry snacks", category: "snacks" },
  ],
  heritage: [
    { name: "Comfortable shoes", category: "gear" },
    { name: "Hat or headscarf", category: "clothes" },
    { name: "Camera", category: "gear" },
    { name: "Notebook & pen", category: "gear" },
    { name: "Entry passes", category: "docs" },
    { name: "Water bottle", category: "gear" },
  ],
  snow: [
    { name: "Snow jacket", category: "clothes" },
    { name: "Thermals & fleece", category: "clothes" },
    { name: "Waterproof boots", category: "gear" },
    { name: "Beanie & gloves & scarf", category: "clothes" },
    { name: "Moisturiser", category: "toiletries" },
    { name: "Hand warmers", category: "gear" },
    { name: "Chocolate & bars", category: "snacks" },
  ],
  roadtrip: [
    { name: "Car phone charger", category: "gear" },
    { name: "Water bottles", category: "gear" },
    { name: "Road snacks", category: "snacks" },
    { name: "Music playlist", category: "other" },
    { name: "Papers & challan pouch", category: "docs" },
    { name: "Neck pillow", category: "clothes" },
    { name: "Emergency kit", category: "gear" },
  ],
};

export function starterItemsFor(locationType: LocationType): StarterItem[] {
  return [...EVERYWHERE, ...(VIBE_ITEMS[locationType] ?? [])];
}