export interface DrillSwipe {
  id: string;
  title: string;
  swipe: string;
  why: string;
  mechanism: string;
  prompt: string;
  example: string;
}

export interface Technique {
  id: string;
  label: string;
  icon: string;
  description: string;
  swipes: DrillSwipe[];
}

export const TECHNIQUES: Technique[] = [
  {
    id: "price-anchoring",
    label: "Price Anchoring",
    icon: "\u{1F4B0}",
    description: "Make the price feel inevitable, not transactional.",
    swipes: [
      {
        id: "repeat-escalate",
        title: "The Repeat-and-Escalate",
        swipe: "Under $40 for an Estate of the Gods wine like this? Ah, TUSCANY, glorious Tuscany shines bright again!",
        why: "The rhetorical question recaps the price, then the emotional release validates the purchase before the reader can second-guess it. The wine name embedded as a superlative (\"Estate of the Gods\") makes the price feel absurd \u2014 in the best way. By the time \"Ah, TUSCANY\" lands, the reader feels like they discovered the deal, not that they were sold to.",
        mechanism: "Rhetorical question + price recap \u2192 emotional release \u2192 superlative label",
        prompt: "Take this structure \u2014 rhetorical question + price + emotional release \u2014 and write it for a Wine Spies deal. The emotional release should reference the wine\u2019s region or producer prestige. Under 2 sentences. Try it before looking at the example below.",
        example: "Under $28 for a Sonoma Coast Pinot from this producer? My friend, the coast just got a lot more interesting.",
      },
      {
        id: "savings-math",
        title: "The Savings Math Drop",
        swipe: "I had my mathematically inclined colleague do the math\u2026we\u2019re talking about $115 in savings, good people!",
        why: "The self-deprecating attribution (\"my mathematically inclined colleague\") makes the savings feel independently verified without sounding like ad copy. It also inserts a human moment mid-pitch \u2014 you can picture the guy at the next desk. \"Good people\" at the end is an intimacy marker that softens the sell. The savings number is the only hard fact in the sentence; everything else is warmth.",
        mechanism: "Outsource the math \u2192 state the savings \u2192 address the reader warmly",
        prompt: "Write a savings callout for a Wine Spies deal at your current price vs. retail. Include a winking attribution of the math to someone or something other than yourself. Under 2 sentences. No \"we\u2019re saving you X\" language \u2014 make it feel discovered, not announced.",
        example: "My accountant nearly fell off his chair \u2014 that\u2019s $80 back in your pocket, operative.",
      },
      {
        id: "stacked-discount",
        title: "The Stacked Reveal",
        swipe: "UNDER $30!! Better still \u2014 you can add on an additional 25% OFF with the promo code below!",
        why: "Two-stage reveal. The first price lands and creates a moment of relief or delight. \"Better still\" signals a second gift is coming \u2014 it\u2019s a classic copywriter\u2019s pivot that forces the reader to keep reading. The double exclamation after the first price creates a breath of disbelief before the escalation. Pure deal momentum that builds.",
        mechanism: "Land price #1 \u2192 pivot phrase (\"Better still\") \u2192 reveal second incentive",
        prompt: "Write a two-stage price reveal for a Wine Spies offer. First land the base price with disbelief. Then introduce a secondary win (promo, free shipping, bundle). Use \"Better still\" or a structural equivalent as the hinge. Keep each stage to one sentence.",
        example: "Already under $30. Better still \u2014 add OPERATIVE at checkout and that becomes under $22.",
      },
    ],
  },
  {
    id: "urgency-scarcity",
    label: "Urgency & Scarcity",
    icon: "\u23F1",
    description: "Make inaction feel like the riskier choice.",
    swipes: [
      {
        id: "ambient-scarcity",
        title: "The Ambient Scarcity Riff",
        swipe: "Only 935 cases made\u2026EVER \u2014 and we pulled a rabbit to snag as much as humanly possible to share with y\u2019all. Barely enough\u2026even for a slow, pre-St. Paddy\u2019s Sunday \u2014 so do yourself a solid, take the requisite 60 seconds it takes to fly to your cart, and LOAD UP!",
        why: "Production number \u2192 effort signal (\"pulled a rabbit\") \u2192 scarcity made personal (\"barely enough\u2026even for\") \u2192 specific time frame \u2192 micro-CTA with a time estimate that minimizes friction. The \"60 seconds\" is brilliant \u2014 it makes acting feel effortless, almost lazy not to. \"LOAD UP\" is pure velocity. Notice how many pieces of information land without it feeling like a list.",
        mechanism: "Production figure \u2192 effort signal \u2192 personal scarcity \u2192 friction-minimizing CTA",
        prompt: "Write a scarcity close for a Wine Spies wine. Include: the production number or allocation size, a signal showing how hard it was to get, a moment where the scarcity feels personal, and a CTA with a time estimate that removes friction. Max 3 sentences.",
        example: "212 cases made \u2014 and we fought for every bottle. Barely enough for a Tuesday, let alone the weekend. Takes about 45 seconds to add to cart, operative. Clock\u2019s running.",
      },
      {
        id: "signature-close",
        title: "The Signature Close",
        swipe: "While it lasts!",
        why: "Brutally simple. Repeated at the end of nearly every LBW email, which trains readers to associate those three words with action. Functions like a Pavlovian trigger by email 10. It works because it\u2019s genuinely true \u2014 the wine will run out \u2014 and because it trusts the reader to connect the dots without spelling out consequences. Restraint here is the technique.",
        mechanism: "Short, true, repeated. The repetition does the work over time.",
        prompt: "Write 3 closing urgency lines under 8 words each. One should address the reader directly (operative, agent, etc.). One should be purely tonal \u2014 no explicit urgency words like \"hurry\" or \"now.\" One should embed a product reference. All three should feel earned, not panicked.",
        example: "V1: Clock\u2019s running, operative. V2: This one won\u2019t wait. V3: Last call on the Pinot.",
      },
    ],
  },
  {
    id: "flavor-copy",
    label: "Flavor & Sensory Copy",
    icon: "\u{1F444}",
    description: "Make them taste it before they buy it.",
    swipes: [
      {
        id: "sensation-avalanche",
        title: "The Sensation Avalanche",
        swipe: "The explosive sensations of summer strawberries, and white cherries, with flinty, river rock intensity, and the zippy, zesty sensation of freshly peeled oranges, and lingering, beguiling aromas of star jasmine, and fresh-cut grass, with this watermelon agua fresca finish\u2026YES!!!",
        why: "The comma-and structure creates additive, breathless momentum \u2014 you can\u2019t pause to evaluate, you just keep tasting. Each element is concrete and familiar (no \"hints of minerality\"). No wine jargon. \"YES!!!\" at the end is the release valve \u2014 the writer says what the reader is feeling so they don\u2019t have to. Notice how many elements there are. The length reads as generosity, not excess.",
        mechanism: "Comma-and list of concrete sensations \u2192 escalate in richness \u2192 one-word emotional release",
        prompt: "Write a sensation avalanche for a wine you know well. 5\u20138 elements, comma-and structure. Every element must be a concrete image or sensation \u2014 no abstract wine terms (no minerality, no terroir, no structure). Close with a one-word or one-syllable release. Read it aloud; it should feel breathless.",
        example: "Fresh-cracked black cherry, dried rose petals, and dark cocoa dusting, with this wild herb thing that reminds you of the Sonoma hills, espresso-rubbed plum, a whisper of cedar, and a finish like the last sip of something you didn\u2019t know you\u2019d miss\u2026DAMN.",
      },
      {
        id: "physical-metaphor",
        title: "The Physical Metaphor Close",
        swipe: "This baby is pumping like 70\u2019s-era Schwarzenegger, and finishing stronger than a \"last call\" shot of Fernet.",
        why: "Two pop culture physical comparisons translate abstract wine structure into something visceral and visual. \"Pumping\" applies a bodybuilding metaphor to texture \u2014 you feel the density. The Fernet close is insider wine knowledge, creating an in-group moment. Both are funny without undercutting the wine\u2019s quality. The humor makes the quality claim more believable, not less.",
        mechanism: "Body/texture metaphor from pop culture \u2192 finish metaphor that conveys intensity \u2192 implicit humor",
        prompt: "Write a 2-part physical metaphor close for a wine\u2019s structure and finish. First: something from pop culture, sports, or physical performance that conveys texture or body. Second: something that conveys finish length or intensity. Under 2 sentences. Surprise yourself \u2014 avoid the obvious wine metaphors.",
        example: "Hits like a Napa cab bench-pressing its own body weight, and the finish lingers like that one song you can\u2019t stop humming three days after the concert.",
      },
      {
        id: "texture-first",
        title: "The Texture-First Note",
        swipe: "It\u2019s inky, and unbelievably rich, with MOUNTAINS of structure, and this juicy, decadent core of black and red bramble berries, then roasted plum tarts, and cherries jubilee, and heady kirsch, black pepper, strawberry compote, and a dusting of mocha powder.",
        why: "Leads with mouthfeel before fruit \u2014 the opposite of how most tasting notes are written. This immediately tells you what to expect before you taste, setting up the fruit list as confirmation rather than revelation. \"MOUNTAINS of structure\" is the perfect all-caps moment: structure is abstract, the caps make it massive and concrete. The list is long, but it reads as abundance.",
        mechanism: "Mouthfeel first \u2192 all-caps structural claim \u2192 escalating fruit/flavor list, richest last",
        prompt: "Write a texture-first tasting note. Open with 2 mouthfeel descriptors. Follow with one all-caps structural claim. Then a list of at least 5 flavor elements that escalates in richness from first to last. No wine jargon \u2014 write it so a smart non-wine-person would immediately want a glass.",
        example: "Silky and almost weightless, with ACRES of dark fruit to explore \u2014 starting with bright Bing cherry, moving through dried cranberry and rose hip, landing on dark chocolate ganache and a long, slow espresso fade.",
      },
    ],
  },
  {
    id: "credentials",
    label: "Credential & Authority Drops",
    icon: "\u{1F3C6}",
    description: "Turn scores and winemaker names into story, not stats.",
    swipes: [
      {
        id: "resume-riff",
        title: "The R\u00e9sum\u00e9 Riff",
        swipe: "He\u2019s already had his hands in nearly a dozen 100-point wines, working alongside Russell Bevan first, and now Jesse Katz. He\u2019s also gone global \u2014 working for New Zealand\u2019s cultiest of cult producers, Craggy Range, as well as another 100 point icon of global winemaking\u2026Paul Hobbs at his premier winery, Vi\u00f1a Cobos.",
        why: "Credentials delivered as a career story, not a list. The em-dash acts as a storytelling hinge (\"He\u2019s also gone global \u2014\"). Name-dropping is specific enough to signal real expertise to wine people, accessible enough not to alienate newcomers. \"Cultiest of cult producers\" is self-aware \u2014 it signals the writer knows this sounds like hyperbole and leans into it. The story makes the winemaker a character.",
        mechanism: "Open with track record \u2192 em-dash pivot \u2192 global/unexpected connection \u2192 superlative that\u2019s slightly self-aware",
        prompt: "Write a winemaker credential riff for a producer you\u2019re selling. Include at least 2 notable connections or previous positions. Deliver it as a mini career arc \u2014 not a bio. One element should include a superlative that acknowledges its own absurdity. Under 4 sentences. Make them a character, not a credential.",
        example: "She spent a decade at Kosta Browne before most people knew the name \u2014 then left to build something nobody saw coming. Winemaker at three Pinot projects simultaneously, because apparently sleep is optional when you have this kind of palate.",
      },
      {
        id: "score-bombshell",
        title: "The Score-as-Bombshell",
        swipe: "Ros\u00e9 almost NEVER pulls down scores like that \u2014 but this is RED CAR!",
        why: "Context before the score makes the score feel extraordinary. \"Almost NEVER\" sets the ceiling \u2014 the reader now knows this is rare before you tell them what it is. The em-dash pivot to the producer name creates a reveal moment, like pulling back a curtain. The producer name lands as the punchline, not the setup. The reader feels like they\u2019re in on something rare.",
        mechanism: "Category context (why this score is rare) \u2192 em-dash pivot \u2192 producer name as reveal",
        prompt: "Write a score reveal for a wine where the score is unusual for its category, price point, or region. Set up why that score is remarkable before you reveal it. Use an em-dash pivot. End with the producer or wine name as the punch, not the setup.",
        example: "Pinot at this price doesn\u2019t score like this \u2014 but then again, this isn\u2019t Pinot at this price. This is Kosta Browne\u2019s house, and they don\u2019t do ordinary.",
      },
    ],
  },
  {
    id: "lead-hooks",
    label: "Lead Hooks & Openers",
    icon: "\u{1F3A3}",
    description: "Never open with the wine. Open with energy.",
    swipes: [
      {
        id: "holiday-hook",
        title: "The Calendar / Holiday Hook",
        swipe: "Break out the shamrocks! Banish the snakes from the land! St. Paddy\u2019s Day is here, and we\u2019re kicking off our day of jigs with this KILLER Alexander Valley Cabernet Sauvignon for UNDER $30!!",
        why: "Two imperative sentences create immediate kinetic energy before any wine appears. The holiday frame is familiar but the payoff \u2014 a Cabernet, not a green beer \u2014 creates comedic contrast that earns a smile. Price lands in the same sentence as the wine\u2019s first appearance, so by the time the reader has engaged emotionally, the value has already registered. The juxtaposition is the hook.",
        mechanism: "2 short imperatives evoking the occasion \u2192 wine + price land together in the same pivot sentence",
        prompt: "Write a calendar or holiday lead for a Wine Spies offer. Open with 1\u20132 short imperative sentences that evoke the occasion. Pivot to the wine and price in the same sentence \u2014 they should arrive together. The contrast between the occasion and the wine should feel slightly unexpected.",
        example: "Close the laptop. The weekend starts now \u2014 and it starts with a 94-point Sonoma Pinot for less than you\u2019d spend on dinner.",
      },
      {
        id: "score-first",
        title: "The Score-First Hook",
        swipe: "94 POINTS! Spring is here \u2014 and summer isn\u2019t far behind...and trust me when I say you are gonna want some of this EPIC Sonoma Coast Ros\u00e9!",
        why: "Score as the first word \u2014 no preamble, no warm-up. Then a seasonal frame that creates forward momentum (\"summer isn\u2019t far behind\" is better than \"it\u2019s spring\" because it creates anticipation, not presence). \"Trust me when I say\" is the narrator inserting themselves as guarantor \u2014 it shifts the relationship from brand-to-customer to friend-to-friend. Three moves in one sentence.",
        mechanism: "Score first \u2192 seasonal forward momentum \u2192 trust signal that personalizes the pitch",
        prompt: "Write a score-first hook for a Wine Spies wine. Score as the first word. Follow with a frame that creates anticipation rather than describing the present. Close the opening with a trust signal \u2014 something that positions the voice as a friend vouching for this, not a brand selling it. Under 2 sentences.",
        example: "96 POINTS. Summer\u2019s three months away \u2014 and you\u2019re going to want a case of this in your cellar before everyone else figures out it exists.",
      },
    ],
  },
  {
    id: "subject-lines",
    label: "Subject Lines",
    icon: "\u{1F4EC}",
    description: "Lead with score or price. Never tease. Always reveal.",
    swipes: [
      {
        id: "score-category",
        title: "Score + Category Frame",
        swipe: "96 Point Italian Cabernet Blend!\n95 Point Sonoma Cab!\n97 Points! Transcendent $60 Blanc de Blancs!",
        why: "Score first, category second, price optional. No mystery, no clickbait. LBW sells to a list that wants to know immediately if this is for them. The exclamation point isn\u2019t enthusiasm \u2014 it\u2019s a voice signature. When used consistently it becomes a brand marker. The category frame (\"Italian Cabernet Blend\") does more work than the producer name for cold audiences.",
        mechanism: "Score \u2192 category descriptor \u2192 optional price anchor. Never the producer name first.",
        prompt: "Write 3 subject line variations for the same wine: one score-first, one price-first, one quality-descriptor + price. Each under 8 words. No producer name first. Exclamation as voice, not decoration. Read them in your inbox preview \u2014 does each one tell you immediately if it\u2019s for you?",
        example: "95 Point Napa Cab, Under $40! / Cult Sonoma Pinot \u2014 $28 Today / Best Price on the Planet: 95-Point Cab",
      },
    ],
  },
  {
    id: "producer-storytelling",
    label: "Producer Storytelling",
    icon: "\u{1F347}",
    description: "Every producer has one surprising fact. Find it. Lead with it.",
    swipes: [
      {
        id: "personality-bio",
        title: "The Personality-Led Bio",
        swipe: "Roberto Cavalli, who brought sand-blasted jeans and exotic animal prints to the forefront of 80\u2019s fashion (the shame, the shame!), ran this estate for years with his son, Tomasso.",
        why: "The parenthetical \"(the shame, the shame!)\" is the whole technique in miniature. It acknowledges a shared cultural memory with a wink, making the reader feel like they\u2019re in on a joke with the writer. It makes Roberto Cavalli a character, not a credential. The fashion tangent is irrelevant to wine quality \u2014 and that irrelevance is exactly what makes it memorable. The wine arrives in the next sentence as the real story.",
        mechanism: "Surprising non-wine fact \u2192 parenthetical that winks at the absurdity \u2192 wine as the actual reveal",
        prompt: "Write a 2-sentence producer bio for a wine you\u2019re selling. Sentence 1: one surprising, non-wine fact about the producer\u2019s background or identity. Include a parenthetical that acknowledges the delight or absurdity of that fact. Sentence 2: the wine or estate, as if arriving from that tangent. Make them a character.",
        example: "The winemaker spent seven years as a jazz pianist in New Orleans before anyone handed her a cluster of Pinot (the music industry\u2019s loss, frankly). Today she farms 12 acres in the Sonoma Coast hills with the same obsessive ear for nuance she used to apply to chord changes.",
      },
    ],
  },
];

export const DRILL_STEPS = ["Swipe", "Why It Works", "Your Turn", "Example"] as const;
