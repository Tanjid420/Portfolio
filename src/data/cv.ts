// All CV content lives here. The CV page and (later) the bug report cards read from this file.

export interface Contact {
  email: string
  phone: string
  location: string
  github: string
  linkedin: string
}

export interface Job {
  company: string
  role: string
  workMode: string
  location: string
  period: string
}

export interface Contribution {
  title: string
  detail: string
}

// Two contributions per golden bug, with a headline for the card.
export interface ContributionGroup {
  id: string
  name: string
  headline: string
  items: [Contribution, Contribution]
}

export interface SkillGroup {
  label: string
  items: string[]
}

// Two skill bugs, four skill groups each.
export interface SkillBug {
  id: string
  name: string
  groups: SkillGroup[]
}

export interface Education {
  degree: string
  school: string
  country: string
  period: string
  cgpa: string
}

export const cv = {
  name: 'Md. Tangid Khan',
  shortName: 'Tangid Khan',
  title: 'QA Engineer · Web & Mobile · Manual Testing & Automation',
  contact: {
    email: 'tangidkhan67@gmail.com',
    phone: '+88 01304737298',
    location: 'Dhaka, Bangladesh',
    github: 'github.com/Tanjid420',
    linkedin: 'linkedin.com/in/mdtangidkhan',
  } satisfies Contact,

  summary: [
    "I've spent the last 2+ years doing manual testing and quality assurance on a POS platform, a financial technology (fintech) system handling invoices, payments, and transaction reports, the kind of flows where a wrong value isn't just a UI bug.",
    "Two years as the sole QA owner across four applications (POS, KIOSK, STOCK, OFFICE) sharpened my software testing instincts, from test case design and execution to reproducing what a spec doesn't say clearly enough to act on.",
    'On the automation side, I self-learned Playwright, integrated key flows into GitHub Actions CI/CD pipelines, and use AI tools like Claude for test case generation, bug analysis, and automation code writing.',
  ],

  job: {
    company: 'Resonian Inc.',
    role: 'Software QA Engineer',
    workMode: 'Remote',
    location: 'California, USA',
    period: 'July 2024 – Present',
  } satisfies Job,

  // Order matches the CV page; grouping matches the four golden bugs.
  contributionGroups: [
    {
      id: 'finding-bugs',
      name: 'Finding bugs',
      headline: '1,000+ bugs reported',
      items: [
        {
          title: 'Exploratory testing',
          detail:
            'Designed and ran unscripted sessions on high-risk transactional flows (invoices, payments, VAT/tax), consistently surfacing edge cases scripted checks missed.',
        },
        {
          title: 'Reported 1,000+ bugs',
          detail:
            'Narrowed root cause before filing and wrote tight, reproducible steps with severity context, so developers could act without back-and-forth.',
        },
      ],
    },
    {
      id: 'stopping-bugs-early',
      name: 'Stopping bugs early',
      headline: 'Dozens of defects stopped before the sprint',
      items: [
        {
          title: 'Pre-feature risk analysis',
          detail:
            'Reviewed requirements and acceptance criteria with developers and product managers before development started to scope what needed testing and flag high-risk areas, preventing dozens of defects from ever entering the sprint.',
        },
        {
          title: 'Tested Smart Invoice, an AI-powered invoice management feature',
          detail:
            'Manually validated AI-extracted data and auto-categorization against real invoices on web and mobile, catching edge cases where the model misread or miscategorized line items.',
        },
      ],
    },
    {
      id: 'owning-quality',
      name: 'Owning quality',
      headline: '4 apps, 1 QA owner',
      items: [
        {
          title: 'Sole owner of platform quality',
          detail:
            'Across 4 applications, POS, KIOSK, STOCK, and OFFICE, covering new features, regression, and every release end-to-end on web and mobile.',
        },
        {
          title: 'Maintenance',
          detail:
            'Authored test suites, test cases, exploratory checklists, and internal system documentation; ran weekly smoke and regression passes before every production release.',
        },
      ],
    },
    {
      id: 'leveling-up',
      name: 'Leveling up',
      headline: '2 junior engineers mentored',
      items: [
        {
          title: 'Mentored 2 junior engineers',
          detail: 'During onboarding, pairing on test design and bug triage.',
        },
        {
          title: 'Self-taught Playwright',
          detail:
            'To automate repetitive regression checks on key web flows; integrated test runs into GitHub Actions CI/CD pipelines for continuous testing on every push for two critical menus.',
        },
      ],
    },
  ] satisfies ContributionGroup[],

  skillBugs: [
    {
      id: 'how-i-test',
      name: 'How I test',
      groups: [
        {
          label: 'Testing Types',
          items: ['Exploratory', 'Regression', 'Smoke', 'E2E', 'Integration', 'Functional', 'Usability', 'Sanity', 'Test Case Design & Execution'],
        },
        { label: 'Platforms', items: ['Web (React SaaS, B2B)', 'Mobile (iOS & Android)'] },
        { label: 'Methodology', items: ['Agile', 'SDLC', 'STLC', 'Defect Life Cycle'] },
        { label: 'Debugging Tools', items: ['Browser DevTools'] },
      ],
    },
    {
      id: 'what-i-test-with',
      name: 'What I test with',
      groups: [
        { label: 'Automation', items: ['Playwright', 'Jest', 'GitHub Actions', 'CI/CD pipelines'] },
        { label: 'API Testing', items: ['Postman'] },
        { label: 'Languages', items: ['TypeScript', 'Node.js', 'MySQL'] },
        { label: 'AI Tools', items: ['Claude Code'] },
      ],
    },
  ] satisfies SkillBug[],

  education: {
    degree: 'B.Sc in Computer Science and Engineering',
    school: 'Shahjalal University of Science and Technology',
    country: 'Bangladesh',
    period: '2019 – 2024',
    cgpa: '3.16 / 4.00',
  } satisfies Education,
}

export const cvPdfUrl = `${import.meta.env.BASE_URL}Tangid_Khan_CV.pdf`
