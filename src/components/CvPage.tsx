import type { ReactNode } from 'react'
import { cv, cvPdfUrl } from '../data/cv'

// Plain, fast CV page. Also the fallback when the 3D game can't load.
export function CvPage({ notice }: { notice?: ReactNode }) {
  const { contact, job, education } = cv
  return (
    <main className="cv" data-testid="cv-page">
      {notice}
      <section className="cv-head">
        <h1>{cv.name}</h1>
        <p className="cv-title">{cv.title}</p>
        <ul className="cv-contact">
          <li>
            <a href={`mailto:${contact.email}`}>{contact.email}</a>
          </li>
          <li>
            <a href={`tel:${contact.phone.replace(/\s/g, '')}`}>{contact.phone}</a>
          </li>
          <li>{contact.location}</li>
          <li>
            <a href={`https://${contact.github}`} target="_blank" rel="noreferrer">
              {contact.github}
            </a>
          </li>
          <li>
            <a href={`https://${contact.linkedin}`} target="_blank" rel="noreferrer">
              {contact.linkedin}
            </a>
          </li>
        </ul>
      </section>

      <section aria-labelledby="about">
        <h2 id="about">About Me</h2>
        {cv.summary.map((p) => (
          <p key={p.slice(0, 20)}>{p}</p>
        ))}
      </section>

      <section aria-labelledby="experience">
        <h2 id="experience">Professional Experience</h2>
        <div className="cv-job">
          <div>
            <h3>{job.role}</h3>
            <p className="muted">
              {job.company} · {job.workMode}
            </p>
          </div>
          <div className="cv-job-meta muted">
            <p>{job.period}</p>
            <p>{job.location}</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="contributions">
        <h2 id="contributions">Contributions</h2>
        <ul className="cv-list">
          {cv.contributionGroups.flatMap((g) =>
            g.items.map((item) => (
              <li key={item.title}>
                <strong>{item.title}:</strong> {item.detail}
              </li>
            )),
          )}
        </ul>
      </section>

      <section aria-labelledby="skills">
        <h2 id="skills">Skills</h2>
        <dl className="cv-skills">
          {cv.skillBugs.flatMap((b) =>
            b.groups.map((g) => (
              <div key={g.label}>
                <dt>{g.label}</dt>
                <dd>{g.items.join(' · ')}</dd>
              </div>
            )),
          )}
        </dl>
      </section>

      <section aria-labelledby="education">
        <h2 id="education">Education</h2>
        <h3>{education.degree}</h3>
        <p className="muted">
          {education.school}, {education.country}
        </p>
        <p className="muted">
          {education.period} · CGPA {education.cgpa}
        </p>
      </section>

      <p className="cv-foot">
        <a className="btn btn-primary" href={cvPdfUrl} download>
          Download CV (PDF)
        </a>
      </p>
    </main>
  )
}
