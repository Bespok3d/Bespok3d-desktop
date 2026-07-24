// Design owned by Bespok3d-design/patch-snap.jsx; do not redesign this file.
// Only the data wiring and module integration differ from the design prototype.
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useI18n } from '../../../i18n/context'
import './patch-snap.css'

// ─── Types (match main/dev-tools/types.ts; serialised over IPC) ───────────

interface HunkLine { tag: ' ' | '+' | '-'; text: string }
interface Hunk { id: string; title: string; lines: HunkLine[]; suggestedOffset: number }
interface ConfidencePoint { offset: number; confidence: number }
interface HunkAnalysis {
  hunkId: string
  state: 'snapped' | 'ambiguous' | 'no_match'
  confidenceProfile: ConfidencePoint[]
  candidates: Array<{ offset: number; confidence: number }>
}
interface PatchTarget { id: string; name: string; content: string }
export interface PatchSession {
  patchId: string
  target: PatchTarget
  hunks: Hunk[]
  analyses: HunkAnalysis[]
}
export interface Resolution {
  hunkId: string
  method: 'auto_snapped' | 'nudged' | 'manual_edit'
  finalOffset: number | null
  manualText?: string
  replaceRange?: { start: number; end: number }
}
export interface ApplyRequest { patchId: string; resolutions: Resolution[] }
interface ManualState { text: string; range: { start: number; end: number }; surround: string }
interface ResolutionMeta extends Resolution { _confidence?: number; _state?: string }

// ─── Constants ──────────────────────────────────────────────────────────────

const LINE_H = 22
const SNAP_LINES = 2
const SNAP_THRESHOLD = 80

// ─── Pure helpers ────────────────────────────────────────────────────────────

function preImageLength(hunk: Hunk): number {
  return hunk.lines.filter((line) => line.tag === ' ' || line.tag === '-').length
}

function confidenceAt(profile: ConfidencePoint[], offset: number): number {
  const clamped = Math.max(1, Math.min(profile.length, offset))

  return profile.find((point) => point.offset === clamped)?.confidence ?? 0
}

function nearestPeak(
  profile: ConfidencePoint[],
  offset: number,
  candidates: Array<{ offset: number; confidence: number }>,
): { offset: number; confidence: number; dist: number } | null {
  if (candidates.length) {
    return candidates.reduce<{ offset: number; confidence: number; dist: number } | null>((best, cand) => {
      const dist = Math.abs(cand.offset - offset)

      return !best || dist < best.dist ? { ...cand, dist } : best
    }, null)
  }

  return profile
    .filter((point) => point.confidence >= 30)
    .reduce<{ offset: number; confidence: number; dist: number } | null>((best, point) => {
      const dist = Math.abs(point.offset - offset)

      return !best || dist < best.dist ? { ...point, dist } : best
    }, null)
}

// ─── Syntax highlight ────────────────────────────────────────────────────────

const KEYWORDS = new Set(['def','class','import','from','as','return','if','elif','else','for','while','try','except','raise','lambda','None','True','False','not','in','and','or','is','with','pass','yield','global','nonlocal','property','range','len'])
const TYPES = new Set(['self','filament_protocol','fm175xx_reader','filament_feed','gcode','config','logging','copy','os','int','bool','str','float','list','dict','tuple','set','Exception','TypeError'])

interface Token { kind: string; text: string }
function tokenize(line: string): Token[] {
  if (/^\s*#/.test(line) || /^\s*\/\//.test(line)) return [{ kind: 'com', text: line }]
  const re = /([A-Za-z_][A-Za-z_0-9]*)|("[^"]*")|(0x[0-9a-fA-F]+|\d+)|(\s+)|([^\sA-Za-z_0-9"]+)/g

  return [...line.matchAll(re)].map((match) => {
    const [tok] = match
    if (match[2]) return { kind: 'str', text: tok }
    if (match[3]) return { kind: 'num', text: tok }
    if (match[1]) {
      if (KEYWORDS.has(tok)) return { kind: 'kw', text: tok }
      if (TYPES.has(tok)) return { kind: 'typ', text: tok }
    }

    return { kind: '', text: tok }
  })
}

// ─── Icon primitives ─────────────────────────────────────────────────────────

function IconPath({ pathData, size = 14, strokeWidth = 1.6, fill = 'none' }: { pathData: string; size?: number; strokeWidth?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d={pathData} />
    </svg>
  )
}
function IconCheck({ size }: { size?: number }) { return <IconPath size={size} pathData="m5 12 5 5L20 7" /> }
function IconAlert({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4 2.5 20.5h19z" /><path d="M12 10v5" /><circle cx="12" cy="18" r="0.5" fill="currentColor" />
    </svg>
  )
}
function IconBan({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="9" /><path d="m6 6 12 12" strokeLinecap="round" />
    </svg>
  )
}
function IconArrow({ size }: { size?: number }) { return <IconPath size={size} pathData="M5 12h14M13 6l6 6-6 6" /> }
function IconHand({ size }: { size?: number }) { return <IconPath size={size} pathData="M9 6V3.5a1.5 1.5 0 0 1 3 0V11M12 6V2.5a1.5 1.5 0 0 1 3 0V11M15 7.5V4a1.5 1.5 0 0 1 3 0V14M18 8.5a1.5 1.5 0 0 1 3 0v6a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8V12a1.5 1.5 0 0 1 3 0v3" /> }
function IconLock({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round"/>
    </svg>
  )
}
function IconBranch({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="9" r="2"/>
      <path d="M6 7v10M6 13c0-3 4-3 7-4"/>
    </svg>
  )
}
function IconX({ size }: { size?: number }) { return <IconPath size={size} pathData="M6 6l12 12M18 6 6 18" /> }
function IconUndo({ size }: { size?: number }) { return <IconPath size={size} pathData="M9 14 4 9l5-5M4 9h11a5 5 0 1 1 0 10h-4" /> }

// ─── Source line renderer ────────────────────────────────────────────────────

function SourceLine({ text, lineNum }: { text: string; lineNum?: number }) {
  const toks = tokenize(text)

  return (
    <div className="ps-line" data-line-num={lineNum}>
      <div className="gut">{lineNum}</div>
      <div className="src">{toks.map((tok, tokenIdx) => tok.kind ? <span key={tokenIdx} className={`tok-${tok.kind}`}>{tok.text}</span> : <span key={tokenIdx}>{tok.text}</span>)}</div>
    </div>
  )
}

// ─── Inline hunk preview ────────────────────────────────────────────────────

