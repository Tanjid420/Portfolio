// Fun facts the hidden bugs reveal. These are placeholders: the owner can swap in their own.

export interface FunFact {
  title: string
  text: string
}

export const funFacts: FunFact[] = [
  {
    title: 'The first bug was a real bug',
    text: 'In 1947, engineers found a moth stuck in the Harvard Mark II computer. They taped it into the logbook: "First actual case of bug being found."',
  },
  {
    title: 'Rubber duck debugging',
    text: 'Explaining your code, line by line, to a rubber duck often reveals the bug. The duck never interrupts.',
  },
  {
    title: 'A very expensive missing test',
    text: 'NASA lost the Mars Climate Orbiter in 1999 because one team used pounds and another used newtons. A unit test for units would have helped.',
  },
]
