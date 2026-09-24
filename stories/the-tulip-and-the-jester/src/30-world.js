<script>
/* ══════════════════════════════════════════════════════════════════
   THE KINGDOM — cast, ground, chronology, archive
   ══════════════════════════════════════════════════════════════════ */

const CAST = [
{
  id:'catherine', name:'Catherine Anne Smith', role:'Queen of France', emblem:'crown',
  quote:'“A man is not dead when he stops breathing. He is dead when the last person stops saying him.”',
  attr:'— in the empty garden, March 1751',
  art:'Eighteen. Small, dark-haired, unremarkable at rest and disconcerting in motion. Not a beauty and painted as one four times. Grey and ash-coloured silk, no jewels at the throat, dirt permanently under two fingernails on the right hand. Give her the face of someone who has been photographed a great deal and never once looked at. Consistent across all plates: a slight forward set of the head, as though listening for something behind her.',
  facts:[
   ['Born','12 April 1732, at Rivenelle'],
   ['House','Smith — armourers of Lorraine, ennobled 1657. Three generations from the forge to the throne, and the old families have never once let it go.'],
   ['Came to it','At fourteen, on the death of her father. Governed by regency until her majority at eighteen.'],
   ['Her mother','Marguerite of Cleves. Died 9 June 1740, when Catherine was eight.'],
   ['What she cannot do','Remember her mother’s face. There are four portraits. There is nothing behind them.'],
   ['What she can do','Say forty-one names in order, from the door to the wall, without a paper. She has been able to since she was six.'],
   ['Reigned','Thirty-one more years. Extremely well. Never popular again for a single day.']
  ],
  objects:[
   ['On her windowsill','A plain red clay pot','Chipped at the rim, unglazed, of no value. It arrived among two hundred and six birthday presents with no card, and she carried it upstairs herself, which caused a small commotion, because queens do not carry things. Underneath, scratched into the clay before firing, by somebody with a nail: <b>41</b>.'],
   ['Locked in the second drawer','The April book','Small, brown, unremarkable. One page a year since she was fourteen; considerably more in 1750. Nobody had ever read it. It contains every poem in this story, which means that the narrator you have been trusting is a nineteen-year-old girl who was, at the time, wrong about almost everything.'],
   ['Kept but never worn','The iron crown of the House of Smith','A thin band of forged iron under a wash of gold, because the first Smith king refused to be crowned in anything he had not made himself. Every court in Europe found it funny. She wore it eleven times in thirty-one years and hated all of them.'],
   ['On her dressing table','A tortoiseshell hairbrush','She assumed for ten years that it was hers.']
  ]
},
{
  id:'personne', name:'Personne', role:'The jester — born Julien Sevin', emblem:'mask',
  quote:'“You cannot refuse on a stage. Refuse and they close you and you eat nothing. So you never refuse — you get there first, and you say yes to something else, louder.”',
  attr:'— on the library steps, June 1750',
  art:'Twenty-three. Lean, restless hands, a coat that has been three coats, bells sewn onto one cuff only. Not handsome; extremely watchable. The critical direction: he must never be drawn mid-joke. Draw him a half-second after the room has laughed, when his face has come back down. Same nose, same slightly crooked left eyebrow, same hands in every plate — the hands are the through-line, because an old woman in Cheneuil recognises him by them.',
  facts:[
   ['Born','1727, at Vaux-sur-Aine. A village that is no longer written on the milestone.'],
   ['His father','Anthelme Sevin, clerk of the mill. Taken under warrant on 4 March 1732 for carrying the parish register out of the church under his coat. Julien was five.'],
   ['His mother','Marie Sevin, laundress. Died at Chartres, 1744. She grew one white tulip in one clay pot in three towns for eleven years and made her son learn what it meant.'],
   ['Trained','With the company of Lansquenet, players, at the fairs of Saint-Germain and Saint-Laurent — where the law forbade them to speak dialogue on stage. He learned to say everything sideways. It is the only thing about him that is not a choice.'],
   ['How he got in','He bought the engagement of 12 April 1750 from old Lansquenet for eleven sous and a wool coat. Nobody checked. Nobody has ever checked.'],
   ['What he came for','Eight paces of ground behind a green door, and one name that is in no catalogue in Europe.'],
   ['What he did with the rest of his life','Gave away a flower at one sou the bulb, any quantity, in perpetuity.']
  ],
  objects:[
   ['Left behind in the north wing','The bells','Sewn onto one cuff only, because two cuffs is a clown and one cuff is a man who has been given a job. He unpicked them on the night of the twenty-ninth of November and left them on the bed, and nobody at Rivenelle ever moved them.'],
   ['In the lining of the case','Forty plates','Watercolour over graphite, folio, each flower life-size with its bulb in section and its name lettered underneath in a hand as flat and honest as a gravestone. Forty. The forty-first was never drawn, because the Queen of France said, twice, without looking up: <i>not that one, nobody touches that one.</i>'],
   ['In his pocket, always','A stub of pencil and a stolen sheet','He wrote one letter at Rivenelle, beginning <i>Mother — I have found it, it is here, it is a flower</i>, and burned it in the candle. His mother had been dead six years. There is no post from Rivenelle the Duc de Rouvray does not read.'],
   ['His entire estate, 1750','A wool coat','Very good. Wool.']
  ]
},
{
  id:'lisbet', name:'Lisbet van Hoorn', role:'The queen’s closest friend', emblem:'bulb',
  quote:'“You are not angry because he lied. You are angry because he had a <i>reason</i> to come.”',
  attr:'— on the floor, with her back against the door, 3 a.m., November 1750',
  art:'Twenty. Tall, wide-mouthed, sunburnt across the nose from the crossing and unbothered by it. Dutch clothes, better cut than anyone expects and two seasons old. She should look like the only person in any given room who has recently done manual labour. Draw her mid-sentence. She is always mid-sentence.',
  facts:[
   ['Of','Hoorn, in the Republic. Second house of the bulb trade since 1610; ruined in the crash of 1637; recovered; ruined again more quietly by her father, who is an optimist.'],
   ['At Rivenelle','Sent, at twenty, to be useful — meaning a trade concession, a marriage, or anything at all that could be carried home.'],
   ['Her secret','She wrote home every fortnight from every court she was ever placed in, from the age of fifteen. About the queen’s habits, her friendships, her fool. All of it true. All of it a betrayal by the only definition that mattered in November.'],
   ['Her last letter','22 November 1750: <i>Father, I will not do this any more. Sell the house.</i> It was read aloud in council and made no difference whatsoever.'],
   ['Her brother','Drowned at nineteen, off Texel, which is the reason a twenty-year-old girl was sent alone to a foreign court to save a firm.'],
   ['What she brought back','Folio 61, and the appended schedule nobody had bothered to look for in eighteen years, which turned out to be one of the two keys.'],
   ['Afterwards','She did not go home. She ran the Amsterdam end of a flower business at one sou the bulb, badly, at an enormous loss, for forty years.']
  ],
  objects:[
   ['Folio 61','Van Hoorn &amp; Zoon, Ledger of Exports, 1733','<i>Item — to a private buyer at Rivenelle in France, by way of Rouen: forty-one lots, being one hundred and twenty-three bulbs, sorts as per the appended schedule, registered this season at Haarlem and entered at Leiden. Paid in full, in coin, at the door.</i> And in the margin, in a nervous clerk’s hand: <b>“Names supplied by the buyer.”</b>'],
   ['The appended schedule','Forty-one names, forty-one dates','Because the trade requires a <i>date of introduction</i> for every new sort, and because Dutch bulb men are pedants, Queen Marguerite was obliged to supply one for each. She supplied the date each person was taken. It sat in a box in Hoorn next to the laundry accounts for eighteen years.'],
   ['Under her bed at Rivenelle','A crate of plums','She ate plums continuously from June to September and left the stones in a saucer on the windowsill, and Catherine could not bring herself to have them cleared away until March.']
  ]
},
{
  id:'odile', name:'Odile Vaneau', role:'First Lady of the Bedchamber', emblem:'key',
  quote:'“It was the middle of the word. I could not leave a man in the middle of his own name.”',
  attr:'— on being asked about the pencil, March 1751',
  art:'Fifty-eight. Grey, upright, forty-one years in one house. Should be drawn standing when everyone else is seated — she refuses chairs. Hands folded, always. One detail carried across every plate: a small white scar on the back of her left hand, where a four-year-old bit her on the ninth of June 1740.',
  facts:[
   ['Came','From Cleves in 1729, aged twenty-two, with Queen Marguerite and no French.'],
   ['Was','Marguerite’s woman first. Catherine’s governess second. First Lady of the Bedchamber for eleven years, and the single largest hole in the security of the French crown, because nobody at Rivenelle ever questioned anything she said.'],
   ['What she did on 9 June 1740','Carried an eight-year-old out to the orangery at seven in the morning because the physician had told her the hour the night before. Walked her up and down for one hour. Came back. Put her name to a paper.'],
   ['What she did in the autumn of 1740','Found her mistress’s letter under the last bed, read it standing up in the rain, finished the unfinished name in pencil, and put it back in the ground for whoever came after.'],
   ['What she did in June 1750','Put the garden key into the Duc de Rouvray’s hand in the rain, to buy the same thing she bought in 1740, in the same currency, at the same price.'],
   ['Her defence','None offered. <i>“I would do it again and it is the worst thing I know about myself.”</i>'],
   ['Afterwards','Came back in March and refused a chair.']
  ],
  objects:[
   ['Kept eighteen years','A long black key','Made for a garden door and never copied. She had it for a decade and gave it away in one evening, and held the man’s fist closed over it a moment too long, the way you do when you are giving somebody something you want back.'],
   ['Left on a bare mattress, January 1751','A tortoiseshell hairbrush','It had been Marguerite’s. She used it on the child every morning for ten years without once mentioning whose it was, and left it behind when she went, on a mattress in an empty room, in a house she had lived in for forty-one years, which nobody remarked on, because nobody was counting.'],
   ['Written in pencil, 1740','Four letters','<b>evin</b>']
  ]
},
{
  id:'seraphine', name:'Séraphine Loret', role:'The outsider — botanical illustrator', emblem:'quill',
  quote:'“You do not name a flower <i>the widow Bassot.</i> You name it Semper Augustus. You name it after a general or a virtue or your own vanity.”',
  attr:'— on the long table under the north window, March 1751',
  art:'Thirty-four. Travelling clothes, practical and unfashionable, ink permanently in the creases of the knuckles. Brown eyes that do not blink enough. She should always be drawn slightly apart from the group and looking at something outside the frame. She has been arrested twice, in two countries, for being a woman alone with a portfolio.',
  facts:[
   ['Trade','Botanical illustrator. Kassel, Het Loo, two gardens in Piedmont. Commissioned by a house in Leiden for a florilegium of the French royal gardens — forty-eight plates, subscribers already gathered.'],
   ['The real reason','In 1742, aged twenty-six, copying a dealer’s list, she came to <i>Tulipa, Perrine Bassot, veuve</i> and sat still for ten minutes.'],
   ['Nine years','Chasing the names through gardens, catalogues, nurseries and churchyards in five countries. She found thirty-nine of the forty in print.'],
   ['What she understood first','That the evidence could not be destroyed, because it had already been sold to everybody.'],
   ['What she found last','A gap in the Haarlem register of 1733 between number four hundred and eleven and number four hundred and thirteen. The page is not torn. It is skipped, and the numbering corrected in a later hand.'],
   ['What she never drew','Bed forty-one.'],
   ['Afterwards','The plates were printed at Leiden in 1753 in an edition of four hundred, with the names lettered beneath, and no text at all. It is the least explanatory book ever published and it did more than any of them.']
  ],
  objects:[
   ['Strapped inside her coat for four hundred miles','The portfolio','Forty plates, folio, watercolour over graphite. Each flower life-size, with its bulb drawn in section beside it, its leaf-form, and its name lettered underneath in a hand as flat and honest as a gravestone.'],
   ['Left on the still-room table under a stone','A note','<i>I am sorry. I have forty. Ask me in the spring what for.</i>'],
   ['In the margin of a drawing of a corn-poppy','An hour','<i>Two o’clock.</i> Written on the night of the masquerade, when she watched a Dutch girl in a cloak hand a sealed letter to a rider in the rain — and said nothing to anybody for six months, which is either discretion or cowardice and she has never decided which.']
  ]
},
{
  id:'rouvray', name:'Aymar, Duc de Rouvray', role:'Regent of France, 1746–1750', emblem:'seal',
  quote:'“I was twenty-four. I was given a province and a number and an instruction. I have never once been able to find the place where I should have stopped.”',
  attr:'— in the Long Hall, 12 April 1751',
  art:'Forty-three. Beautiful the way old furniture is beautiful — polished, correct, heavier than it looks. Should never be drawn scowling, never in shadow, never with any visual mark of villainy at all. Well-lit, courteous, and slightly tired. The most frightening figure in the book is the one drawn most kindly.',
  facts:[
   ['1732','Aged twenty-four. Intendant of the généralité of Aine — his first province. He signed the quarterly returns.'],
   ['What he signed','<i>Extraordinary charges: for the removal of persons from the said généralité, by warrant, this quarter — carts, escort, and subsistence — the number of forty-one.</i> No names. There are never any names.'],
   ['What was above his signature','Another one.'],
   ['1733–1751','Reached into the flower registers of a foreign country and removed exactly one name, well enough that it took a professional nine years to notice.'],
   ['1746–1750','Governed France in Catherine’s name, competently, and gave it back on his knees in front of four hundred people with a full heart.'],
   ['The wolf’s head','At the masquerade of 23 June 1750, a masked man danced with the queen and did not speak, and she told him — laughing, insulated by black silk — that she had exactly one hour a day in which anybody talked to her as though she were a person. Five months later he knew precisely where to cut. She never worked out who the wolf was. You have.'],
   ['His defence','Real, and not sufficient, and he knew both.']
  ],
  objects:[
   ['Eleven sheets, sewn, grey ribbon','The dossier','Name, village, father, date, company, the lot. Every word of it true and checkable. He would have been a fool to hand a queen a forgery she was capable of testing, and he was never a fool. That is what made it unsurvivable.'],
   ['29 November 1750','An order in council','Condemning the walled garden south at Rivenelle on suspicion of fire-blight: the beds to be turned, the stock lifted and burned, the ground limed. Countersigned by the crown physician. Such an order cannot be appealed. It is a matter of public health.'],
   ['The thing he never accounted for','A flower catalogue','He spent eighteen years protecting a signature and it never once occurred to him that anybody would lay a Dutch bulb list next to a French tax return. Neither is worth anything alone. That was the design.']
  ]
},
{
  id:'marguerite', name:'Marguerite of Cleves', role:'Queen of France, 1729–1740', emblem:'tulip',
  quote:'“There is no censor for a flower. There is no bonfire big enough.”',
  attr:'— from the letter under bed forty-one',
  art:'Never draw her face. Four portraits exist inside the story and all four are useless; honour that. Draw her hands in soil, her back at a window, a shape at the end of a row of beds in the rain. She is the largest character in this book and she is dead before it begins.',
  facts:[
   ['Came','From Cleves in 1729, foreign, German-speaking, twenty-one, and never once described in a French letter without the word <i>foreign</i> in the same sentence.'],
   ['Found out','In the summer of 1732, by means unknown.'],
   ['Said it out loud','Exactly once, to the King, in the yellow room. The physician came the next morning to enquire after her nerves, and came every morning for the following eight years.'],
   ['So she','Ordered forty-one lots of tulips from Hoorn, supplied the names and the dates herself, and had them registered at Haarlem — which copies to Leiden, which copies to Paris and London and Vienna, which sells, and sells again, into ten thousand gardens where every one of them is written out by hand on a wooden label by somebody who thinks he is writing nothing at all.'],
   ['And she','Taught her six-year-old daughter to walk the rows every April and say the names out loud, as a game, because she was six and there was no other way to make it stick.'],
   ['Died','9 June 1740, of a manner of death attested on paper by a woman who had been told the hour the night before.'],
   ['Her real work','A lock with two keys. She left one in a French finance office and posted the other to a flower shop, and told nobody, and died, and it held for nineteen years and then it opened.']
  ],
  objects:[
   ['Under bed forty-one, wrapped in oilcloth','The letter','It begins <i>To whoever has this ground after me</i> and ends in the middle of a man’s name. Read it in the Archive.'],
   ['With it','The planting map','Forty-one beds, ruled and numbered from the door to the wall, each with a name and a date in a small upright hand. All the dates are in one winter.'],
   ['What she gave away','One bulb of the forty-first sort','Sent in the autumn of 1733 to a laundress in Vaux whom she could not write to, could not visit, and could not do one single useful thing for — so she sent her a flower with her husband’s name on it, and the number of the bed it stood in at Rivenelle scratched into the clay.']
  ]
}
];

