// gate-allow multi_exported_component_tsx: cohesive set of text-free icon-primitive SVG wrappers grouped by domain (connectivity + source control), not a kitchen-sink component file.
import { Icon, type IconProps } from './base'

export function IconGitHub(props: IconProps) {
  return (
    <Icon {...props} fill="currentColor" stroke="none">
      <path d="M12 2C6.48 2 2 6.58 2 12.22c0 4.51 2.87 8.34 6.85 9.69.5.1.68-.22.68-.49v-1.71c-2.79.62-3.38-1.35-3.38-1.35-.46-1.18-1.12-1.49-1.12-1.49-.91-.63.07-.62.07-.62 1.01.07 1.54 1.06 1.54 1.06.9 1.56 2.36 1.11 2.94.85.09-.67.35-1.11.64-1.37-2.22-.26-4.56-1.13-4.56-5.02 0-1.11.39-2.02 1.03-2.73-.1-.26-.45-1.29.1-2.69 0 0 .84-.27 2.75 1.04A9.4 9.4 0 0 1 12 7.4c.85 0 1.71.12 2.51.35 1.91-1.31 2.75-1.04 2.75-1.04.55 1.4.2 2.43.1 2.69.64.71 1.03 1.62 1.03 2.73 0 3.9-2.34 4.76-4.57 5.01.36.32.69.94.69 1.9v2.81c0 .27.18.6.69.49C19.13 20.56 22 16.73 22 12.22 22 6.58 17.52 2 12 2z" />
    </Icon>
  )
}

export function IconGitBranch(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="6" cy="5" r="2" />
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="9" r="2" />
      <path d="M6 7v10M8 5h6a4 4 0 0 1 4 4v0" />
    </Icon>
  )
}

export function IconExternalLink(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14 4h6v6M10 14 20 4M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" />
    </Icon>
  )
}

export function IconLink(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 14a4 4 0 0 0 5.6 0l2.8-2.8a4 4 0 1 0-5.6-5.6l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.6 0l-2.8 2.8a4 4 0 1 0 5.6 5.6l1-1" />
    </Icon>
  )
}

export function IconGlobe(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </Icon>
  )
}

export function IconCode(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />
    </Icon>
  )
}

export function IconKey(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="14" r="4" />
      <path d="m11 11 9-9M18 4l2 2M15 7l2 2" />
    </Icon>
  )
}

export function IconUsers(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="9" r="3.5" />
      <path d="M3 19a6 6 0 0 1 12 0" />
      <circle cx="17" cy="10" r="2.5" />
      <path d="M14.5 19a4.5 4.5 0 0 1 6.5-3" />
    </Icon>
  )
}
