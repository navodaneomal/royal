/**
 * Starter books for the composer (#/add, Studio → Publish): a blank page and
 * five short, complete stories — one per Quick Book theme — that show every
 * directive at work. tests/publishing/compose.test.js builds and validates
 * each one with the real release gate.
 */
export const STARTER_BOOKS = [
  {
    id: 'blank', title: 'A blank book', theme: 'manuscript',
    blurb: 'Two empty chapters and a cheat-sheet in the margins.',
    markdown: `# My book

## The beginning {#beginning}

Write your first chapter here. Every chapter heading becomes a place readers
can come back to.

## What happens next {#next}

Keep going. Add a secret, a choice, or an ending with the buttons above the
editor.
`,
  },
  {
    id: 'mystery', title: 'The Locked Study', theme: 'manuscript',
    blurb: 'A country-house mystery: one clue to find, one accusation to make, two endings.',
    markdown: `---
rating: everyone
minutes: 8
tagline: Somebody in this house is lying. The fire knows who.
---
# The Locked Study

*Somebody in this house is lying. The fire knows who.*

## The body in the armchair {#armchair}

The study door was locked from the inside, and the key lay on the carpet
beneath it, as though it had tried to run.

Colonel Ashby sat in the armchair by the fire. He had been reading. He would
not be finishing.

:::secret{id="ash-letter" name="A half-burnt letter" alt="A letter blackened at one corner, the words 'Tuesday, the greenhouse' still legible" hint="Something pale lies among the ashes"}
In the grate, a letter has refused to burn completely. *Tuesday, the
greenhouse,* it says, in a hand you have seen before — on the gardener's
seed labels.
:::

## The household {#household}

Three people had a key to the garden door: the housekeeper, Mrs. Pell; the
nephew, Roland; and Briggs, the gardener.

:::choice{id="accuse" label="Who do you accuse?"}
- roland: Roland, who inherits everything
- briggs: Briggs, whose handwriting is on the letter
:::

## The reckoning {#reckoning}

:::branch{choice="accuse" option="roland"}
Roland laughs, and the laugh is the worst thing in the room. He was in town
all night; three people saw him. The real hand that locked the door stays
hidden.

:::ending{id="wrong-man" name="The Wrong Man"}
The case is closed, and wrongly. Somewhere, a greenhouse door swings in the wind.
:::
:::

:::branch{choice="accuse" option="briggs"}
Briggs does not deny it. He only asks whether you found the letter, and
when you nod, he sits down very slowly.

::achievement{id="sharp-eyes" name="Sharp Eyes" description="Named the culprit." secret}

:::ending{id="greenhouse" name="The Greenhouse Letter"}
The truth was in the fire all along. You simply looked before it finished burning.
:::
:::
`,
  },
  {
    id: 'fox', title: 'The Lantern Fox', theme: 'watercolor',
    blurb: 'A gentle fable in watercolour: one hidden kindness and a soft ending.',
    markdown: `---
rating: everyone
minutes: 5
tagline: A small fox, a lantern, and the longest night of the year.
---
# The Lantern Fox

## The snow road {#snow-road}

On the longest night, a small fox carried a lantern along the snow road,
because the village had forgotten how to find its way home.

:::secret{id="warm-mitten" name="A red mitten" alt="A single red knitted mitten lying on fresh snow" hint="Something red waits beside the road"}
A child's mitten lies in the snow. The fox tucks it under the lantern's
handle, where it will stay warm until morning.
:::

## The village gate {#gate}

One by one, the windows saw the little light and remembered. Doors opened.
Soup was shared. Someone found a mitten, warm as toast.

:::ending{id="home" name="Home by Lantern-light"}
The fox curled up by the last fire in the village and slept, the lantern
still glowing at its side.
:::
`,
  },
  {
    id: 'signal', title: 'Signal from Kepler', theme: 'terminal',
    blurb: 'A terminal-green science-fiction short: decode a message, answer or stay silent.',
    markdown: `---
rating: everyone
minutes: 6
tagline: Nine years of silence. Then, at 03:12, prime numbers.
---
# Signal from Kepler

## Night shift {#night-shift}

The array has been quiet for nine years. Tonight, at 03:12, it is not.

:::secret{id="prime-pattern" name="The prime pattern" alt="A row of pulses grouped 2, 3, 5, 7, 11" hint="Look closer at the pulse groups"}
The pulses come in groups: 2, 3, 5, 7, 11. Nothing in nature counts in primes.
:::

## The decision {#decision}

:::choice{id="reply" label="The protocol says report and wait. Your hand is on the transmitter."}
- answer: Send the next prime: 13
- report: Log it, report it, wait for the committee
:::

## Afterwards {#afterwards}

:::branch{choice="reply" option="answer"}
Thirteen pulses leave the dish. Four years from now, someone will hear them.

:::ending{id="first-word" name="The First Word"}
You will not live to hear the reply. You start writing it a letter anyway.
:::
:::

:::branch{choice="reply" option="report"}
The committee meets in a month. By then, the signal has stopped.

:::ending{id="silence" name="Proper Channels"}
The report is filed, thorough and correct. The sky stays very, very quiet.
:::
:::
`,
  },
  {
    id: 'noir', title: 'Rain on Ninth Street', theme: 'noir',
    blurb: 'Black-and-white noir: one choice in a bar booth, two ways out.',
    markdown: `---
rating: teen
warnings: [violence (implied)]
minutes: 6
tagline: She owned the bar. I owned the trouble.
---
# Rain on Ninth Street

## The booth {#booth}

She slid into my booth like she owned the bar, which, it turned out, she did.

"Somebody took my brother's ledger," she said. "I want it back before the
police want it more."

:::choice{id="job" label="Do you take the job?"}
- take: Take the envelope
- walk: Leave the envelope on the table
:::

## Ninth Street {#ninth-street}

:::branch{choice="job" option="take"}
The ledger was where she said. So were the two men waiting for it.

:::ending{id="ledger" name="Paid in Full"}
I kept the ledger and the rain kept my secret. Some jobs you finish so you can sleep.
:::
:::

:::branch{choice="job" option="walk"}
I left the money and walked into the rain. By morning the bar had a new owner.

:::ending{id="walked" name="Clean Hands"}
Clean hands, empty pockets. In this city that counts as winning.
:::
:::
`,
  },
  {
    id: 'poems', title: 'Small Hours', theme: 'minimal',
    blurb: 'A pocket collection of short poems — each one a chapter.',
    markdown: `---
rating: everyone
minutes: 3
kicker: Poem
tagline: Four short poems for the hours before morning.
---
# Small Hours

## Kettle {#kettle}

The kettle starts its low complaint,
a weather system in a pot —
the whole house waiting, like a saint,
for something it has not quite got.

## Window {#window}

Frost has written on the glass
in a language made of fern.
I read it slowly. It will pass.
Some things you only get one turn.

## Lamp {#lamp}

Leave the lamp on in the hall
for whoever comes home late —
light is the kindest thing of all
to find still waiting at the gate.

:::ending{id="morning" name="Morning"}
And then the birds. And then the day.
:::
`,
  },
]

export const starterBook = (id) => STARTER_BOOKS.find((b) => b.id === id) ?? STARTER_BOOKS[0]
