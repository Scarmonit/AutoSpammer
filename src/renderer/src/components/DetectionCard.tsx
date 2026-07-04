import React, { useEffect, useRef, useState } from 'react'
import type { DetectionTrigger, DetectionAction, DetectionProbeResult } from '@shared/types'
import { createDefaultDetectionTrigger } from '@shared/defaults'
import { SECTION_ACCENTS } from '@shared/sections'
import { useStore } from '../store'
import { Section } from './Section'
import { SectionToggle } from './SectionToggle'
import { CaptureButton } from './CaptureButton'
import { prettyName } from '../keycapture'

/** Which pick flow is in progress, and for which trigger row. */
interface Picking {
  id: string
  what: 'pixel' | 'template' | 'search'
}

/** Blur-committing "check every N ms" field (mid-typing values stay free). */
function PollField({ value, onCommit }: { value: number; onCommit: (ms: number) => void }): JSX.Element {
  const [draft, setDraft] = useState(String(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setDraft(String(value))
  }, [value, focused])

  const commit = (): void => {
    const n = Number(draft)
    const ms = Number.isFinite(n) && n > 0 ? Math.min(10000, Math.max(10, Math.round(n))) : value
    onCommit(ms)
    setDraft(String(ms))
  }

  return (
    <input
      className="input detrow__poll"
      type="number"
      min={10}
      max={10000}
      step={10}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        commit()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
    />
  )
}

