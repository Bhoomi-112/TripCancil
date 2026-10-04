import {
  CalendarIcon,
  CameraIcon,
  FlagIcon,
  MapIcon,
  WalletIcon,
} from "@/components/ui/icons";

export type NavItem = {
  href: string;
  label: string;
  Icon: (props: { className?: string }) => React.ReactNode;
  hint: string;
};

export const navItems: NavItem[] = [
  { href: "/plan", label: "Plan", Icon: CalendarIcon, hint: "Day-by-day plan" },
  { href: "/map", label: "Map", Icon: MapIcon, hint: "Pins and routes" },
  { href: "/money", label: "Money", Icon: WalletIcon, hint: "Splits and settles" },
  { href: "/photos", label: "Photos", Icon: CameraIcon, hint: "Booth and album" },
  { href: "/trip", label: "Trip", Icon: FlagIcon, hint: "Members and settings" },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
