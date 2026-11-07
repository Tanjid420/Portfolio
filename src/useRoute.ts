import { useEffect, useState } from 'react'

// Hash routes work on GitHub Pages without a 404 fallback.
export type Route = 'game' | 'cv'

function readRoute(): Route {
  return window.location.hash === '#/cv' ? 'cv' : 'game'
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(readRoute)
  useEffect(() => {
    const onChange = () => {
      setRoute(readRoute())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
