// Turns a caught bug into a ticket-style bug report, filled from the CV.
// Pure logic, no React, so it is easy to test.

import { cv } from '../data/cv'
import { BUGS, zoneOf, type BugDef } from './bugs'

export type Severity = 'Critical' | 'Major' | 'Minor'

export interface ReportRow {
  label: string
  value: string
}

export interface BugReport {
  id: string
  kind: BugDef['kind']
  severity: Severity
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

export function reportById(id: string): BugReport | null {
  const def = BUGS.find((b) => b.id === id)
  return def ? reportFor(def) : null
}
