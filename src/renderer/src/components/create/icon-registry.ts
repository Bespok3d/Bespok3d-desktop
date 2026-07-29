// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ComponentType } from 'react'
import {
  IconBolt, IconPrinter, IconSpool, IconChip,
  IconFolder, IconSliders, IconLink, IconServer, IconGitBranch, IconLayers, IconShield,
  type IconProps,
} from '../../design-system/icons'

// The Create surface stores icons by NAME in its data (a starter or section carries `icon: 'IconBolt'`),
// so every surface resolves the name to a component through this one map (falling back to IconChip).
export const CREATE_ICONS: Record<string, ComponentType<IconProps>> = {
  IconBolt, IconPrinter, IconSpool, IconChip,
  IconFolder, IconSliders, IconLink, IconServer, IconGitBranch, IconLayers, IconShield,
}