/* ─── the forty-one ────────────────────────────────────────────── */
const ROLL = [
['Vincent Aubertin','tanner, of Vaux-sur-Aine','4 December 1731'],
['Élisabeth Aubertin','his wife','4 December 1731'],
['Perrine Bassot','widow, seller of thread','11 December 1731'],
['Jacquot Bassot','her son, aged nine','11 December 1731'],
['Barthélemy Ruel','miller of Vaux','11 December 1731'],
['Denise Ruel','his mother, aged seventy-one','11 December 1731'],
['Simon Ferrières','measurer of grain','14 December 1731'],
['Ursule Ferrières','his wife','14 December 1731'],
['Gilles Ferrant','wheelwright','19 December 1731'],
['Marthe Ferrant','his wife','19 December 1731'],
['Henri Lacaze','carter','19 December 1731'],
['Rémy Delcour','curé of the parish of Vaux','22 December 1731'],
['Nicolas Chaubert','bookbinder, of Aine','6 January 1732'],
['Sylvie Chaubert','his daughter, aged seventeen','6 January 1732'],
['Guillaume Toussaint','printer’s apprentice','6 January 1732'],
['Léonard Vasse','sergeant of the watch, who refused an order','9 January 1732'],
['Agnès Vasse','his sister','9 January 1732'],
['Étienne Marbot','notary’s clerk','14 January 1732'],
['Fabienne Marbot','his wife','14 January 1732'],
['Louis Cordier','ropemaker','20 January 1732'],
['Jeanne Cordier','his wife','20 January 1732'],
['Michel Cordier','their son, aged six','20 January 1732'],
['Isaac Delmas','pedlar','27 January 1732'],
['Rose Delmas','his wife','27 January 1732'],
['Foulques Bénard','the bailiff’s man, who turned','2 February 1732'],
['Jérôme Lestang','schoolmaster','5 February 1732'],
['Catherine Lestang','his wife','5 February 1732'],
['Pierre-Ange Vandel','surgeon-barber','9 February 1732'],
['Antoine Sazerat','cooper','13 February 1732'],
['Madeleine Sazerat','his wife','13 February 1732'],
['Thomas Guiné','weaver','17 February 1732'],
['Anne Guiné','his wife','17 February 1732'],
['Aubin Grelier','shepherd','20 February 1732'],
['Colette Grelier','his wife','20 February 1732'],
['Jean Poilievre','thatcher','23 February 1732'],
['Roch Palanque','salt-carrier','25 February 1732'],
['Marie Renaudot','of the mill','28 February 1732'],
['Blaise Renaudot','her son, aged eleven','28 February 1732'],
['Gaspard Vinet','ferryman of the Aine','1 March 1732'],
['Claire Vinet','his daughter, aged fifteen','1 March 1732'],
['Anthelme Sevin','clerk of the mill at Vaux','4 March 1732']
];

