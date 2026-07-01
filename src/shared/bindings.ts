// Centralised key/mouse-binding conflict detection.
//
// "Trigger" bindings (global hotkeys + the hold-trigger keys) all share one
// namespace: pressing one physical key/button must map to exactly one action.
// This module normalises every binding — whether it's an Electron accelerator
// like "F6" / "Control+Shift+K" or a logical hold key like "f" / "mouse-left" —
// to a single canonical token, so they can be compared regardless of source.
//
// Pure and dependency-free (no Electron / native imports) so it runs in the
// renderer, where assignments happen and are rejected before being applied.

import type { AppSettings, Profile } from './types'

/** Global-accelerator settings fields that act as triggers. */
export type AcceleratorField =
  | 'toggleHotkey'
  | 'emergencyHotkey'
  | 'recordPositionHotkey'
  | 'holdKeysHotkey'
  | 'macroRecordHotkey'

/** Per-profile hold-trigger keys (their `.key` field). */
export type HoldField = 'holdToSpam' | 'focusHold' | 'rightClickHold'

export type BindingField = AcceleratorField | HoldField

export const ACCELERATOR_FIELDS: AcceleratorField[] = [
  'toggleHotkey',
  'emergencyHotkey',
  'recordPositionHotkey',
  'holdKeysHotkey',
  'macroRecordHotkey'
]

export const HOLD_FIELDS: HoldField[] = ['holdToSpam', 'focusHold', 'rightClickHold']

/** Human-readable name shown in the conflict message for each binding. */
export const FEATURE_NAMES: Record<BindingField, string> = {
  toggleHotkey: 'Toggle Hotkey',
  emergencyHotkey: 'Emergency Stop',
  recordPositionHotkey: 'Record Position Hotkey',
  holdKeysHotkey: 'Hold Keys Down Hotkey',
  macroRecordHotkey: 'Macro Record Hotkey',
  holdToSpam: 'Hold-to-Spam Key',
  focusHold: 'Focus Hold Key',
  rightClickHold: 'Hold for Right-Click'
}

export function isHoldField(field: BindingField): field is HoldField {
  return field === 'holdToSpam' || field === 'focusHold' || field === 'rightClickHold'
}

export interface Binding {
  field: BindingField
  value: string
}

/** Gather every current trigger binding from settings + the active profile. */
export function collectBindings(settings: AppSettings, profile: Profile): Binding[] {
  const out: Binding[] = []
  for (const field of ACCELERATOR_FIELDS) out.push({ field, value: settings[field] ?? '' })
  for (const field of HOLD_FIELDS) out.push({ field, value: profile[field]?.key ?? '' })
  return out
}

// Map an accelerator base token OR a logical key name to one lowercase name, so
// e.g. accelerator "F6" and hold key "f6", or "Space" and "space", compare equal.
const BASE_TO_LOGICAL: Record<string, string> = {
  return: 'enter',
  esc: 'escape',
  num0: 'numpad0',
  num1: 'numpad1',
  num2: 'numpad2',
  num3: 'numpad3',
  num4: 'numpad4',
  num5: 'numpad5',
  num6: 'numpad6',
  num7: 'numpad7',
  num8: 'numpad8',
  num9: 'numpad9',
  numadd: 'numpadadd',
  numsub: 'numpadsubtract',
  nummult: 'numpadmultiply',
  numdiv: 'numpaddivide',
  numdec: 'numpaddecimal'
}

function baseToLogical(token: string): string {
  const lower = token.trim().toLowerCase()
  return BASE_TO_LOGICAL[lower] ?? lower
}

function normalizeModifier(mod: string): string {
  const lower = mod.trim().toLowerCase()
  if (['commandorcontrol', 'cmdorctrl', 'control', 'ctrl', 'command', 'cmd'].includes(lower)) return 'ctrl'
  if (['alt', 'option'].includes(lower)) return 'alt'
  if (lower === 'shift') return 'shift'
  if (['super', 'meta', 'win'].includes(lower)) return 'meta'
  return lower
}

/**
 * Canonical token for any binding value. Plain single keys (whether written as
 * an accelerator base or a logical name) collapse to `key:<name>`; mouse buttons
 * to `mouse:<side>`; modified accelerators to a normalised `combo:<mods>+<base>`.
 * Returns null for an empty/unset binding.
 */
export function canonicalBinding(value: string): string | null {
  const v = (value ?? '').trim()
  if (!v) return null
  // Mouse buttons: mouse-left/right/middle/4/5 -> mouse:left/right/middle/4/5.
  if (v.startsWith('mouse-')) return `mouse:${v.slice('mouse-'.length)}`

  const parts = v.split('+').filter(Boolean)
  if (parts.length > 1) {
    const mods = parts.slice(0, -1).map(normalizeModifier).sort()
    const base = baseToLogical(parts[parts.length - 1])
    return `combo:${mods.join('+')}+${base}`
  }
  return `key:${baseToLogical(v)}`
}

export interface BindingConflict {
  field: BindingField
  feature: string
}

/**
 * Find an existing binding (other than `field` itself) that resolves to the same
 * physical key/button as `value`, or null if the value is free to assign.
 */
export function findBindingConflict(
  bindings: Binding[],
  field: BindingField,
  value: string
): BindingConflict | null {
  const token = canonicalBinding(value)
  if (!token) return null
  for (const b of bindings) {
    if (b.field === field || !b.value) continue
    if (canonicalBinding(b.value) === token) {
      return { field: b.field, feature: FEATURE_NAMES[b.field] }
    }
  }
  return null
}

const MOUSE_LABELS: Record<string, string> = {
  'mouse-left': 'LMB',
  'mouse-right': 'RMB',
  'mouse-middle': 'MMB',
  'mouse-4': 'MB4',
  'mouse-5': 'MB5'
}

/** Friendly label for a binding value, used in the UI and conflict message. */
export function prettyBindingLabel(value: string): string {
  if (value in MOUSE_LABELS) return MOUSE_LABELS[value]
  if (value.length === 1) return value.toUpperCase()
  if (value.startsWith('numpad')) return 'Numpad ' + value.slice(6)
  return value // accelerators (e.g. "F6", "Escape", "Control+Shift+K") read fine as-is
}

/** The error message shown when a binding is already in use. */
export function conflictMessage(value: string, feature: string): string {
  const label = prettyBindingLabel(value)
  const isMouse = value.startsWith('mouse-')
  return isMouse
    ? `${label} is already bound to ${feature}`
    : `The key ${label} is already bound to ${feature}`
}
