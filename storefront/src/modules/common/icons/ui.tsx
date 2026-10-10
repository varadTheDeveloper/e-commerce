// Small line icons used across the shop (24px grid, inherit text colour).
type IconProps = React.SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 24, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icon>
)
export const UserIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></Icon>
)
export const HeartIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 20s-7-4.4-9-9a5 5 0 0 1 9-4 5 5 0 0 1 9 4c-2 4.6-9 9-9 9Z" /></Icon>
)
export const BagIcon = (p: IconProps) => (
  <Icon {...p}><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></Icon>
)
export const MenuIcon = (p: IconProps) => (
  <Icon {...p}><path d="M4 6h16M4 12h16M4 18h16" /></Icon>
)
export const HomeIcon = (p: IconProps) => (
  <Icon {...p}><path d="m3 11 9-7 9 7" /><path d="M5 10v10h14V10" /></Icon>
)
export const GridIcon = (p: IconProps) => (
  <Icon {...p}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></Icon>
)
export const CloseIcon = (p: IconProps) => (
  <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>
)
export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}><path d="m9 6 6 6-6 6" /></Icon>
)
export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>
)
export const TruckIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></Icon>
)
export const ReturnIcon = (p: IconProps) => (
  <Icon {...p}><path d="M4 10h11a5 5 0 0 1 0 10H8" /><path d="m8 6-4 4 4 4" /></Icon>
)
export const ShieldIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></Icon>
)
export const CashIcon = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9v.01M18 15v.01" /></Icon>
)
export const BadgeIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="9" r="6" /><path d="m8.5 14-1.5 7 5-3 5 3-1.5-7" /></Icon>
)
export const FilterIcon = (p: IconProps) => (
  <Icon {...p}><path d="M4 6h16M7 12h10M10 18h4" /></Icon>
)
export const SortIcon = (p: IconProps) => (
  <Icon {...p}><path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" /></Icon>
)
export const CheckIcon = (p: IconProps) => (
  <Icon {...p}><path d="m5 12 5 5 9-10" /></Icon>
)
export const RulerIcon = (p: IconProps) => (
  <Icon {...p}><rect x="2" y="8" width="20" height="8" rx="1.5" /><path d="M6 8v3M10 8v4M14 8v3M18 8v4" /></Icon>
)
export const PinIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z" /><circle cx="12" cy="9" r="2.5" /></Icon>
)
export const GlobeIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" /></Icon>
)