/* ─── ground ───────────────────────────────────────────────────── */
const PLACES = [
{id:'longhall',x:112,y:120,ax:'start',name:'The Long Hall',after:1,
 desc:'Eight hundred candles in iron rings — not crystal, iron, because the House of Smith has one joke about itself and makes it in every room. A floor of black and ivory marble. Tall black windows at the north end with the rain on them.',
 memo:'“Four hundred and six times, Majesty. A hundred and nine Your Grace. And not once, in five hours, your name.”',
 who:'Catherine · Personne · Rouvray', chs:'I, IV, X'},
{id:'garden',x:258,y:206,ax:'start',name:'The Walled Garden',after:2,
 desc:'Behind a green door in the south wall. Eight paces by thirty, brick on three sides, warm all afternoon. Forty-one narrow beds running away from the door to the far wall in ranks, edged in flat stones. A bench. No fountain, no statue, no gravel walk.',
 memo:'“It isn’t planted, it’s written. Left to right, top to bottom. Somebody who could read laid this out.”',
 who:'Catherine · Marguerite · Personne · Séraphine', chs:'II, III, VI, VIII, IX, X'},
{id:'laundry',x:104,y:188,ax:'start',name:'The North Wing',after:2,
 desc:'Above the laundry: warm, low, smelling of lye. The best lodging he had had since a hayloft in Chartres with an excellent view of a rat. He ate downstairs with the household, which the household found insulting for four days and then stopped noticing.',
 memo:'A pair of bells, unpicked from one cuff and left on the bed. Nobody at Rivenelle ever moved them.',
 who:'Personne · Perrette · three hundred and forty others', chs:'II, VII'},
{id:'library',x:124,y:154,ax:'start',name:'The Royal Library',after:2,
 desc:'Nine thousand volumes and a step-ladder that has killed a footman. On page four hundred and nine of the palace inventory of 1741: <i>Item. In the walled garden south, of tulips, forty sorts.</i>',
 memo:'She read it three times. She had counted the beds every April since she was eight. There were forty-one.',
 who:'Catherine · Personne · a great many apricots', chs:'II, III'},
{id:'forge',x:108,y:256,ax:'start',name:'The Forge',after:4,
 desc:'The old armoury, disused, off the little court between the chapel and the stables. The first Smith king’s anvil is still in it, under a sheet, because nobody has ever been brave enough to move it or vulgar enough to display it.',
 memo:'Three generations from the forge to the throne, and the old families have never once let them forget it.',
 who:'the House of Smith', chs:'IV'},
{id:'court',x:126,y:290,ax:'start',name:'The Little Court',after:4,
 desc:'Between the chapel and the old armoury. A lantern, in the rain, at three in the morning on Saint John’s Eve.',
 memo:'She put the key into his hand and closed his fingers over it, and then held his fist a moment longer, the way you do when you are giving somebody something you want back.',
 who:'Odile · Rouvray', chs:'IV'},
{id:'cheneuil',x:398,y:302,ax:'middle',name:'Cheneuil',after:5,
 desc:'Nine hundred people, one bridge, two mills and a church with a crooked spire. Market on Thursdays since 1391, and it did not stop for the queen, because it did not know.',
 memo:'“Move, love, you’re in the way of the fire.” — and she had never in her life been so glad to be in the way.',
 who:'Catherine · Julien · Mère Toussaint · a fiddle', chs:'V'},
{id:'milestone',x:468,y:238,ax:'middle',name:'The Milestone',after:5,
 desc:'Where the road bends up out of the river meadow. A good stone, cut deep, old. It gives the distance in leagues and the direction with a little pointing hand. Where the name of the village should be, the stone has been chiselled out — square and deliberate, by somebody with a mason’s tools and an afternoon.',
 memo:'“Bad road, that one. Nothing up there now,” he said, and did not look at it, and did not look at it so carefully and for so long that she turned round on the barrels and watched it until it went out of sight.',
 who:'Julien', chs:'V'},
{id:'vaux',x:522,y:152,ax:'middle',name:'Vaux-sur-Aine',after:6,
 desc:'A mill, a church, four hundred people. In the winter of 1731 somebody there counted the grain and wrote the number down. The parish register was burnt on the twelfth of March 1732 and the fire was blamed on the villagers. Forty-one people were taken out of the généralité of Aine by warrant, in carts, in the dark, at a cost itemised by the day.',
 memo:'A man is not dead when he stops breathing. He is dead when the last person stops saying him.',
 who:'the forty-one', chs:'VI, VII, IX, X'},
{id:'hoorn',x:544,y:62,ax:'end',name:'Hoorn, in the Republic',after:6,
 desc:'Van Hoorn &amp; Zoon, second house of the bulb trade since 1610. Ledger of Exports, anno 1733, folio 61. Forty-one lots to a private buyer at Rivenelle, paid in full, in coin, at the door — and in the margin, in a nervous clerk’s hand: <i>names supplied by the buyer.</i>',
 memo:'They keep everything. They are Dutch. They have the great-grandfather’s laundry accounts.',
 who:'Lisbet · a bookkeeper with beautiful copperplate', chs:'VI, IX, X'},
{id:'orangery',x:118,y:222,ax:'start',name:'The Glass House',after:8,
 desc:'The orangery, long and cold in the mornings, with condensation running down the inside of the panes. Somebody walked a child up and down it for one hour on the ninth of June 1740, at seven in the morning, because a child should not see it.',
 memo:'She bit me — here, I have it still.',
 who:'Odile · Catherine, aged eight', chs:'IX'},
{id:'ell',x:114,y:324,ax:'start',name:'The Ell',after:8,
 desc:'The forgotten tower at the end of the north corridors, four rooms deep in dust, where the palace keeps the things it cannot throw away and will not look at. Nine hundred and forty items were carried into it in the spring of 1782.',
 memo:'Item nine hundred and forty: one pot, red clay, chipped, of no value.',
 who:'an inventory clerk with no idea', chs:'X'}
];

