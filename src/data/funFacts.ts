// Fun facts the hidden bugs reveal, one per hidden bug.

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
  {
    title: 'Have you tried turning your plane off and on again?',
    text: 'In 2015, US aviation officials told airlines to restart every Boeing 787 at least once every 248 days. A counter inside the power system overflowed after that long. IT support advice, now at 35,000 feet.',
  },
  {
    title: 'Gangnam Style broke YouTube',
    text: 'In 2014, the video passed 2,147,483,647 views: the biggest number YouTube\'s counter could hold. YouTube had to upgrade it. Nobody had a test case for "what if a K-pop video gets too popular?"',
  },
  {
    title: "The world's most expensive fireworks",
    text: 'In 1996, the Ariane 5 rocket blew up 37 seconds after launch. It reused code from the older, slower Ariane 4, and a speed number got too big to fit. Cost: about $370 million. Lesson: "it worked last time" is not a test result.',
  },
  {
    title: 'A chip that was bad at math',
    text: 'In 1994, Intel\'s Pentium chip got some divisions slightly wrong, and the recall cost $475 million. The joke at the time: "How many Pentium designers does it take to change a light bulb? 1.99904274017. Close enough."',
  },
  {
    title: 'The most expensive hyphen in history',
    text: 'In 1962, NASA blew up the Mariner 1 space probe minutes after launch because one tiny symbol was missing from its guidance code. Writer Arthur C. Clarke called it "the most expensive hyphen in history." Always proofread.',
  },
]
