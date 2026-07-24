// gate-allow multi_exported_component_tsx: cohesive set of text-free icon-primitive SVG wrappers grouped by domain (printer hardware), not a kitchen-sink component file.
import { Icon, type IconProps } from './base'

export function IconPrinter(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 3v18M19 3v18" />
      <path d="M5 3h14" />
      <path d="M5 8h14" />
      <rect x="10" y="6.5" width="4" height="3" rx="0.6" />
      <path d="M12 9.5v2.5" />
      <path d="M3.5 18h17" />
      <rect x="9" y="13" width="6" height="5" rx="0.6" />
    </Icon>
  )
}

export function IconCamera(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 8a2 2 0 0 1 2-2h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13" r="3.6" />
    </Icon>
  )
}

export function IconChip(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
      <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
    </Icon>
  )
}

export function IconScreen(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M9 21h6M12 17v4" />
    </Icon>
  )
}

export function IconSpool(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21" />
    </Icon>
  )
}

export function IconWifi(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0" />
      <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function IconServer(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="7" rx="1.5" />
      <rect x="3" y="13" width="18" height="7" rx="1.5" />
      <path d="M7 7.5h.01M7 16.5h.01" />
    </Icon>
  )
}

export function IconBolt(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13 3 4 14h7l-1 7 9-11h-7z" />
    </Icon>
  )
}