/** "Detection triggers" card: watch a pixel/region, act when it matches. */
export function DetectionCard(): JSX.Element {
  const { activeProfile, updateProfile } = useStore()
  const [picking, setPicking] = useState<Picking | null>(null)
  const pickingRef = useRef<Picking | null>(null)
  pickingRef.current = picking

  // Live "now:" readout — what detection currently sees for each trigger.
  const [probes, setProbes] = useState<Record<string, DetectionProbeResult>>({})
  const hasTriggers = (activeProfile?.detection?.triggers.length ?? 0) > 0

  useEffect(() => {
    if (!hasTriggers) {
      setProbes({})
      return
    }
    let disposed = false
    let busy = false
    const poll = async (): Promise<void> => {
      // Skip while hidden or while the previous (possibly slow) probe runs.
      if (busy || document.visibilityState !== 'visible') return
      busy = true
      try {
        const results = await window.api.detectionProbe()
        if (!disposed) {
          setProbes(Object.fromEntries(results.map((r) => [r.id, r])))
        }
      } catch {
        /* probing is best-effort */
      } finally {
        busy = false
      }
    }
    void poll()
    const timer = setInterval(() => void poll(), 1000)
    return () => {
      disposed = true
      clearInterval(timer)
    }
  }, [hasTriggers])

  // Keep the latest updateProfile for the (once-subscribed) pick listeners.
  const updateRef = useRef(updateProfile)
  updateRef.current = updateProfile

  useEffect(() => {
    const patchTrigger = (id: string, patch: Partial<DetectionTrigger>): void =>
      updateRef.current((p) => ({
        ...p,
        detection: {
          ...p.detection,
          triggers: p.detection.triggers.map((t) => (t.id === id ? { ...t, ...patch } : t))
        }
      }))

    const offPixel = window.api.onPixelPicked(({ x, y, color }) => {
      const pk = pickingRef.current
      if (pk?.what !== 'pixel') return
      setPicking(null)
      patchTrigger(pk.id, { x, y, color })
    })
    const offRegion = window.api.onRegionCaptured(({ purpose, rect, image }) => {
      const pk = pickingRef.current
      if (!pk || pk.what !== purpose) return
      setPicking(null)
      if (purpose === 'template' && image) patchTrigger(pk.id, { image })
      else if (purpose === 'search') patchTrigger(pk.id, { searchArea: rect })
    })
    return () => {
      offPixel()
      offRegion()
      // Leave no pick mode dangling if the card unmounts mid-pick.
      if (pickingRef.current) {
        const { what } = pickingRef.current
        if (what === 'pixel') void window.api.detectionPickPixel(false)
        else void window.api.detectionCaptureRegion(false, what)
      }
    }
  }, [])

  if (!activeProfile) return <></>
  const det = activeProfile.detection
  const positions = activeProfile.clickPositions

  const setTriggers = (next: DetectionTrigger[]): void =>
    updateProfile((p) => ({ ...p, detection: { ...p.detection, triggers: next } }))

  const patchAt = (id: string, patch: Partial<DetectionTrigger>): void =>
    setTriggers(det.triggers.map((t) => (t.id === id ? { ...t, ...patch } : t)))

  const patchAction = (id: string, patch: Partial<DetectionAction>): void =>
    setTriggers(
      det.triggers.map((t) => (t.id === id ? { ...t, action: { ...t.action, ...patch } } : t))
    )

  /** Start/cancel a pick flow; only one can be active at a time. */
  const togglePick = (id: string, what: Picking['what']): void => {
    const active = picking?.id === id && picking.what === what
    // Always switch the previous mode off first (main keeps one mode anyway).
    if (picking) {
      if (picking.what === 'pixel') void window.api.detectionPickPixel(false)
      else void window.api.detectionCaptureRegion(false, picking.what)
    }
    if (active) {
      setPicking(null)
      return
    }
    if (what === 'pixel') void window.api.detectionPickPixel(true)
    else void window.api.detectionCaptureRegion(true, what)
    setPicking({ id, what })
  }

  const isPicking = (id: string, what: Picking['what']): boolean =>
    picking?.id === id && picking.what === what

  return (
    <Section
      title="Detection triggers"
      description="Watches the screen while running — fires an action only when a color or image appears."
      accent={SECTION_ACCENTS.detection}
      dim={!det.enabled}
      right={
        <SectionToggle
          checked={det.enabled}
          onChange={(v) => updateProfile((p) => ({ ...p, detection: { ...p.detection, enabled: v } }))}
          title="Run the detection triggers while spamming"
        />
      }
    >
      <p className="helper hint">
        <strong>Pick pixel</strong>: left-click any spot on screen to capture its position and
        color. <strong>Capture image</strong>: left-click two opposite corners of the area to
        match. The <strong>now</strong> readout shows live what Monit sees — if its ✓/✕ flickers,
        raise the ± tolerance. Triggers only fire <strong>while a run is active</strong> (start
        one with your Start/stop hotkey, default F6). While the condition stays true the action
        keeps firing every <strong>repeat every</strong> ms — so an interrupted press (stun, cast,
        no target) retries until it lands. <strong>keep firing</strong> holds the spam through a
        brief dip in the pixel/image (an on-use flash or global cooldown that momentarily changes
        the icon); raise it if firing stops too early, set 0 to stop the instant it's false.
        Pixel-color checks are cheap — set <strong>check every</strong> to 10–25 ms for near-instant
        reactions; image checks cost more, so give them a search area.
      </p>

      <div className="trigrows">
        {det.triggers.length === 0 && <p className="muted">No triggers yet — add one below.</p>}
        {det.triggers.map((t) => (
          <div className={`trigrow${t.enabled ? '' : ' trigrow--off'}`} key={t.id}>
            <span className="trigrow__switch">
              <SectionToggle
                small
                checked={t.enabled}
                onChange={(v) => patchAt(t.id, { enabled: v })}
                label="Trigger enabled"
                title="Enable this detection trigger"
              />
            </span>
            <div className="trigrow__main">
              <div className="trigrow__inline">
                <span className="keyrow__label">When</span>
                <select
                  className="input detrow__select"
                  value={t.mode}
                  onChange={(e) => patchAt(t.id, { mode: e.target.value === 'image' ? 'image' : 'color' })}
                >
                  <option value="color">pixel color</option>
                  <option value="image">image appears</option>
                </select>

                {t.mode === 'color' ? (
                  <>
                    <button
                      type="button"
                      className={`chipbtn${isPicking(t.id, 'pixel') ? ' chipbtn--recording' : ''}`}
                      title="Left-click anywhere on screen to capture that pixel and its color"
                      onClick={() => togglePick(t.id, 'pixel')}
                    >
                      {isPicking(t.id, 'pixel') ? '● Click a spot…' : 'Pick pixel'}
                    </button>
                    {t.color !== '' && (
                      <>
                        <span
                          className="detrow__swatch"
                          style={{ background: t.color }}
                          title={`Watched color ${t.color}`}
                        />
                        <span className="detrow__hex">{t.color}</span>
                        <span className="detrow__xy">
                          at ({t.x}, {t.y})
                        </span>
                        {probes[t.id]?.currentColor && (
                          <span
                            className={`detrow__now${probes[t.id].matched ? ' detrow__now--hit' : ''}`}
                            title={`The pixel is ${probes[t.id].currentColor} right now — ${
                              probes[t.id].matched ? 'within' : 'outside'
                            } the ± tolerance`}
                          >
                            now
                            <span
                              className="detrow__swatch detrow__swatch--sm"
                              style={{ background: probes[t.id].currentColor! }}
                            />
                            {probes[t.id].matched ? '✓' : '✕'}
                          </span>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`chipbtn${isPicking(t.id, 'template') ? ' chipbtn--recording' : ''}`}
                      title="Left-click two opposite corners of the image to capture"
                      onClick={() => togglePick(t.id, 'template')}
                    >
                      {isPicking(t.id, 'template') ? '● Click 2 corners…' : 'Capture image'}
                    </button>
                    {t.image && <img className="detrow__thumb" src={t.image} alt="Captured template" />}
                    <button
                      type="button"
                      className={`chipbtn${isPicking(t.id, 'search') ? ' chipbtn--recording' : ''}`}
                      title="Limit where to look (two corners) — otherwise the whole screen is searched"
                      onClick={() => togglePick(t.id, 'search')}
                    >
                      {isPicking(t.id, 'search')
                        ? '● Click 2 corners…'
                        : t.searchArea
                          ? `Search ${t.searchArea.width}×${t.searchArea.height}`
                          : 'Search: screen'}
                    </button>
                    {t.searchArea && (
                      <button
                        type="button"
                        className="rowx"
                        title="Search the whole screen again"
                        onClick={() => patchAt(t.id, { searchArea: null })}
                      >
                        ×
                      </button>
                    )}
                    {t.image && probes[t.id] && !probes[t.id].issue && (
                      <span
                        className={`detrow__now${probes[t.id].matched ? ' detrow__now--hit' : ''}`}
                        title={
                          probes[t.id].matched
                            ? 'The image is on screen right now'
                            : 'The image is not on screen right now'
                        }
                      >
                        {probes[t.id].matched ? '✓ on screen' : '✕ not found'}
                      </span>
                    )}
                  </>
                )}

                <span className="keyrow__label">±</span>
                <input
                  className="input detrow__tol"
                  type="number"
                  min={0}
                  max={255}
                  value={t.tolerance}
                  title="Color tolerance per RGB channel (0 = exact match)"
                  onChange={(e) =>
                    patchAt(t.id, {
                      tolerance: Math.min(255, Math.max(0, Math.round(Number(e.target.value) || 0)))
                    })
                  }
                />
              </div>

              <div className="trigrow__inline">
                <span className="keyrow__label">then</span>
                <select
                  className="input detrow__select"
                  value={t.action.kind}
                  onChange={(e) => patchAction(t.id, { kind: e.target.value as DetectionAction['kind'] })}
                >
                  <option value="key">press a key</option>
                  <option value="mouse-left">left click</option>
                  <option value="mouse-right">right click</option>
                  <option value="position">click a saved position</option>
                </select>
                {t.action.kind === 'key' && (
                  <CaptureButton
                    label={prettyName(t.action.key)}
                    mode="name"
                    className="keychip"
                    onCapture={(name) => patchAction(t.id, { key: name })}
                  />
                )}
                {t.action.kind === 'position' && (
                  <select
                    className="input detrow__select"
                    value={t.action.positionId}
                    onChange={(e) => patchAction(t.id, { positionId: e.target.value })}
                  >
                    <option value="">— pick a position —</option>
                    {positions.map((p, i) => (
                      <option key={p.id} value={p.id}>
                        #{i + 1} ({p.x}, {p.y}) {p.button === 'left' ? 'L' : 'R'}
                      </option>
                    ))}
                  </select>
                )}
                <span className="keyrow__label" title="Keeps re-pressing this often while the condition stays true, so an interrupted action retries until it lands">
                  repeat every
                </span>
                <input
                  className="input detrow__repeat"
                  type="number"
                  min={10}
                  max={600000}
                  step={10}
                  value={t.repeatMs}
                  title="How often to re-fire while the condition holds (ms). Can't be faster than the check interval below."
                  onChange={(e) =>
                    patchAt(t.id, {
                      repeatMs: Math.min(600000, Math.max(10, Math.round(Number(e.target.value) || 0)))
                    })
                  }
                />
                <span className="keyrow__unit">ms</span>
                <span
                  className="keyrow__label"
                  title="Keep firing for this long after the pixel/image briefly stops matching — bridges an on-use flash or global cooldown that momentarily changes the icon. 0 = stop the instant it's false."
                >
                  keep firing
                </span>
                <input
                  className="input detrow__repeat"
                  type="number"
                  min={0}
                  max={10000}
                  step={50}
                  value={t.lingerMs}
                  title="Grace window (ms): keep firing this long after the condition dips, so a brief flash/global-cooldown doesn't stop the spam. 0 = stop instantly."
                  onChange={(e) =>
                    patchAt(t.id, {
                      lingerMs: Math.min(10000, Math.max(0, Math.round(Number(e.target.value) || 0)))
                    })
                  }
                />
                <span className="keyrow__unit">ms</span>
                <span className="keyrow__spacer" />
                <button
                  type="button"
                  className="rowx"
                  title="Remove"
                  onClick={() => setTriggers(det.triggers.filter((x) => x.id !== t.id))}
                >
                  ×
                </button>
              </div>
              {t.enabled && probes[t.id]?.issue && (
                <p className="detrow__issue">⚠ Won't run: {probes[t.id].issue}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="keylist__actions">
        <button
          type="button"
          className="chipbtn chipbtn--accent"
          onClick={() => setTriggers([...det.triggers, createDefaultDetectionTrigger()])}
        >
          + Add trigger
        </button>
        <span className="keyrow__spacer" />
        <span className="keyrow__label">check every</span>
        <PollField
          value={det.pollMs}
          onCommit={(ms) => updateProfile((p) => ({ ...p, detection: { ...p.detection, pollMs: ms } }))}
        />
        <span className="keyrow__unit">ms</span>
      </div>
    </Section>
  )
}