function InlineHunkPreview({
  hunk, hunkIdx, startLn, manual, analysis, isActive, onFocus,
}: {
  hunk: Hunk; hunkIdx: number; startLn: number; consumed: number
  manual?: ManualState; analysis: HunkAnalysis; isActive: boolean; onFocus: () => void
}) {
  const state = manual ? 'manual' : analysis.state
  type LineInfo = { tag: HunkLine['tag']; text: string; lineNum: number | null; delay: number; lineIdx: number }
  type LineLayout = { items: LineInfo[]; nextSrcLine: number; addOrd: number }
  function appendHunkLine(layout: LineLayout, line: HunkLine, lineIdx: number): LineLayout {
    if (line.tag === '+') return { ...layout, addOrd: layout.addOrd + 1, items: [...layout.items, { tag: '+', text: line.text, lineNum: null, delay: layout.addOrd * 28, lineIdx }] }

    return { ...layout, nextSrcLine: layout.nextSrcLine + 1, items: [...layout.items, { tag: line.tag, text: line.text, lineNum: layout.nextSrcLine, delay: 0, lineIdx }] }
  }
  const lineInfos = hunk.lines.reduce<LineLayout>(appendHunkLine, { items: [], nextSrcLine: startLn, addOrd: 0 }).items

  return (
    <div className={`ps-inline-preview state-${state} ${isActive ? 'active' : ''}`}
         data-hunk-id={hunk.id} onMouseEnter={onFocus} onClick={onFocus}
         title={`H${hunkIdx + 1} · ${hunk.title}`}>
      {manual ? (
        manual.text.split('\n').map((line, lineIdx) => (
          <div className="ps-line ps-preview-line preview-add" key={`m-${lineIdx}`} style={{ animationDelay: `${lineIdx * 22}ms` }}>
            <div className="gut"><span className="add-mark">+</span></div>
            <div className="src">{line || '​'}</div>
          </div>
        ))
      ) : (
        lineInfos.map((info) => {
          if (info.tag === '+') return (
            <div className="ps-line ps-preview-line preview-add" key={`a-${info.lineIdx}`} style={{ animationDelay: `${info.delay}ms` }}>
              <div className="gut"><span className="add-mark">+</span></div>
              <div className="src">{info.text || '​'}</div>
            </div>
          )
          const toks = tokenize(info.text)

          return (
            <div className={`ps-line ps-preview-line ${info.tag === '-' ? 'preview-del' : 'preview-ctx'}`} key={`c-${info.lineIdx}`}>
              <div className="gut">{info.lineNum}</div>
              <div className="src">{toks.map((tok, tokenIdx) => tok.kind ? <span key={tokenIdx} className={`tok-${tok.kind}`}>{tok.text}</span> : <span key={tokenIdx}>{tok.text}</span>)}</div>
            </div>
          )
        })
      )}
    </div>
  )
}

// ─── Source canvas plan builder ───────────────────────────────────────────────

type PlanItem = { kind: 'src'; text: string; lineNum: number } | { kind: 'hunk'; hunk: Hunk; manual?: ManualState; at: number; consumed: number }

function buildPlan(
  lines: string[],
  sortedInline: Hunk[],
  placements: Record<string, number>,
  manualEdits: Record<string, ManualState>,
): PlanItem[] {
  const hunkByStart = new Map(sortedInline.map((hunk) => {
    const manual = manualEdits[hunk.id]
    const start = manual ? manual.range.start : placements[hunk.id]
    const consumed = manual ? (manual.range.end - manual.range.start + 1) : preImageLength(hunk)

    return [start, { hunk, manual, consumed }] as const
  }))

  return lines.reduce<{ plan: PlanItem[]; skip: number }>(
    ({ plan, skip }, text, idx) => {
      if (skip > 0) return { plan, skip: skip - 1 }
      const lineNum = idx + 1
      const hunkHere = hunkByStart.get(lineNum)
      if (hunkHere) return { plan: [...plan, { kind: 'hunk', hunk: hunkHere.hunk, manual: hunkHere.manual, at: lineNum, consumed: hunkHere.consumed }], skip: hunkHere.consumed - 1 }

      return { plan: [...plan, { kind: 'src', text, lineNum }], skip: 0 }
    },
    { plan: [], skip: 0 },
  ).plan
}

type LineTopLayout = { map: Record<number, number>; cursorY: number }

function placePlanItem({ map, cursorY }: LineTopLayout, item: PlanItem): LineTopLayout {
  if (item.kind === 'src') { map[item.lineNum] = cursorY;

 return { map, cursorY: cursorY + LINE_H } }
  const innerHeight = item.manual ? Math.max(1, item.manual.text.split('\n').length) * LINE_H + 12 : item.hunk.lines.length * LINE_H
  Array.from({ length: item.consumed }, (_, slotIdx) => { map[item.at + slotIdx] = cursorY + slotIdx * LINE_H })

  return { map, cursorY: cursorY + innerHeight }
}

function buildLineTopMap(plan: PlanItem[]): Record<number, number> {
  return plan.reduce<LineTopLayout>(placePlanItem, { map: {}, cursorY: 12 }).map
}

// ─── Candidate ghosts overlay ────────────────────────────────────────────────

function CandidateGhosts({ hunks, analyses, candidatePicks, lineTopMap, onPickCandidate }: {
  hunks: Hunk[]; analyses: HunkAnalysis[]; candidatePicks: Record<string, number>
  lineTopMap: Record<number, number>; onPickCandidate: (hunkId: string, offset: number) => void
}) {
  const { t } = useI18n()
  function topFor(lineNum: number): number { return lineTopMap[lineNum] ?? ((lineNum - 1) * LINE_H + 12) }

  return (
    <>
      {hunks.map((hunk) => {
        const an = analyses.find((analysis) => analysis.hunkId === hunk.id)!
        if (an.state !== 'ambiguous' || candidatePicks[hunk.id] !== undefined) return null

        return an.candidates.map((cand, candIdx) => {
          const top = topFor(cand.offset)
          const height = preImageLength(hunk) * LINE_H

          return (
            <React.Fragment key={`${hunk.id}-c${candIdx}`}>
              <div className="ps-candidate-ghost" style={{ top, height }} />
              <div className="ps-candidate-ghost-label" style={{ top: top + 10 }}
                   onClick={() => onPickCandidate(hunk.id, cand.offset)}>
                {t('patchsnap.candidate_ghost', { offset: cand.offset, confidence: cand.confidence })}
              </div>
            </React.Fragment>
          )
        })
      })}
    </>
  )
}

// ─── Source canvas ───────────────────────────────────────────────────────────