/* ─── chronology ───────────────────────────────────────────────── */
const TIMELINE = [
{yr:'1610', t:'Van Hoorn &amp; Zoon', d:'Second house of the bulb trade opens at Hoorn, in the Republic. It will keep every piece of paper it ever touches.', after:6},
{yr:'1657', t:'From the forge to the throne', d:'The armourers Smith, of Lorraine, are ennobled. Three generations later the old families have still not finished being amused.', after:1},
{yr:'1729', t:'Marguerite of Cleves comes to France', d:'Aged twenty-one, foreign, German-speaking. Odile Vaneau comes with her, aged twenty-two, with no French.', after:3},
{yr:'Winter 1731–32', t:'The removals from the Aine', d:'Forty-one people are taken by warrant out of the villages of the Aine, between the fourth of December and the fourth of March, for having counted the grain in a year of famine and written the number down.', after:6},
{yr:'12 March 1732', t:'The register of Vaux is burnt', d:'Blamed, in the intendant’s own report, on the villagers.', after:6},
{yr:'12 April 1732', t:'Catherine Anne Smith is born', d:'Five weeks after the last cart leaves the Aine.', after:1},
{yr:'Summer 1732', t:'Marguerite finds out', d:'By means unknown. She says it out loud in the house exactly once. The physician comes the next morning to enquire after her nerves, and comes every morning for eight years.', after:9},
{yr:'1733', t:'Forty-one lots, paid in coin at the door', d:'Registered at Haarlem, entered at Leiden, copied to Paris, London and Vienna. Names supplied by the buyer. Dates supplied by the buyer.', after:6},
{yr:'Autumn 1733', t:'One bulb goes the other way', d:'To a laundress at Vaux who cannot be written to, visited, or helped — with her husband’s name on it and the number of his bed scratched into the clay.', after:9},
{yr:'9 June 1740', t:'The ninth of June', d:'A child is walked up and down the orangery for one hour, at seven in the morning, because the physician told the governess the hour the night before.', after:9},
{yr:'Autumn 1740', t:'Four letters in pencil', d:'A woman finds a letter under the last bed, reads it standing up in the rain, finishes the unfinished name, and puts it back in the ground.', after:9},
{yr:'1742', t:'Séraphine sits still for ten minutes', d:'Copying a dealer’s list at twenty-six, she comes to <i>Tulipa, Perrine Bassot, veuve.</i>', after:9},
{yr:'1744', t:'Marie Sevin dies at Chartres', d:'Her son takes the pot and carries it round the fairs of France for six years in a basket packed with straw.', after:9},
{yr:'1746', t:'A queen at fourteen', d:'On her father’s death. The Duc de Rouvray governs in her name.', after:1},
{yr:'March 1750', t:'Eleven sous and a wool coat', d:'A young player buys the engagement of the twelfth of April from old Lansquenet, who has never in his life had better money. Nobody checks. Nobody has ever checked.', after:9},
{yr:'12 April 1750', t:'The birthday', d:'The regency ends at midnight. Two hundred and six entries in the gift ledger. Two hundred and seven gifts.', after:1},
{yr:'23 June 1750', t:'The masked night', d:'An ambush at the unmasking, refused by getting there first and saying yes to something else, louder. And, at three in the morning, a key.', after:4},
{yr:'August 1750', t:'Two days that are written down nowhere', d:'A market, a barn, a fiddle, and a milestone with the name chiselled off.', after:5},
{yr:'September 1750', t:'Under bed forty-one', d:'The lifting of the bulbs. Oilcloth, waxed, folded three times.', after:6},
{yr:'November 1750', t:'One hour', d:'A dossier at eight. A confession at nine. It is the same sentence and it is not the same sentence.', after:7},
{yr:'8–9 January 1751', t:'Fire-blight', d:'Eleven men, two days, and lime spread evenly with a flat shovel. The smoke smells of nothing at all.', after:8},
{yr:'March 1751', t:'Names from Holland, numbers from France', d:'Four people put four useless things on one table.', after:9},
{yr:'12 April 1751', t:'Eleven minutes', d:'Forty-one names read into the record of the court of France, in the rain, on her nineteenth birthday.', after:10},
{yr:'1751', t:'Number 603', d:'<i>‘Catherine Anne’ — white, single, late. The introducer will accept no premium, and desires that it be offered at one sou the bulb, any quantity, in perpetuity.</i>', after:10},
{yr:'1753', t:'The garden is replanted', d:'And the forty plates are printed at Leiden in an edition of four hundred, with the names lettered beneath and no text at all.', after:10},
{yr:'1751–1782', t:'Thirty-one Aprils', d:'A plain red clay pot appears somewhere at Rivenelle. No card, no ribbon, no name. Nobody ever sees who brings it.', after:10},
{yr:'Spring 1782', t:'Item nine hundred and forty', d:'One pot, red clay, chipped, of no value.', after:10}
];

