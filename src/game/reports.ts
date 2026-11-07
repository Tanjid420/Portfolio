// Turns a caught bug into a ticket-style bug report, filled from the CV.
// Pure logic, no React, so it is easy to test.

import { cv } from '../data/cv'
import { funFacts } from '../data/funFacts'
import { BUGS, zoneOf, type BugDef } from './bugs'
import { HIDDEN_BUGS } from './hidden'
import { GLASS_CARD_ID } from './store'

export type Severity = 'Critical' | 'Major' | 'Minor' | 'Trivial' | 'Info'

export interface ReportRow {
  label: string
  value: string
}

export interface BugReport {
  id: string
  kind: BugDef['kind'] | 'hidden' | 'tool'
  severity: Severity
  /** Status pill, e.g. "✔ Resolved". */
  status: string
  /** Small label at the right of the header, e.g. "★ Golden bug". */
  badge?: string
  title: string
  /** Big number line at the top of golden cards. */
  headline?: string
  /** "Office Zone (Professional Experience)" */
  foundIn: string
  rows: ReportRow[]
}

const SEVERITY: Record<BugDef['kind'], Severity> = {
  boss: 'Critical',
  golden: 'Major',
  normal: 'Minor',
}

export function reportFor(def: BugDef): BugReport {
  const zone = zoneOf(def)
  const base = {
    id: def.id,
    kind: def.kind,
    severity: SEVERITY[def.kind],
    status: '✔ Resolved',
    badge: def.kind === 'golden' ? '★ Golden bug' : undefined,
    foundIn: `${zone.name} (${zone.section})`,
  }
  const c = def.content

  if (c.type === 'job') {
    const { job } = cv
    return {
      ...base,
      title: `${job.role} at ${job.company}`,
      rows: [
        { label: 'Role', value: job.role },
        { label: 'Company', value: job.company },
        { label: 'Location', value: `${job.workMode} · ${job.location}` },
        { label: 'Period', value: job.period },
      ],
    }
  }

  if (c.type === 'contribution') {
    const group = cv.contributionGroups.find((g) => g.id === c.groupId)!
    return {
      ...base,
      title: group.name,
      headline: group.headline,
      rows: group.items.map((item) => ({
        label: item.title,
        value: item.detail,
      })),
    }
  }

  if (c.type === 'skills') {
    const bug = cv.skillBugs.find((b) => b.id === c.skillBugId)!
    return {
      ...base,
      title: bug.name,
      rows: bug.groups.map((g) => ({
        label: g.label,
        value: g.items.join(' · '),
      })),
    }
  }

  const { education: edu } = cv
  return {
    ...base,
    title: edu.degree,
    rows: [
      { label: 'School', value: `${edu.school}, ${edu.country}` },
      { label: 'Period', value: edu.period },
      { label: 'CGPA', value: edu.cgpa },
    ],
  }
}

/** Card for picking up the magnifying glass. */
const glassReport: BugReport = {
  id: GLASS_CARD_ID,
  kind: 'tool',
  severity: 'Info',
  status: '🔍 Unlocked',
  title: 'New tool: magnifying glass',
  foundIn: 'Welcome Zone (About Me)',
  rows: [
    { label: 'What it does', value: 'Hidden bugs show up when you walk close to them. Every QA needs one.' },
    { label: 'How many', value: `${HIDDEN_BUGS.length} hidden bugs, off the main path.` },
    { label: 'Coverage', value: "They don't count toward coverage. Catch them anyway for fun facts." },
  ],
}

export function reportById(id: string): BugReport | null {
  if (id === GLASS_CARD_ID) return glassReport
  const hidden = HIDDEN_BUGS.findIndex((b) => b.id === id)
  if (hidden >= 0) {
    const fact = funFacts[HIDDEN_BUGS[hidden].factIndex]
    return {
      id,
      kind: 'hidden',
      severity: 'Trivial',
      status: '✔ Resolved',
      badge: `🔍 Hidden bug ${hidden + 1} / ${HIDDEN_BUGS.length}`,
      title: fact.title,
      foundIn: 'Off the beaten path',
      rows: [{ label: 'Fun fact', value: fact.text }],
    }
  }
  const def = BUGS.find((b) => b.id === id)
  return def ? reportFor(def) : null
}