function SourceCanvas({
  target, hunks, analyses, placements, activeHunkId, dragOffset, draggingHunkId,
  candidatePicks, onPickCandidate, scrollRef, onScrollToHunk, manualEdits,
}: {
  target: PatchTarget; hunks: Hunk[]; analyses: HunkAnalysis[]
  placements: Record<string, number>; activeHunkId: string | null
  dragOffset: number; draggingHunkId: string | null
  candidatePicks: Record<string, number>; onPickCandidate: (hunkId: string, offset: number) => void
  scrollRef: React.RefObject<HTMLDivElement | null>
  onScrollToHunk: (id: string, focus?: boolean) => void
  manualEdits: Record<string, ManualState>
}) {
  const lines = target.content.split('\n')
  const draggingAny = !!draggingHunkId

  function isInline(hunk: Hunk): boolean {
    if (draggingAny) return false
    if (manualEdits[hunk.id]) return true
    const an = analyses.find((analysis) => analysis.hunkId === hunk.id)!

    return an.state === 'snapped' || (an.state === 'ambiguous' && candidatePicks[hunk.id] !== undefined)
  }
  const inlineSet = new Set(hunks.filter(isInline).map((hunk) => hunk.id))
  const sortedInline = [...hunks].filter((hunk) => inlineSet.has(hunk.id))
    .sort((earlier, later) => {
      const startEarlier = manualEdits[earlier.id]?.range.start ?? placements[earlier.id]
      const startLater = manualEdits[later.id]?.range.start ?? placements[later.id]

      return startEarlier - startLater
    })

  const plan = buildPlan(lines, sortedInline, placements, manualEdits)
  const lineTopMap = buildLineTopMap(plan)
  function topFor(lineNum: number): number { return lineTopMap[lineNum] ?? ((lineNum - 1) * LINE_H + 12) }

  return (
    <div className="ps-source-scroll" ref={scrollRef}>
      <div className="ps-source u-relative">
        {plan.map((item) => {
          if (item.kind === 'src') return <SourceLine key={`s-${item.lineNum}`} text={item.text} lineNum={item.lineNum} />

          return (
            <InlineHunkPreview key={`h-${item.hunk.id}`} hunk={item.hunk}
              hunkIdx={hunks.findIndex((hunk) => hunk.id === item.hunk.id)}
              startLn={item.at} consumed={item.consumed} manual={item.manual}
              analysis={analyses.find((hunkAnalysis) => hunkAnalysis.hunkId === item.hunk.id)!}
              isActive={activeHunkId === item.hunk.id}
              onFocus={() => onScrollToHunk(item.hunk.id, true)} />
          )
        })}

        <CandidateGhosts hunks={hunks} analyses={analyses} candidatePicks={candidatePicks}
          lineTopMap={lineTopMap} onPickCandidate={onPickCandidate} />

        {hunks.map((hunk, idx) => {
          const an = analyses.find((analysis) => analysis.hunkId === hunk.id)!
          const isDragging = draggingHunkId === hunk.id || draggingHunkId === 'BLOCK'
          if (!isDragging && inlineSet.has(hunk.id)) return null
          const currentOffset = (placements[hunk.id] ?? 0) + (isDragging ? dragOffset : 0)
          const top = isDragging ? (currentOffset - 1) * LINE_H + 12 : topFor(currentOffset)
          const height = preImageLength(hunk) * LINE_H

          return (
            <React.Fragment key={hunk.id}>
              <div className={`ps-snap-zone ${an.state} ${activeHunkId === hunk.id ? 'active' : ''} ${isDragging ? 'dragging' : ''}`}
                   style={{ top, height }} onClick={() => onScrollToHunk(hunk.id)} />
              <div className="ps-hunk-gutter" style={{ top }}>
                <span className="badge">H{idx + 1}</span>
              </div>
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

// ─── Hunk card status block ───────────────────────────────────────────────────

function HunkStatus({ state, manualState, placement, hunk }: {
  state: HunkAnalysis['state']; manualState?: ManualState; placement: number; hunk: Hunk
}) {
  const { t } = useI18n()
  const info = useMemo(() => {
    if (manualState) return { label: t('patchsnap.status_manual_label'), sub: t('patchsnap.status_manual_sub', { start: manualState.range.start, end: manualState.range.end }), icon: <IconCheck />, cls: 'manual' }
    if (state === 'snapped') return { label: t('patchsnap.status_snapped_label'), sub: t('patchsnap.status_snapped_sub'), icon: <IconCheck />, cls: 'snapped' }
    if (state === 'ambiguous') return { label: t('patchsnap.status_ambiguous_label'), sub: t('patchsnap.status_ambiguous_sub'), icon: <IconAlert />, cls: 'ambiguous' }

    return { label: t('patchsnap.status_no_match_label'), sub: t('patchsnap.status_no_match_sub'), icon: <IconBan />, cls: 'no_match' }
  }, [state, manualState, t])

  return (
    <div className={`ps-hunk-status ${info.cls}`}>
      <span className="icon">{info.icon}</span>
      <div className="body">
        <strong>{info.label}</strong>
        <span>{info.sub}</span>
        {!manualState && state === 'snapped' && (
          <span className="where">{t('patchsnap.status_anchors', { start: placement, end: placement + preImageLength(hunk) - 1 })}</span>
        )}
      </div>
    </div>
  )
}

// ─── Hunk card diff body ──────────────────────────────────────────────────────

function HunkDiffBody({ hunk, analysis, effectiveOffset, candidatePick, onPickCandidate, onManualEdit }: {
  hunk: Hunk; analysis: HunkAnalysis; effectiveOffset: number
  candidatePick?: number; onPickCandidate: (offset: number) => void; onManualEdit: () => void
}) {
  const { t } = useI18n()

  return (
    <>
      <div className="ps-hunk-diff">
        {hunk.lines.map((line, lineIdx) => {
          const displayLine = effectiveOffset + lineIdx - hunk.lines.slice(0, lineIdx).filter((prevLine) => prevLine.tag === '+').length
          const cls = { ' ': 'ctx', '+': 'add', '-': 'del' }[line.tag]

          return (
            <div className={`diff-line ${cls}`} key={lineIdx}>
              <div className="ln">{line.tag === '+' ? '' : Math.round(displayLine)}</div>
              <div className="tag">{({ ' ': '·', '+': '+', '-': '−' })[line.tag]}</div>
              <div className="txt">{line.text}</div>
            </div>
          )
        })}
      </div>
      {analysis.state === 'ambiguous' && (
        <div className="ps-candidates">
          <div className="head">{t('patchsnap.candidates_pick_one')}</div>
          {analysis.candidates.map((cand) => (
            <div key={cand.offset} className={`ps-candidate ${candidatePick === cand.offset ? 'chosen' : ''}`}
                 onClick={() => onPickCandidate(cand.offset)}>
              <div className="num">L{cand.offset}</div>
              <div className="preview">{hunk.lines[0]?.text?.trim()}</div>
              <div className="conf">{cand.confidence}%</div>
              <div className="pick-btn">{candidatePick === cand.offset ? t('patchsnap.picked') : t('patchsnap.pick')}</div>
            </div>
          ))}
        </div>
      )}
      {analysis.state === 'no_match' && (
        <div className="ps-candidates">
          <div className="head">{t('patchsnap.best_effort_match')}</div>
          {analysis.candidates.length > 0 ? analysis.candidates.map((cand) => (
            <div key={cand.offset} className="ps-candidate ps-candidate-readonly">
              <div className="num">L{cand.offset}</div>
              <div className="conf">{cand.confidence}%</div>
              <div className="pick-btn below">{t('patchsnap.below_snap')}</div>
            </div>
          )) : <div className="ps-empty-note">{t('patchsnap.no_partial_matches')}</div>}
          <button className="ps-btn ps-hand-merge" onClick={onManualEdit}>
            <IconHand size={14} /> {t('patchsnap.hand_merge_hunk')}
          </button>
        </div>
      )}
    </>
  )
}

// ─── Hunk card sub-components ────────────────────────────────────────────────

function HunkConfidenceBar({ liveConf, effectiveOffset, state }: {
  liveConf: number; effectiveOffset: number; state: HunkAnalysis['state']
}) {
  const { t } = useI18n()

  return (
    <div className="ps-confidence">
      <div className="bar-wrap" title={t('patchsnap.live_match_score', { line: Math.round(effectiveOffset) })}>
        <div className={`bar ${state}`} style={{ width: `${Math.min(100, liveConf)}%` }} />
        <div className="threshold" style={{ left: `${SNAP_THRESHOLD}%` }} />
      </div>
      <div className="pct">{Math.round(liveConf)}%</div>
    </div>
  )
}

function HunkNudgeBar({ peak, effectiveOffset, onNudge }: {
  peak?: { offset: number; confidence: number }; effectiveOffset: number; onNudge: (delta: number) => void
}) {
  const { t } = useI18n()

  return (
    <div className="ps-nudge-buttons">
      <span className="lab">{t('patchsnap.nudge_one_line')}</span>
      <button onClick={() => onNudge(-1)} className="ps-nudge-control">↑</button>
      <button onClick={() => onNudge(+1)} className="ps-nudge-control">↓</button>
      {peak && Math.abs(peak.offset - effectiveOffset) > 0 && (
        <button onClick={() => onNudge(peak.offset - effectiveOffset)} className="ps-snap-control">{t('patchsnap.snap')}</button>
      )}
    </div>
  )
}

function HunkRawView({ hunk, analysis, effectiveOffset }: {
  hunk: Hunk; analysis: HunkAnalysis; effectiveOffset: number
}) {
  const { t } = useI18n()

  return (
    <div className="ps-hunk-raw">
      <div className="col-head"><span>{t('patchsnap.unified_diff')}</span></div>
      <pre className="unified">
        <span className="hh">{`@@ -${hunk.suggestedOffset},${preImageLength(hunk)} +${effectiveOffset},${hunk.lines.filter((hunkLine) => hunkLine.tag !== '-').length} @@`}</span>{'\n'}
        {hunk.lines.map((hunkLine, lineIdx) => <span key={lineIdx} className={({ ' ': '', '+': 'ad', '-': 'rm' })[hunkLine.tag]}>{hunkLine.tag}{hunkLine.text}{'\n'}</span>)}
      </pre>
      <div className="col-head"><span>{t('patchsnap.per_offset_score')}</span></div>
      {[...analysis.confidenceProfile].sort((left, right) => right.confidence - left.confidence).slice(0, 5).map((point) => (
        <div className="ps-profile" key={point.offset}>
          <div className="label">{t('patchsnap.offset_line', { offset: point.offset })}</div>
          <div className="bar"><div className={`fill ${analysis.state}`} style={{ width: `${point.confidence}%` }} /></div>
          <div className="val">{point.confidence}</div>
        </div>
      ))}
    </div>
  )
}

function HunkManualEditor({ state, onEdit, onSave, onCancel }: {
  state: ManualState; onEdit: (text: string) => void; onSave: () => void; onCancel: () => void
}) {
  const { t } = useI18n()

  return (
    <div className="ps-manual">
      <div className="head-row"><span>{t('patchsnap.hand_merge')}</span><span className="where">{t('patchsnap.replaces_lines', { start: state.range.start, end: state.range.end })}</span></div>
      <div className="surround" aria-label={t('patchsnap.surrounding_source')}>{state.surround}</div>
      <textarea value={state.text} onChange={(event) => onEdit(event.target.value)} spellCheck={false} />
      <div className="row-actions">
        <button className="ps-btn ghost" onClick={onCancel}>{t('patchsnap.discard')}</button>
        <button className="ps-btn primary" onClick={onSave}>{t('patchsnap.save_merge')}</button>
      </div>
    </div>
  )
}

// ─── Hunk card ───────────────────────────────────────────────────────────────

function HunkCard({
  hunk, idx, analysis, placement, level, onLevelChange,
  onDragStart, dragging, dragOffset, isBlockDragging,
  onNudge, onPickCandidate, candidatePick, manualState,
  onManualEdit, onManualSave, onManualCancel, isActive, onFocus,
}: {
  hunk: Hunk; idx: number; analysis: HunkAnalysis; placement: number
  level: string; onLevelChange: (lvl: string) => void
  onDragStart: (ev: React.PointerEvent) => void
  dragging: boolean; dragOffset: number; isBlockDragging: boolean
  onNudge: (delta: number) => void
  onPickCandidate: (offset: number) => void; candidatePick?: number
  manualState?: ManualState
  onManualEdit: (text?: string) => void; onManualSave: () => void; onManualCancel: () => void
  isActive: boolean; onFocus: () => void
}) {
  const { t } = useI18n()
  const effectiveOffset = placement + (dragging || isBlockDragging ? dragOffset : 0)
  const liveConf = confidenceAt(analysis.confidenceProfile, effectiveOffset)
  const peak = analysis.candidates[0]
  const nudge = (!manualState && peak && Math.abs(peak.offset - effectiveOffset) > 0 && liveConf < SNAP_THRESHOLD)
    ? { dir: (peak.offset > effectiveOffset ? 'down' : 'up') as 'down' | 'up', dist: Math.abs(peak.offset - effectiveOffset), conf: peak.confidence }
    : null

  return (
    <div className={`ps-hunk-card state-${manualState ? 'manual' : analysis.state} ${isActive ? 'active' : ''} ${dragging ? 'dragging' : ''}`} onMouseEnter={onFocus}>
      <div className="ps-hunk-head">
        <div className={`grab ${dragging ? 'dragging' : ''}`} onPointerDown={(event) => { onFocus(); onDragStart(event) }}>
          {Array.from({ length: 8 }).map((_, dotIdx) => <span key={dotIdx} />)}
        </div>
        <div className="meta">
          <div className="ttl"><span className="ord">H{idx + 1}</span><span>{hunk.title}</span></div>
          <div className="sub">
            <span>{hunk.lines.filter((hunkLine) => hunkLine.tag === '+').length}+ / {hunk.lines.filter((hunkLine) => hunkLine.tag === '-').length}−</span>
            <span>· suggested L{hunk.suggestedOffset}</span>
            <span>· now L{Math.round(effectiveOffset)}</span>
          </div>
        </div>
        <div className="level">
          {['basic','diff','raw'].map((lvl) => (
            <button key={lvl} className={level === lvl ? 'active' : ''} onClick={() => onLevelChange(lvl)}>{lvl}</button>
          ))}
        </div>
      </div>

      <div className="ps-hunk-basic">
        <HunkStatus state={analysis.state} manualState={manualState} placement={placement} hunk={hunk} />
        {!manualState && <HunkConfidenceBar liveConf={liveConf} effectiveOffset={effectiveOffset} state={analysis.state} />}
        {nudge && (
          <button type="button" className={`ps-nudge-cue ${nudge.dir}`}
                  onClick={() => onNudge(peak!.offset - effectiveOffset)}>
            <span className="arrow"><IconArrow size={12} /></span>
            <span>{t(nudge.dist === 1 ? 'patchsnap.strong_match_one' : 'patchsnap.strong_match_many', { distance: nudge.dist, arrow: nudge.dir === 'up' ? '↑' : '↓', confidence: nudge.conf })}</span>
            <span className="snap-hint">{t('patchsnap.snap')} →</span>
          </button>
        )}
        {!manualState && <HunkNudgeBar peak={peak} effectiveOffset={effectiveOffset} onNudge={onNudge} />}
        {!manualState && level === 'basic' && analysis.state === 'ambiguous' && (
          <button className="ps-btn ps-candidates-link ghost" onClick={() => onLevelChange('diff')}>{t('patchsnap.see_candidates')} →</button>
        )}
        {!manualState && level === 'basic' && analysis.state === 'no_match' && (
          <button className="ps-btn ps-candidates-link u-err ghost"
                  onClick={() => { onLevelChange('diff'); onManualEdit() }}>{t('patchsnap.finish_by_hand')} →</button>
        )}
      </div>

      {(level === 'diff' || level === 'raw') && !manualState && (
        <HunkDiffBody hunk={hunk} analysis={analysis} effectiveOffset={effectiveOffset}
          candidatePick={candidatePick} onPickCandidate={onPickCandidate} onManualEdit={() => onManualEdit()} />
      )}

      {level === 'raw' && !manualState && <HunkRawView hunk={hunk} analysis={analysis} effectiveOffset={effectiveOffset} />}
      {manualState && <HunkManualEditor state={manualState} onEdit={(text) => onManualEdit(text)} onSave={onManualSave} onCancel={onManualCancel} />}
    </div>
  )
}

// ─── Help modal ───────────────────────────────────────────────────────────────

function buildHelpSteps(t: ReturnType<typeof useI18n>['t']) {
  return [
    { nn: '1', title: t('patchsnap.help_1_title'), body: <>{t('patchsnap.help_1_body_pre')} <strong>{t('patchsnap.help_1_body_handle')}</strong> {t('patchsnap.help_1_body_post')}</> },
    { nn: '2', title: t('patchsnap.help_2_title'), body: <>{t('patchsnap.help_2_body_pre')} <code>↑</code>/<code>↓</code> {t('patchsnap.help_2_body_post')}</> },
    { nn: '3', title: t('patchsnap.help_3_title'), body: <>{t('patchsnap.help_3_body')}</> },
    { nn: '4', title: t('patchsnap.help_4_title'), body: <>{t('patchsnap.help_4_body')}</> },
    { nn: '5', title: t('patchsnap.help_5_title'), body: <>{t('patchsnap.help_5_body_pre')} <strong>{t('patchsnap.hand_merge_hunk')}</strong> {t('patchsnap.help_5_body_post')}</> },
    { nn: '6', title: t('patchsnap.help_6_title'), body: <>{t('patchsnap.help_6_body_pre')} <code>basic / diff / raw</code>. {t('patchsnap.help_6_body_post')}</> },
    { nn: '7', title: t('patchsnap.help_7_title'), body: <>{t('patchsnap.help_7_body_pre')} <strong>{t('patchsnap.apply')}</strong> {t('patchsnap.help_7_body_post')}</> },
  ]
}

function HelpModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const helpSteps = buildHelpSteps(t)

  return (
    <div className="ps-modal-backdrop" onClick={onClose}>
      <div className="ps-modal ps-help-modal" onClick={(event) => event.stopPropagation()}>
        <div className="head">
          <h2>{t('patchsnap.help_title')}</h2>
          <p>{t('patchsnap.help_intro')}</p>
        </div>
        <div className="body">
          {helpSteps.map((step) => (
            <div className="ps-help-item" key={step.nn}>
              <div className="num">{step.nn}</div>
              <div className="copy"><strong>{step.title}</strong><span>{step.body}</span></div>
            </div>
          ))}
        </div>
        <div className="foot">
          <button className="ps-btn primary" onClick={onClose}>{t('patchsnap.got_it')} <span className="kbd">Esc</span></button>
        </div>
      </div>
    </div>
  )
}

// ─── Apply summary modal ──────────────────────────────────────────────────────

function ApplySummary({ resolutions, onCancel, onApply }: {
  resolutions: Resolution[]; onCancel: () => void; onApply: () => void
}) {
  const { t } = useI18n()
  const methodCounts = resolutions.reduce<Record<string, number>>((tally, resolution) => {
    tally[resolution.method] = (tally[resolution.method] ?? 0) + 1;

 return tally
  }, {})

  return (
    <div className="ps-modal-backdrop" onClick={onCancel}>
      <div className="ps-modal" onClick={(event) => event.stopPropagation()}>
        <div className="head">
          <h2>{t('patchsnap.apply_patch_question')}</h2>
          <p>{t('patchsnap.apply_intro')}</p>
        </div>
        <div className="body">
          <div className="sum-row ok"><div className="icon"><IconCheck size={16} /></div><div><div className="lbl">{t('patchsnap.auto_snapped')}</div><div className="sub">{t('patchsnap.auto_snapped_sub')}</div></div><div className="ct">{methodCounts.auto_snapped ?? 0}</div></div>
          <div className="sum-row nudge"><div className="icon"><IconHand size={16} /></div><div><div className="lbl">{t('patchsnap.nudged_into_place')}</div><div className="sub">{t('patchsnap.nudged_into_place_sub')}</div></div><div className="ct">{methodCounts.nudged ?? 0}</div></div>
          <div className="sum-row manual"><div className="icon"><IconBranch size={16} /></div><div><div className="lbl">{t('patchsnap.hand_merged')}</div><div className="sub">{t('patchsnap.hand_merged_sub')}</div></div><div className="ct">{methodCounts.manual_edit ?? 0}</div></div>
          <div className="reversibility">
            <IconUndo size={14} />
            <span>{t('patchsnap.revert_pre')} <code className="ps-inline-code">bespok3d revert</code> {t('patchsnap.revert_post')}</span>
          </div>
        </div>
        <div className="foot">
          <button className="ps-btn ghost" onClick={onCancel}>{t('patchsnap.back')}</button>
          <button className="ps-btn primary" onClick={onApply}>
            <IconCheck size={14} /> {t(resolutions.length === 1 ? 'patchsnap.write_hunks_one' : 'patchsnap.write_hunks_many', { count: resolutions.length })}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── State hooks ─────────────────────────────────────────────────────────────

function usePatchPlacements(session: PatchSession) {
  const [placements, setPlacements] = useState<Record<string, number>>(() =>
    Object.fromEntries(session.hunks.map((hunk) => {
      const hunkAnalysis = session.analyses.find((analysis) => analysis.hunkId === hunk.id)!

      return [hunk.id, hunkAnalysis.candidates[0]?.offset ?? hunk.suggestedOffset]
    }))
  )
  const [nudged, setNudged] = useState<Record<string, boolean>>({})
  const [candidatePicks, setCandidatePicks] = useState<Record<string, number>>({})
  const [levels, setLevels] = useState<Record<string, string>>(() =>
    Object.fromEntries(session.hunks.map((hunk) => {
      const hunkAnalysis = session.analyses.find((analysis) => analysis.hunkId === hunk.id)!

      return [hunk.id, hunkAnalysis.state === 'snapped' ? 'basic' : 'diff']
    }))
  )
  const onNudge = useCallback((hunkId: string, delta: number) => {
    const totalLines = session.target.content.split('\n').length
    const hunk = session.hunks.find((candidate) => candidate.id === hunkId)!
    setPlacements((prev) => ({ ...prev, [hunkId]: Math.max(1, Math.min(totalLines - preImageLength(hunk) + 1, prev[hunkId] + delta)) }))
    setNudged((prev) => ({ ...prev, [hunkId]: true }))
  }, [session])
  const onPickCandidate = useCallback((hunkId: string, offset: number) => {
    setCandidatePicks((prev) => ({ ...prev, [hunkId]: offset }))
    setPlacements((prev) => ({ ...prev, [hunkId]: offset }))
    setNudged((prev) => ({ ...prev, [hunkId]: true }))
  }, [])

  return { placements, setPlacements, nudged, setNudged, candidatePicks, levels, setLevels, onNudge, onPickCandidate }
}

function usePatchManual(session: PatchSession, placements: Record<string, number>) {
  const [manualEdits, setManualEdits] = useState<Record<string, ManualState>>({})
  const onManualEdit = useCallback((hunkId: string, textOrInit?: string) => {
    setManualEdits((prev) => {
      if (typeof textOrInit === 'string') return { ...prev, [hunkId]: { ...prev[hunkId], text: textOrInit } }
      const hunk = session.hunks.find((candidate) => candidate.id === hunkId)!
      const targetLines = session.target.content.split('\n')
      const placement = placements[hunkId]
      const range = { start: Math.max(1, placement), end: Math.min(targetLines.length, placement + preImageLength(hunk) - 1) }
      const around = targetLines.slice(Math.max(0, range.start - 4), Math.min(targetLines.length, range.end + 3))

      return { ...prev, [hunkId]: {
        text: hunk.lines.filter((hunkLine) => hunkLine.tag === ' ' || hunkLine.tag === '+').map((hunkLine) => hunkLine.text).join('\n'),
        range,
        surround: around.map((srcLine, lineOffset) => `${String(Math.max(0, range.start - 4) + lineOffset + 1).padStart(3, ' ')}  ${srcLine}`).join('\n'),
      } }
    })
  }, [session, placements])

  return { manualEdits, setManualEdits, onManualEdit }
}

function usePatchResolutions(
  session: PatchSession, placements: Record<string, number>, nudged: Record<string, boolean>,
  candidatePicks: Record<string, number>, manualEdits: Record<string, ManualState>,
) {
  const resolutions = useMemo<ResolutionMeta[]>(() => session.hunks.map((hunk) => {
    const hunkAnalysis = session.analyses.find((analysis) => analysis.hunkId === hunk.id)!
    const manual = manualEdits[hunk.id]
    if (manual) return { hunkId: hunk.id, method: 'manual_edit', finalOffset: null, manualText: manual.text, replaceRange: manual.range }
    const confidence = confidenceAt(hunkAnalysis.confidenceProfile, placements[hunk.id])

    return { hunkId: hunk.id, method: (!nudged[hunk.id] && hunkAnalysis.state === 'snapped') ? 'auto_snapped' : 'nudged', finalOffset: placements[hunk.id], _confidence: confidence, _state: hunkAnalysis.state }
  }), [session, placements, nudged, manualEdits])
  const placedStatus = useMemo(() => session.hunks.map((hunk) => {
    const hunkAnalysis = session.analyses.find((analysis) => analysis.hunkId === hunk.id)!
    const resolution = resolutions.find((entry) => entry.hunkId === hunk.id)!
    if (resolution.method === 'manual_edit') return 'manual'
    if (hunkAnalysis.state === 'snapped' && (resolution._confidence ?? 0) >= SNAP_THRESHOLD) return 'snapped'
    if (hunkAnalysis.state === 'ambiguous' && candidatePicks[hunk.id] === resolution.finalOffset) return 'placed'
    if (hunkAnalysis.state === 'no_match') return 'no_match'
    if (hunkAnalysis.state === 'ambiguous') return 'ambiguous'

    return (resolution._confidence ?? 0) >= SNAP_THRESHOLD ? 'placed' : hunkAnalysis.state
  }), [session, resolutions, candidatePicks])
  const placedCount = placedStatus.filter((status) => status === 'snapped' || status === 'manual' || status === 'placed').length
  const total = session.hunks.length
  const counts = {
    auto: resolutions.filter((resolution) => resolution.method === 'auto_snapped').length,
    nudged: resolutions.filter((resolution) => resolution.method === 'nudged' && (resolution._state === 'snapped' || candidatePicks[resolution.hunkId])).length,
    manual: resolutions.filter((resolution) => resolution.method === 'manual_edit').length,
    todo: total - placedCount,
  }

  return { resolutions, placedStatus, placedCount, total, allPlaced: placedCount === total, counts }
}

// ─── Drag state management ────────────────────────────────────────────────────

interface DragState { kind: 'hunk' | 'block'; hunkId: string; startY: number; currentY: number }

function updateDragPosition(currentDrag: DragState | null, clientY: number): DragState | null {
  if (!currentDrag) return null

  return { ...currentDrag, currentY: clientY }
}

function useDrag(
  session: PatchSession,
  setPlacements: React.Dispatch<React.SetStateAction<Record<string, number>>>,
  setNudged: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragOffsetLines = drag ? Math.round((drag.currentY - drag.startY) / LINE_H) : 0

  const onDragMove = useCallback((pointerEvent: PointerEvent) => {
    setDrag((currentDrag) => updateDragPosition(currentDrag, pointerEvent.clientY))
  }, [])

  const onDragEnd = useCallback(() => {
    setDrag((currentDrag) => {
      if (!currentDrag) return null
      const delta = Math.round((currentDrag.currentY - currentDrag.startY) / LINE_H)
      const totalLines = session.target.content.split('\n').length
      setPlacements((prev) => {
        const next = { ...prev }
        function snapHunk(id: string) {
          const hunkAnalysis = session.analyses.find((analysis) => analysis.hunkId === id)!
          const hunk = session.hunks.find((candidate) => candidate.id === id)!
          const rawOffset = Math.max(1, Math.min(totalLines - preImageLength(hunk) + 1, (prev[id] ?? 0) + delta))
          const peak = nearestPeak(hunkAnalysis.confidenceProfile, rawOffset, hunkAnalysis.candidates)
          next[id] = peak && peak.dist <= SNAP_LINES && peak.confidence >= SNAP_THRESHOLD ? peak.offset : rawOffset
        }
        if (currentDrag.kind === 'block') session.hunks.forEach((hunk) => snapHunk(hunk.id))
        else snapHunk(currentDrag.hunkId)

        return next
      })
      setNudged((prev) => {
        const next = { ...prev }
        if (currentDrag.kind === 'block') session.hunks.forEach((hunk) => { next[hunk.id] = true })
        else next[currentDrag.hunkId] = true

        return next
      })

      return null
    })
  }, [session, setPlacements, setNudged])

  useEffect(() => {
    if (!drag) return
    window.addEventListener('pointermove', onDragMove)
    window.addEventListener('pointerup', onDragEnd)

    return () => {
      window.removeEventListener('pointermove', onDragMove)
      window.removeEventListener('pointerup', onDragEnd)
    }
  }, [drag, onDragMove, onDragEnd])

  function startDrag(ev: React.PointerEvent, kind: 'hunk' | 'block', hunkId: string) {
    ev.preventDefault()
    setDrag({ kind, hunkId, startY: ev.clientY, currentY: ev.clientY })
  }

  return { drag, dragOffsetLines, draggingHunkId: drag && (drag.kind === 'block' ? 'BLOCK' : drag.hunkId), startDrag }
}

// ─── Header and tray components ──────────────────────────────────────────────

function PatchHeader({ session, theme, setTheme, showHelp, setShowHelp, placedCount, total, placedStatus, allPlaced, onCancel, setShowApply }: {
  session: PatchSession; theme: 'light' | 'dark'; setTheme: (tt: 'light' | 'dark') => void
  showHelp: boolean; setShowHelp: (vv: boolean) => void
  placedCount: number; total: number; placedStatus: string[]
  allPlaced: boolean; onCancel: () => void; setShowApply: (vv: boolean) => void
}) {
  const { t } = useI18n()

  return (
    <header className="ps-header">
      <div className="ps-crumb">
        <div className="mark">B</div>
        <div className="lines">
          <div className="eyebrow">{t('patchsnap.patch_label')} · {session.patchId}</div>
          <div className="path"><span className="file">{session.target.name}</span></div>
        </div>
      </div>
      <div className="ps-progress-region">
        <div className="copy"><div className="num">{t('patchsnap.count_of_total', { placed: placedCount, total })}</div><div className="sub">{t('patchsnap.hunks_placed')}</div></div>
        <div className="pips">{placedStatus.map((status, hunkIdx) => <div key={hunkIdx} className={`pip ${status}`} />)}</div>
      </div>
      <div className="ps-actions">
        <button className={`ps-help-btn ${showHelp ? 'active' : ''}`} onClick={() => setShowHelp(true)} aria-label={t('patchsnap.help')}>?</button>
        <div className="theme-toggle" role="tablist">
          <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>{t('patchsnap.light')}</button>
          <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>{t('patchsnap.dark')}</button>
        </div>
        <button className="ps-btn ghost" onClick={onCancel}><IconX size={14} /> {t('patchsnap.cancel')}</button>
        <button className="ps-btn primary" disabled={!allPlaced} onClick={() => setShowApply(true)}>
          <IconCheck size={14} /> {t('patchsnap.apply_patch')}
        </button>
      </div>
    </header>
  )
}

function PatchTray({ session, placements, levels, setLevels, drag, dragOffsetLines, startDrag, activeHunkId, setActiveHunkId, onNudge, onPickCandidate, candidatePicks, manualEdits, onManualEdit, setManualEdits, counts, allPlaced, total, setShowApply }: {
  session: PatchSession; placements: Record<string, number>; levels: Record<string, string>
  setLevels: React.Dispatch<React.SetStateAction<Record<string, string>>>
  drag: { kind: 'hunk' | 'block'; hunkId: string; startY: number; currentY: number } | null
  dragOffsetLines: number; startDrag: (pointerEvent: React.PointerEvent, kind: 'hunk' | 'block', hunkId: string) => void
  activeHunkId: string | null; setActiveHunkId: (id: string | null) => void
  onNudge: (hunkId: string, delta: number) => void; onPickCandidate: (hunkId: string, offset: number) => void
  candidatePicks: Record<string, number>; manualEdits: Record<string, ManualState>
  onManualEdit: (hunkId: string, text?: string) => void
  setManualEdits: React.Dispatch<React.SetStateAction<Record<string, ManualState>>>
  counts: { auto: number; nudged: number; manual: number; todo: number }
  allPlaced: boolean; total: number; setShowApply: (show: boolean) => void
}) {
  const { t } = useI18n()

  return (
    <aside className="ps-tray">
      <div className="ps-tray-head">
        <div className="ps-tray-title-row"><span className="label">{t('patchsnap.patch_label')}</span><h2>{session.patchId}</h2></div>
        <div className={`ps-block-handle ${drag?.kind === 'block' ? 'dragging' : ''}`}
             onPointerDown={(event) => { setActiveHunkId(null); startDrag(event, 'block', '') }}>
          <div className="grip">{Array.from({ length: 6 }).map((_, dotIdx) => <span key={dotIdx} />)}</div>
          <div className="copy"><strong>{t('patchsnap.move_whole_patch')}</strong><span>{t('patchsnap.slides_all_hunks', { total })}</span></div>
          <div className="offset">{dragOffsetLines !== 0 && drag?.kind === 'block' ? `${dragOffsetLines > 0 ? '+' : ''}${dragOffsetLines} L` : '±0'}</div>
        </div>
      </div>
      <div className="ps-tray-scroll">
        {session.hunks.map((hunk, idx) => (
          <HunkCard key={hunk.id} hunk={hunk} idx={idx}
            analysis={session.analyses.find((hunkAnalysis) => hunkAnalysis.hunkId === hunk.id)!}
            placement={placements[hunk.id]} level={levels[hunk.id]}
            onLevelChange={(lvl) => setLevels((prev) => ({ ...prev, [hunk.id]: lvl }))}
            onDragStart={(event) => startDrag(event, 'hunk', hunk.id)}
            dragging={drag?.kind === 'hunk' && drag.hunkId === hunk.id}
            isBlockDragging={drag?.kind === 'block'}
            dragOffset={dragOffsetLines}
            onNudge={(delta) => onNudge(hunk.id, delta)}
            onPickCandidate={(off) => onPickCandidate(hunk.id, off)}
            candidatePick={candidatePicks[hunk.id]}
            manualState={manualEdits[hunk.id]}
            onManualEdit={(text) => onManualEdit(hunk.id, text)}
            onManualSave={() => {}}
            onManualCancel={() => setManualEdits((prev) => { const next = { ...prev }; delete next[hunk.id];

 return next })}
            isActive={activeHunkId === hunk.id}
            onFocus={() => setActiveHunkId(hunk.id)}
          />
        ))}
      </div>
      <div className="ps-tray-foot">
        <div className="summary">
          <span className="pill ok"><span className="dot" /><strong>{counts.auto}</strong> {t('patchsnap.pill_auto_snapped')}</span>
          <span className="pill nudge"><span className="dot" /><strong>{counts.nudged}</strong> {t('patchsnap.pill_nudged')}</span>
          <span className="pill manual"><span className="dot" /><strong>{counts.manual}</strong> {t('patchsnap.pill_hand_merged')}</span>
          {counts.todo > 0 && <span className="pill todo"><span className="dot" /><strong>{counts.todo}</strong> {t('patchsnap.pill_need_look')}</span>}
        </div>
        <div className="apply-row">
          <button className="ps-btn primary" disabled={!allPlaced} onClick={() => setShowApply(true)}>
            <IconCheck size={14} /> {allPlaced ? t('patchsnap.apply_patch') : t('patchsnap.place_more_to_apply', { count: counts.todo })}
          </button>
        </div>
      </div>
    </aside>
  )
}

// ─── Root app component ───────────────────────────────────────────────────────

export function PatchSnapApp({ session, onApply, onCancel }: {
  session: PatchSession; onApply: (req: ApplyRequest) => void; onCancel: () => void
}) {
  const { t } = useI18n()
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [activeHunkId, setActiveHunkId] = useState<string | null>(session.hunks[0]?.id ?? null)
  const [showApply, setShowApply] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [applied, setApplied] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const { placements, setPlacements, nudged, setNudged, candidatePicks, levels, setLevels, onNudge, onPickCandidate } = usePatchPlacements(session)
  const { manualEdits, setManualEdits, onManualEdit } = usePatchManual(session, placements)
  const { resolutions, placedStatus, placedCount, total, allPlaced, counts } = usePatchResolutions(session, placements, nudged, candidatePicks, manualEdits)
  const { drag, dragOffsetLines, draggingHunkId, startDrag } = useDrag(session, setPlacements, setNudged)

  useEffect(() => {
    function onKey(keyEvent: KeyboardEvent) {
      if (keyEvent.key === '?' && !showApply && !showHelp) setShowHelp(true)
      else if (keyEvent.key === 'Escape' && showApply) setShowApply(false)
      else if (keyEvent.key === 'Escape' && showHelp) setShowHelp(false)
      else if (keyEvent.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [showApply, showHelp, onCancel])

  function scrollToHunk(id: string) {
    setActiveHunkId(id)
    if (!scrollRef.current) return
    const el = scrollRef.current.querySelector(`[data-hunk-id="${id}"]`)
    const top = el ? (el as HTMLElement).offsetTop : (placements[id] - 1) * LINE_H + 12
    scrollRef.current.scrollTo({ top: Math.max(0, top - 120), behavior: 'smooth' })
  }

  function emitApply() {
    const req: ApplyRequest = { patchId: session.patchId, resolutions: resolutions.map(({ _confidence: _cc, _state: _ss, ...rest }) => rest) }
    onApply(req)
    setApplied(true)
    setShowApply(false)
    setTimeout(() => setApplied(false), 3200)
  }

  return (
    <div className="ps-app" data-theme={theme}>
      <PatchHeader session={session} theme={theme} setTheme={setTheme} showHelp={showHelp}
        setShowHelp={setShowHelp} placedCount={placedCount} total={total}
        placedStatus={placedStatus} allPlaced={allPlaced} onCancel={onCancel} setShowApply={setShowApply} />
      <div className="ps-body">
        <div className="ps-canvas">
          <div className="ps-canvas-head">
            <div className="lhs"><span>{t('patchsnap.updated_source')}</span><strong>{session.target.name}</strong><span>{t('patchsnap.lines_count', { count: session.target.content.split('\n').length })}</span></div>
          </div>
          <SourceCanvas target={session.target} hunks={session.hunks} analyses={session.analyses}
            placements={placements} activeHunkId={activeHunkId} dragOffset={dragOffsetLines}
            draggingHunkId={draggingHunkId} candidatePicks={candidatePicks} onPickCandidate={onPickCandidate}
            scrollRef={scrollRef} onScrollToHunk={scrollToHunk} manualEdits={manualEdits} />
          <div className="ps-canvas-foot">
            <div className="lhs">
              <span className="keyhint"><kbd>{t('patchsnap.kbd_drag')}</kbd> {t('patchsnap.hint_drag')}</span>
              <span className="keyhint"><kbd>↑↓</kbd> {t('patchsnap.hint_nudge')}</span>
            </div>
            <div className="lhs u-ink-3">
              <span>{t('patchsnap.read_only_note')}</span><IconLock size={12} />
            </div>
          </div>
        </div>
        <PatchTray session={session} placements={placements} levels={levels} setLevels={setLevels}
          drag={drag} dragOffsetLines={dragOffsetLines} startDrag={startDrag}
          activeHunkId={activeHunkId} setActiveHunkId={setActiveHunkId}
          onNudge={onNudge} onPickCandidate={onPickCandidate} candidatePicks={candidatePicks}
          manualEdits={manualEdits} onManualEdit={onManualEdit} setManualEdits={setManualEdits}
          counts={counts} allPlaced={allPlaced} total={total} setShowApply={setShowApply} />
      </div>
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showApply && (
        <ApplySummary resolutions={resolutions.map(({ _confidence: _cc, _state: _ss, ...rest }) => rest)}
          onCancel={() => setShowApply(false)} onApply={emitApply} />
      )}
      {applied && <div className="ps-toast"><IconCheck size={14} /><span>{t('patchsnap.applied_toast')}</span></div>}
    </div>
  )
}
