import { cv } from '../data/cv'

// Email, phone, location, GitHub and LinkedIn. Used on the CV page, the Welcome board and the finish screen.
export function ContactList({ className = 'cv-contact' }: { className?: string }) {
  const { contact } = cv
  return (
    <ul className={className} data-testid="contact">
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
  )
}