/* ─── archive ──────────────────────────────────────────────────── */
const ARCHIVE = [
{id:'ledger', kind:'Register', title:'The Gift Ledger', meta:'Rivenelle, 12–13 April 1750, in the hand of a clerk who had been at it since Monday', after:1,
 body:`Two hundred and six entries, each copied from its card, each initialled, each ruled off.

Enamel from Saxony. A clock from the Republic of Genoa with a moon on it that does not work. A sword she will never draw, from a duke she will never like. A book of hours. A mare. A mechanical bird. A chest of Turkish coffee. A portrait of Her Majesty in which she appears to be forty.

The chamberlain checked the ledger at four in the morning, because he always checked the ledger.

Two hundred and six entries.
Two hundred and seven gifts.

He counted the table twice, and then — being sixty-three years old, and it being four in the morning — decided that he had miscounted, and went to bed.`,
 sign:'— B. Nourrit, chamberlain'},

{id:'marguerite', kind:'Letter', title:'To whoever has this ground after me', meta:'Found September 1750 under bed forty-one, wrapped in oilcloth, waxed, folded three times', after:6,
 body:`I do not know your name. I know that mine will be gone by then; that is how it is done here, they do not kill you, they simply stop writing you down.

The flowers in this garden are not flowers.

There were forty-one of them and they were taken out of the villages of the Aine in the winter of ’31 and ’32, in the dark, in carts, for the crime of having counted the grain and written the number down. I have the number. It does not matter. What matters is that the register of the parish of Vaux was burnt on the twelfth of March and the names went with it, and a man is not dead when he stops breathing, he is dead when the last person stops saying him.

I could not stop it. I want you to understand that I tried, in this house, out loud, once — and the physician came the next morning to enquire after my nerves, and has enquired every morning since.

So I did the only thing they cannot burn.

I bought them names.

A tulip that is named is entered in a book at Haarlem, and copied into a book at Leiden, and into a book at Paris and a book at London and a catalogue at Vienna; and it is sold, and sold again, and every gardener in Europe writes it on a wooden label in his own hand and sets it in his own ground. There is no censor for a flower. There is no bonfire big enough. In a hundred years there will be men in England saying these names over a border and thinking they are saying nothing at all.

Read the map from the door to the wall. The order is the order they were taken.

Say them in April. Out loud. Every year. It is not a game, and I am sorry to have taught it to you as one, but you were six and I had no other way to make it stick.

The last bed is the one they will want, because he is the one who is still worth a hanging to somebody living. He carried the register out of the church under his coat and they took him for it on the fourth of March and I have never found where. His name was Anthelme S`,
 sign:'— and there the ink stops. Beneath it, in pencil, pressed hard, eight years later: evin'},

{id:'schedule', kind:'Commercial', title:'Folio 61, and the appended schedule', meta:'Van Hoorn &amp; Zoon, Hoorn — Ledger of Exports, anno 1733', after:6,
 body:`Item — to a private buyer at Rivenelle in France, by way of Rouen: forty-one lots, being one hundred and twenty-three bulbs, sorts as per the appended schedule, registered this season at Haarlem and entered at Leiden. Paid in full, in coin, at the door.

In the margin, smaller, in a different hand — some clerk noting an irregularity for his own protection:

“Names supplied by the buyer.”

And on the schedule itself, because the trade requires a date of introduction for every new sort, and because Dutch bulb men are pedants:

4 December 1731. 4 December 1731. 11 December 1731. 11 December 1731. 11 December 1731. 11 December 1731. 14 December 1731…

Forty-one names. Forty-one dates. Filed in a box in Hoorn for eighteen years, next to the laundry accounts.`,
 sign:'— van Hoorn & Zoon, Hoorn'},

{id:'returns', kind:'Fiscal', title:'Quarterly returns of the généralité of Aine', meta:'Winter 1731–1732 — preserved, unread, impeccably, because someone might one day want to check an expense', after:9,
 body:`Extraordinary charges: for the removal of persons from the said généralité, by warrant, this quarter — carts, escort, and subsistence — the number of forty-one.

No names. There are never any names. A number and a cost, itemised by the day, across three quarters.

The one thing that never burns in France is money.`,
 sign:'A. de Rouvray, Intendant'},

{id:'dossier', kind:'Confidential', title:'Eleven sheets, sewn, tied with grey ribbon', meta:'Laid on a table on the evening of 28 November 1750, and not opened for four minutes', after:7,
 body:`The person calling himself PERSONNE, engaged at Rivenelle 12 April last, is one JULIEN SEVIN, aged twenty-three, born at Vaux-sur-Aine.

His mother, Marie Sevin, formerly of Vaux, died at Chartres in 1744, laundress. The son travelled with the company of one LANSQUENET, players, of the fairs of Saint-Germain and Saint-Laurent.

His father, ANTHELME SEVIN, clerk of the mill at Vaux, taken up under warrant on the fourth of March 1732 and not thereafter recorded.

Everything in it was true. He would have been a fool to hand a queen a forgery she was capable of testing, and he was never a fool.`,
 sign:'— for the hand of Her Majesty alone'},

{id:'note', kind:'Note', title:'Left under a stone on the still-room table', meta:'6 January 1751, in the night, two days before the men came with spades', after:8,
 body:`I am sorry. I have forty. Ask me in the spring what for.`,
 sign:'— S. L.'},

{id:'haarlem', kind:'Register', title:'Number 603', meta:'Registration book of the tulip growers at Haarlem, anno 1751', after:10,
 body:`603. ‘Catherine Anne’ — white, single, late.

Introduced by J. Sevin, of France.

Remarks: the introducer will accept no premium, and desires that it be offered at one sou the bulb, any quantity, in perpetuity.

— which is not how the tulip trade works, and was refused, and argued about for a season, and then happened anyway, because the man simply kept giving them away.`,
 sign:'— Haarlem, in the Republic'},

{id:'inventory', kind:'Inventory', title:'Item nine hundred and forty', meta:'The rooms of the late Queen, Rivenelle, taken the week after her death, spring 1782', after:10,
 body:`Nine hundred and forty items.

Item 938. One brush, tortoiseshell back, worn.
Item 939. One book, small, brown, manuscript, of no interest.

Item 940. One pot, red clay, chipped, of no value.`,
 sign:'— appraised and signed, in triplicate'},

{id:'wolf', kind:'Hidden', title:'The wolf’s head', meta:'23 June 1750, half past midnight, during the fourth figure', after:99, secret:true,
 body:`She danced with a man in a wolf’s head who moved like Personne and did not speak, because it was Saint John’s Eve and nobody spoke.

And she said to him — laughing, giddy, insulated by black silk:

“I would have said no even without the trick. I would have said no if he had been beautiful. I would have said no because I have exactly one hour a day in which anybody talks to me as though I am a person, and I am not selling it to Savoy.”

The wolf’s head bowed, and withdrew at the change of the figure.

Five months later a man who had been reading her for eleven months knew precisely, to the hour, where to cut.

She never worked out who the wolf was. Nobody ever told her.`,
 sign:'— A. de R.'},

{id:'coat', kind:'Hidden', title:'A receipt of sorts', meta:'March 1750, at the fair of Saint-Germain, witnessed by nobody', after:99, secret:true,
 body:`Give me the twelfth of April and you can have anything I own.

He had nothing. He had a coat.

For eleven months the entire question of who had been permitted to walk into the house of the Queen of France rested on a wool coat and the fact that nobody at Rivenelle can tell one fairground player from another.

“It was a very good coat,” said Lansquenet, with dignity. “Wool.”`,
 sign:'— L. Lansquenet, players'}
];

/* ─── tulips in the bed: hover / tap fragments ─────────────────── */
const GARDEN_MEMOS = [
 ['Bed 4 — Bassot the younger','The little striped one. It never grows tall. It was her favourite when she was small, and she chose it because it was the smallest, and it was nine years old.'],
 ['Bed 12 — Delcour','The purple. The priest’s. He kept the register of deaths, which is the only reason anyone knows how many there were.'],
 ['Bed 16 — Vasse','Sergeant of the watch. He was given an order on the ninth of January and he did not carry it out, and so he is in this row.'],
 ['Bed 22 — Cordier','Three Cordiers, all in a line, and they always come up together. The last of them was six.'],
 ['Bed 27 — Lestang','She is called Catherine. Her mother thought that was very funny, and made her curtsey to it, and she still does.'],
 ['Bed 38 — Renaudot','The small one. The boy one. It never opens all the way. Aged eleven.'],
 ['Bed 40 — Vinet','The tall red at the end. She is always late.'],
 ['Bed 41 — Sevin','Against the wall, in the corner, in the shade after four o’clock. White, single, late. Nobody picks it. Nobody has ever picked it.']
];
</script>
