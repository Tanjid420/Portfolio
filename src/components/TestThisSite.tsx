import { testingGuideUrl } from '../data/cv'

// Invites other QA engineers to run the site's Playwright suite. Shown on the CV page, the ending and "How to play".
export function TestThisSite({ className = 'test-site' }: { className?: string }) {
  return (
    <p className={className}>
      <span aria-hidden="true">🧪</span> Fellow tester?{' '}
      <a href={testingGuideUrl} target="_blank" rel="noreferrer" data-testid="test-this-site">
        Test this site
      </a>{' '}
      with its Playwright suite, and report what you break.
    </p>
  )
}
