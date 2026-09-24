---
minutes: 5
---
# The Clockmaker's Daughter

*Every clock in the shop was wrong except one.*

## The Shop {#shop}

Ada swept the shop at dawn, the way her father had, counting clocks as she went.
Forty-one of them ticked. One did not.

:::secret{id="brass-key" name="A brass winding key" alt="A small brass winding key with a heart-shaped bow" hint="Something glints under the counter"}
Under the counter, taped to the wood: a winding key, and a note in her father's hand.
:::

## The Silent Clock {#silent-clock}

::achievement{id="listener" name="The Listener" description="Heard the silent clock."}

:::choice{id="wind" label="Wind the silent clock?"}
- wind: Wind it
- leave: Leave it be
:::

:::branch{choice="wind" option="wind"}
It ticks. Somewhere upstairs, a door opens.

:::ending{id="door" name="The Open Door"}
She climbs the stairs.
:::
:::

:::branch{choice="wind" option="leave"}
She leaves it silent, and the shop keeps its secret one more day.

:::ending{id="silence" name="One More Day"}
The kettle boils.
:::
:::
