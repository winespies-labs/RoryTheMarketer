import { useState, useEffect, useRef } from "react";

const TECHNIQUES = [
  {
    id: "price-anchoring",
    label: "Price Anchoring",
    icon: "💰",
    description: "Make the price feel inevitable, not transactional.",
    swipes: [
      {
        id: "repeat-escalate",
        title: "The Repeat-and-Escalate",
        swipe: `Under $40 for an Estate of the Gods wine like this? Ah, TUSCANY, glorious Tuscany shines bright again!`,
        why: `The rhetorical question recaps the price, then the emotional release validates the purchase before the reader can second-guess it. The wine name embedded as a superlative ("Estate of the Gods") makes the price feel absurd — in the best way. By the time "Ah, TUSCANY" lands, the reader feels like they discovered the deal, not that they were sold to.`,
        mechanism: "Rhetorical question + price recap → emotional release → superlative label",
        prompt: `Take this structure — rhetorical question + price + emotional release — and write it for a Wine Spies deal. The emotional release should reference the wine's region or producer prestige. Under 2 sentences. Try it before looking at the example below.`,
        example: `Under $28 for a Sonoma Coast Pinot from this producer? My friend, the coast just got a lot more interesting.`,
      },
      {
        id: "savings-math",
        title: "The Savings Math Drop",
        swipe: `I had my mathematically inclined colleague do the math…we're talking about $115 in savings, good people!`,
        why: `The self-deprecating attribution ("my mathematically inclined colleague") makes the savings feel independently verified without sounding like ad copy. It also inserts a human moment mid-pitch — you can picture the guy at the next desk. "Good people" at the end is an intimacy marker that softens the sell. The savings number is the only hard fact in the sentence; everything else is warmth.`,
        mechanism: "Outsource the math → state the savings → address the reader warmly",
        prompt: `Write a savings callout for a Wine Spies deal at your current price vs. retail. Include a winking attribution of the math to someone or something other than yourself. Under 2 sentences. No "we're saving you X" language — make it feel discovered, not announced.`,
        example: `My accountant nearly fell off his chair — that's $80 back in your pocket, operative.`,
      },
      {
        id: "stacked-discount",
        title: "The Stacked Reveal",
        swipe: `UNDER $30!! Better still — you can add on an additional 25% OFF with the promo code below!`,
        why: `Two-stage reveal. The first price lands and creates a moment of relief or delight. "Better still" signals a second gift is coming — it's a classic copywriter's pivot that forces the reader to keep reading. The double exclamation after the first price creates a breath of disbelief before the escalation. Pure deal momentum that builds.`,
        mechanism: "Land price #1 → pivot phrase ("Better still") → reveal second incentive",
        prompt: `Write a two-stage price reveal for a Wine Spies offer. First land the base price with disbelief. Then introduce a secondary win (promo, free shipping, bundle). Use "Better still" or a structural equivalent as the hinge. Keep each stage to one sentence.`,
        example: `Already under $30. Better still — add OPERATIVE at checkout and that becomes under $22.`,
      },
    ],
  },
  {
    id: "urgency-scarcity",
    label: "Urgency & Scarcity",
    icon: "⏱",
    description: "Make inaction feel like the riskier choice.",
    swipes: [
      {
        id: "ambient-scarcity",
        title: "The Ambient Scarcity Riff",
        swipe: `Only 935 cases made…EVER — and we pulled a rabbit to snag as much as humanly possible to share with y'all. Barely enough…even for a slow, pre-St. Paddy's Sunday — so do yourself a solid, take the requisite 60 seconds it takes to fly to your cart, and LOAD UP!`,
        why: `Production number → effort signal ("pulled a rabbit") → scarcity made personal ("barely enough…even for") → specific time frame → micro-CTA with a time estimate that minimizes friction. The "60 seconds" is brilliant — it makes acting feel effortless, almost lazy not to. "LOAD UP" is pure velocity. Notice how many pieces of information land without it feeling like a list.`,
        mechanism: "Production figure → effort signal → personal scarcity → friction-minimizing CTA",
        prompt: `Write a scarcity close for a Wine Spies wine. Include: the production number or allocation size, a signal showing how hard it was to get, a moment where the scarcity feels personal, and a CTA with a time estimate that removes friction. Max 3 sentences.`,
        example: `212 cases made — and we fought for every bottle. Barely enough for a Tuesday, let alone the weekend. Takes about 45 seconds to add to cart, operative. Clock's running.`,
      },
      {
        id: "signature-close",
        title: "The Signature Close",
        swipe: `While it lasts!`,
        why: `Brutally simple. Repeated at the end of nearly every LBW email, which trains readers to associate those three words with action. Functions like a Pavlovian trigger by email 10. It works because it's genuinely true — the wine will run out — and because it trusts the reader to connect the dots without spelling out consequences. Restraint here is the technique.`,
        mechanism: "Short, true, repeated. The repetition does the work over time.",
        prompt: `Write 3 closing urgency lines under 8 words each. One should address the reader directly (operative, agent, etc.). One should be purely tonal — no explicit urgency words like "hurry" or "now." One should embed a product reference. All three should feel earned, not panicked.`,
        example: `V1: Clock's running, operative. V2: This one won't wait. V3: Last call on the Pinot.`,
      },
    ],
  },
  {
    id: "flavor-copy",
    label: "Flavor & Sensory Copy",
    icon: "👄",
    description: "Make them taste it before they buy it.",
    swipes: [
      {
        id: "sensation-avalanche",
        title: "The Sensation Avalanche",
        swipe: `The explosive sensations of summer strawberries, and white cherries, with flinty, river rock intensity, and the zippy, zesty sensation of freshly peeled oranges, and lingering, beguiling aromas of star jasmine, and fresh-cut grass, with this watermelon agua fresca finish…YES!!!`,
        why: `The comma-and structure creates additive, breathless momentum — you can't pause to evaluate, you just keep tasting. Each element is concrete and familiar (no "hints of minerality"). No wine jargon. "YES!!!" at the end is the release valve — the writer says what the reader is feeling so they don't have to. Notice how many elements there are. The length reads as generosity, not excess.`,
        mechanism: "Comma-and list of concrete sensations → escalate in richness → one-word emotional release",
        prompt: `Write a sensation avalanche for a wine you know well. 5–8 elements, comma-and structure. Every element must be a concrete image or sensation — no abstract wine terms (no minerality, no terroir, no structure). Close with a one-word or one-syllable release. Read it aloud; it should feel breathless.`,
        example: `Fresh-cracked black cherry, dried rose petals, and dark cocoa dusting, with this wild herb thing that reminds you of the Sonoma hills, espresso-rubbed plum, a whisper of cedar, and a finish like the last sip of something you didn't know you'd miss…DAMN.`,
      },
      {
        id: "physical-metaphor",
        title: "The Physical Metaphor Close",
        swipe: `This baby is pumping like 70's-era Schwarzenegger, and finishing stronger than a "last call" shot of Fernet.`,
        why: `Two pop culture physical comparisons translate abstract wine structure into something visceral and visual. "Pumping" applies a bodybuilding metaphor to texture — you feel the density. The Fernet close is insider wine knowledge, creating an in-group moment. Both are funny without undercutting the wine's quality. The humor makes the quality claim more believable, not less.`,
        mechanism: "Body/texture metaphor from pop culture → finish metaphor that conveys intensity → implicit humor",
        prompt: `Write a 2-part physical metaphor close for a wine's structure and finish. First: something from pop culture, sports, or physical performance that conveys texture or body. Second: something that conveys finish length or intensity. Under 2 sentences. Surprise yourself — avoid the obvious wine metaphors.`,
        example: `Hits like a Napa cab bench-pressing its own body weight, and the finish lingers like that one song you can't stop humming three days after the concert.`,
      },
      {
        id: "texture-first",
        title: "The Texture-First Note",
        swipe: `It's inky, and unbelievably rich, with MOUNTAINS of structure, and this juicy, decadent core of black and red bramble berries, then roasted plum tarts, and cherries jubilee, and heady kirsch, black pepper, strawberry compote, and a dusting of mocha powder.`,
        why: `Leads with mouthfeel before fruit — the opposite of how most tasting notes are written. This immediately tells you what to expect before you taste, setting up the fruit list as confirmation rather than revelation. "MOUNTAINS of structure" is the perfect all-caps moment: structure is abstract, the caps make it massive and concrete. The list is long, but it reads as abundance.`,
        mechanism: "Mouthfeel first → all-caps structural claim → escalating fruit/flavor list, richest last",
        prompt: `Write a texture-first tasting note. Open with 2 mouthfeel descriptors. Follow with one all-caps structural claim. Then a list of at least 5 flavor elements that escalates in richness from first to last. No wine jargon — write it so a smart non-wine-person would immediately want a glass.`,
        example: `Silky and almost weightless, with ACRES of dark fruit to explore — starting with bright Bing cherry, moving through dried cranberry and rose hip, landing on dark chocolate ganache and a long, slow espresso fade.`,
      },
    ],
  },
  {
    id: "credentials",
    label: "Credential & Authority Drops",
    icon: "🏆",
    description: "Turn scores and winemaker names into story, not stats.",
    swipes: [
      {
        id: "resume-riff",
        title: "The Résumé Riff",
        swipe: `He's already had his hands in nearly a dozen 100-point wines, working alongside Russell Bevan first, and now Jesse Katz. He's also gone global — working for New Zealand's cultiest of cult producers, Craggy Range, as well as another 100 point icon of global winemaking…Paul Hobbs at his premier winery, Viña Cobos.`,
        why: `Credentials delivered as a career story, not a list. The em-dash acts as a storytelling hinge ("He's also gone global —"). Name-dropping is specific enough to signal real expertise to wine people, accessible enough not to alienate newcomers. "Cultiest of cult producers" is self-aware — it signals the writer knows this sounds like hyperbole and leans into it. The story makes the winemaker a character.`,
        mechanism: "Open with track record → em-dash pivot → global/unexpected connection → superlative that's slightly self-aware",
        prompt: `Write a winemaker credential riff for a producer you're selling. Include at least 2 notable connections or previous positions. Deliver it as a mini career arc — not a bio. One element should include a superlative that acknowledges its own absurdity. Under 4 sentences. Make them a character, not a credential.`,
        example: `She spent a decade at Kosta Browne before most people knew the name — then left to build something nobody saw coming. Winemaker at three Pinot projects simultaneously, because apparently sleep is optional when you have this kind of palate.`,
      },
      {
        id: "score-bombshell",
        title: "The Score-as-Bombshell",
        swipe: `Rosé almost NEVER pulls down scores like that — but this is RED CAR!`,
        why: `Context before the score makes the score feel extraordinary. "Almost NEVER" sets the ceiling — the reader now knows this is rare before you tell them what it is. The em-dash pivot to the producer name creates a reveal moment, like pulling back a curtain. The producer name lands as the punchline, not the setup. The reader feels like they're in on something rare.`,
        mechanism: "Category context (why this score is rare) → em-dash pivot → producer name as reveal",
        prompt: `Write a score reveal for a wine where the score is unusual for its category, price point, or region. Set up why that score is remarkable before you reveal it. Use an em-dash pivot. End with the producer or wine name as the punch, not the setup.`,
        example: `Pinot at this price doesn't score like this — but then again, this isn't Pinot at this price. This is Kosta Browne's house, and they don't do ordinary.`,
      },
    ],
  },
  {
    id: "lead-hooks",
    label: "Lead Hooks & Openers",
    icon: "🎣",
    description: "Never open with the wine. Open with energy.",
    swipes: [
      {
        id: "holiday-hook",
        title: "The Calendar / Holiday Hook",
        swipe: `Break out the shamrocks! Banish the snakes from the land! St. Paddy's Day is here, and we're kicking off our day of jigs with this KILLER Alexander Valley Cabernet Sauvignon for UNDER $30!!`,
        why: `Two imperative sentences create immediate kinetic energy before any wine appears. The holiday frame is familiar but the payoff — a Cabernet, not a green beer — creates comedic contrast that earns a smile. Price lands in the same sentence as the wine's first appearance, so by the time the reader has engaged emotionally, the value has already registered. The juxtaposition is the hook.`,
        mechanism: "2 short imperatives evoking the occasion → wine + price land together in the same pivot sentence",
        prompt: `Write a calendar or holiday lead for a Wine Spies offer. Open with 1–2 short imperative sentences that evoke the occasion. Pivot to the wine and price in the same sentence — they should arrive together. The contrast between the occasion and the wine should feel slightly unexpected.`,
        example: `Close the laptop. The weekend starts now — and it starts with a 94-point Sonoma Pinot for less than you'd spend on dinner.`,
      },
      {
        id: "score-first",
        title: "The Score-First Hook",
        swipe: `94 POINTS! Spring is here — and summer isn't far behind...and trust me when I say you are gonna want some of this EPIC Sonoma Coast Rosé!`,
        why: `Score as the first word — no preamble, no warm-up. Then a seasonal frame that creates forward momentum ("summer isn't far behind" is better than "it's spring" because it creates anticipation, not presence). "Trust me when I say" is the narrator inserting themselves as guarantor — it shifts the relationship from brand-to-customer to friend-to-friend. Three moves in one sentence.`,
        mechanism: "Score first → seasonal forward momentum → trust signal that personalizes the pitch",
        prompt: `Write a score-first hook for a Wine Spies wine. Score as the first word. Follow with a frame that creates anticipation rather than describing the present. Close the opening with a trust signal — something that positions the voice as a friend vouching for this, not a brand selling it. Under 2 sentences.`,
        example: `96 POINTS. Summer's three months away — and you're going to want a case of this in your cellar before everyone else figures out it exists.`,
      },
    ],
  },
  {
    id: "subject-lines",
    label: "Subject Lines",
    icon: "📬",
    description: "Lead with score or price. Never tease. Always reveal.",
    swipes: [
      {
        id: "score-category",
        title: "Score + Category Frame",
        swipe: `96 Point Italian Cabernet Blend!\n95 Point Sonoma Cab!\n97 Points! Transcendent $60 Blanc de Blancs!`,
        why: `Score first, category second, price optional. No mystery, no clickbait. LBW sells to a list that wants to know immediately if this is for them. The exclamation point isn't enthusiasm — it's a voice signature. When used consistently it becomes a brand marker. The category frame ("Italian Cabernet Blend") does more work than the producer name for cold audiences.`,
        mechanism: "Score → category descriptor → optional price anchor. Never the producer name first.",
        prompt: `Write 3 subject line variations for the same wine: one score-first, one price-first, one quality-descriptor + price. Each under 8 words. No producer name first. Exclamation as voice, not decoration. Read them in your inbox preview — does each one tell you immediately if it's for you?`,
        example: `95 Point Napa Cab, Under $40! / Cult Sonoma Pinot — $28 Today / Best Price on the Planet: 95-Point Cab`,
      },
    ],
  },
  {
    id: "producer-storytelling",
    label: "Producer Storytelling",
    icon: "🍇",
    description: "Every producer has one surprising fact. Find it. Lead with it.",
    swipes: [
      {
        id: "personality-bio",
        title: "The Personality-Led Bio",
        swipe: `Roberto Cavalli, who brought sand-blasted jeans and exotic animal prints to the forefront of 80's fashion (the shame, the shame!), ran this estate for years with his son, Tomasso.`,
        why: `The parenthetical "(the shame, the shame!)" is the whole technique in miniature. It acknowledges a shared cultural memory with a wink, making the reader feel like they're in on a joke with the writer. It makes Roberto Cavalli a character, not a credential. The fashion tangent is irrelevant to wine quality — and that irrelevance is exactly what makes it memorable. The wine arrives in the next sentence as the real story.`,
        mechanism: "Surprising non-wine fact → parenthetical that winks at the absurdity → wine as the actual reveal",
        prompt: `Write a 2-sentence producer bio for a wine you're selling. Sentence 1: one surprising, non-wine fact about the producer's background or identity. Include a parenthetical that acknowledges the delight or absurdity of that fact. Sentence 2: the wine or estate, as if arriving from that tangent. Make them a character.`,
        example: `The winemaker spent seven years as a jazz pianist in New Orleans before anyone handed her a cluster of Pinot (the music industry's loss, frankly). Today she farms 12 acres in the Sonoma Coast hills with the same obsessive ear for nuance she used to apply to chord changes.`,
      },
    ],
  },
];

const STEPS = ["Swipe", "Why It Works", "Your Turn", "Example"];

export default function CopyDrill() {
  const [selectedTechnique, setSelectedTechnique] = useState(null);
  const [selectedSwipe, setSelectedSwipe] = useState(null);
  const [step, setStep] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [view, setView] = useState("menu"); // menu | technique | drill
  const textareaRef = useRef(null);

  const technique = TECHNIQUES.find((t) => t.id === selectedTechnique);
  const swipe = technique?.swipes.find((s) => s.id === selectedSwipe);

  const startDrill = (techniqueId, swipeId) => {
    setSelectedTechnique(techniqueId);
    setSelectedSwipe(swipeId);
    setStep(0);
    setUserInput("");
    setRevealed(false);
    setView("drill");
  };

  const goBack = () => {
    if (view === "drill") {
      setView("technique");
    } else {
      setView("menu");
      setSelectedTechnique(null);
    }
  };

  useEffect(() => {
    if (step === 2 && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [step]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0f0e0c",
      color: "#e8e0d0",
      fontFamily: "'Georgia', 'Times New Roman', serif",
      padding: "0",
      position: "relative",
      overflowX: "hidden",
    }}>
      {/* Grain texture overlay */}
      <div style={{
        position: "fixed", inset: 0, opacity: 0.03,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
        pointerEvents: "none", zIndex: 0,
      }} />

      {/* Header */}
      <div style={{
        borderBottom: "1px solid #2a2820",
        padding: "20px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        background: "#0f0e0c",
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {view !== "menu" && (
            <button onClick={goBack} style={{
              background: "none", border: "1px solid #2a2820", color: "#6b6355",
              padding: "6px 12px", borderRadius: "4px", cursor: "pointer",
              fontSize: "12px", letterSpacing: "0.05em", fontFamily: "inherit",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.target.style.borderColor = "#c4a96e"; e.target.style.color = "#c4a96e"; }}
            onMouseLeave={e => { e.target.style.borderColor = "#2a2820"; e.target.style.color = "#6b6355"; }}
            >← Back</button>
          )}
          <div>
            <div style={{ fontSize: "11px", letterSpacing: "0.15em", color: "#6b6355", textTransform: "uppercase", marginBottom: "2px" }}>
              Copy Drill
            </div>
            <div style={{ fontSize: "18px", fontWeight: "bold", color: "#e8e0d0", letterSpacing: "-0.01em" }}>
              {view === "menu" ? "Technique Library" : view === "technique" ? technique?.label : swipe?.title}
            </div>
          </div>
        </div>
        {view === "drill" && (
          <div style={{ display: "flex", gap: "6px" }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{
                width: "8px", height: "8px", borderRadius: "50%",
                background: i <= step ? "#c4a96e" : "#2a2820",
                transition: "background 0.3s",
              }} />
            ))}
          </div>
        )}
      </div>

      <div style={{ maxWidth: "780px", margin: "0 auto", padding: "40px 32px", position: "relative", zIndex: 1 }}>

        {/* MENU VIEW */}
        {view === "menu" && (
          <div>
            <p style={{ color: "#6b6355", fontSize: "15px", lineHeight: 1.7, marginBottom: "40px", maxWidth: "520px" }}>
              Each drill takes 5 minutes. Pick a technique, study the swipe, then write your own version before you see the example. The gap between knowing and doing is the whole point.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              {TECHNIQUES.map((t) => (
                <button key={t.id} onClick={() => { setSelectedTechnique(t.id); setView("technique"); }}
                  style={{
                    background: "#161512", border: "1px solid #2a2820", borderRadius: "8px",
                    padding: "24px", textAlign: "left", cursor: "pointer",
                    transition: "all 0.2s", color: "#e8e0d0", fontFamily: "inherit",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#c4a96e"; e.currentTarget.style.background = "#1a1916"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a2820"; e.currentTarget.style.background = "#161512"; }}
                >
                  <div style={{ fontSize: "24px", marginBottom: "10px" }}>{t.icon}</div>
                  <div style={{ fontSize: "15px", fontWeight: "bold", marginBottom: "6px" }}>{t.label}</div>
                  <div style={{ fontSize: "12px", color: "#6b6355", lineHeight: 1.5 }}>{t.description}</div>
                  <div style={{ fontSize: "11px", color: "#4a4440", marginTop: "12px", letterSpacing: "0.05em" }}>
                    {t.swipes.length} drill{t.swipes.length > 1 ? "s" : ""}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TECHNIQUE VIEW */}
        {view === "technique" && technique && (
          <div>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>{technique.icon}</div>
            <p style={{ color: "#6b6355", fontSize: "15px", lineHeight: 1.7, marginBottom: "40px" }}>
              {technique.description}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {technique.swipes.map((s) => (
                <button key={s.id} onClick={() => startDrill(technique.id, s.id)}
                  style={{
                    background: "#161512", border: "1px solid #2a2820", borderRadius: "8px",
                    padding: "24px 28px", textAlign: "left", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    transition: "all 0.2s", color: "#e8e0d0", fontFamily: "inherit",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#c4a96e"; e.currentTarget.style.background = "#1a1916"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a2820"; e.currentTarget.style.background = "#161512"; }}
                >
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: "bold", marginBottom: "6px" }}>{s.title}</div>
                    <div style={{ fontSize: "12px", color: "#6b6355", fontStyle: "italic", fontFamily: "Georgia, serif" }}>
                      "{s.swipe.length > 80 ? s.swipe.slice(0, 80) + "…" : s.swipe}"
                    </div>
                  </div>
                  <div style={{ color: "#c4a96e", fontSize: "20px", marginLeft: "16px", flexShrink: 0 }}>→</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* DRILL VIEW */}
        {view === "drill" && swipe && (
          <div>
            {/* Step label */}
            <div style={{
              fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase",
              color: "#c4a96e", marginBottom: "24px", display: "flex", alignItems: "center", gap: "8px"
            }}>
              <span style={{ background: "#c4a96e", color: "#0f0e0c", padding: "2px 8px", borderRadius: "2px", fontWeight: "bold" }}>
                Step {step + 1}
              </span>
              {STEPS[step]}
            </div>

            {/* Step 0: The Swipe */}
            {step === 0 && (
              <div>
                <p style={{ color: "#6b6355", fontSize: "13px", marginBottom: "24px", letterSpacing: "0.03em" }}>
                  Read this. Read it again. Read it out loud. Notice what it does to you before you start analyzing it.
                </p>
                <div style={{
                  background: "#161512", border: "1px solid #2a2820",
                  borderLeft: "3px solid #c4a96e",
                  borderRadius: "0 8px 8px 0", padding: "28px 32px",
                  marginBottom: "32px",
                }}>
                  <div style={{
                    fontSize: "17px", lineHeight: 1.8, color: "#e8e0d0",
                    fontStyle: "italic", fontFamily: "Georgia, serif",
                    whiteSpace: "pre-line",
                  }}>
                    "{swipe.swipe}"
                  </div>
                </div>
                <div style={{
                  display: "flex", gap: "12px", fontSize: "12px", color: "#6b6355",
                  marginBottom: "32px", padding: "16px", background: "#161512",
                  borderRadius: "6px", border: "1px solid #2a2820",
                }}>
                  <span style={{ color: "#c4a96e", flexShrink: 0 }}>Mechanism:</span>
                  <span>{swipe.mechanism}</span>
                </div>
              </div>
            )}

            {/* Step 1: Why It Works */}
            {step === 1 && (
              <div>
                <p style={{ color: "#6b6355", fontSize: "13px", marginBottom: "24px" }}>
                  This is the craft layer. Understanding the mechanism is more useful than memorizing the words.
                </p>
                <div style={{
                  background: "#161512", border: "1px solid #2a2820",
                  borderLeft: "3px solid #c4a96e",
                  borderRadius: "0 8px 8px 0", padding: "28px 32px", marginBottom: "24px",
                }}>
                  <div style={{ fontSize: "11px", letterSpacing: "0.1em", color: "#6b6355", textTransform: "uppercase", marginBottom: "16px" }}>
                    The Swipe
                  </div>
                  <div style={{ fontSize: "14px", lineHeight: 1.7, color: "#9a8e7e", fontStyle: "italic", marginBottom: "24px" }}>
                    "{swipe.swipe}"
                  </div>
                  <div style={{ height: "1px", background: "#2a2820", marginBottom: "24px" }} />
                  <div style={{ fontSize: "11px", letterSpacing: "0.1em", color: "#c4a96e", textTransform: "uppercase", marginBottom: "16px" }}>
                    Why It Works
                  </div>
                  <div style={{ fontSize: "15px", lineHeight: 1.8, color: "#e8e0d0" }}>
                    {swipe.why}
                  </div>
                  <div style={{
                    marginTop: "20px", padding: "14px 16px",
                    background: "#0f0e0c", borderRadius: "4px",
                    fontSize: "12px", color: "#6b6355",
                    display: "flex", gap: "10px",
                  }}>
                    <span style={{ color: "#c4a96e", flexShrink: 0 }}>Mechanism:</span>
                    <span>{swipe.mechanism}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Your Turn */}
            {step === 2 && (
              <div>
                <div style={{
                  background: "#161512", border: "1px solid #2a2820",
                  borderRadius: "8px", padding: "24px", marginBottom: "24px",
                }}>
                  <div style={{ fontSize: "11px", letterSpacing: "0.1em", color: "#c4a96e", textTransform: "uppercase", marginBottom: "12px" }}>
                    The Prompt
                  </div>
                  <div style={{ fontSize: "14px", lineHeight: 1.8, color: "#9a8e7e" }}>
                    {swipe.prompt}
                  </div>
                </div>
                <textarea
                  ref={textareaRef}
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Write your version here. Don't overthink it — just apply the mechanism."
                  style={{
                    width: "100%", minHeight: "160px", background: "#161512",
                    border: "1px solid #2a2820", borderRadius: "8px",
                    color: "#e8e0d0", fontFamily: "Georgia, serif", fontSize: "15px",
                    lineHeight: 1.8, padding: "20px", resize: "vertical",
                    outline: "none", boxSizing: "border-box", transition: "border-color 0.2s",
                  }}
                  onFocus={e => e.target.style.borderColor = "#c4a96e"}
                  onBlur={e => e.target.style.borderColor = "#2a2820"}
                />
                <div style={{ fontSize: "11px", color: "#4a4440", marginTop: "8px" }}>
                  Write something before you look at the example. That gap is the whole exercise.
                </div>
              </div>
            )}

            {/* Step 3: The Example */}
            {step === 3 && (
              <div>
                {!revealed ? (
                  <div>
                    {userInput && (
                      <div style={{
                        background: "#161512", border: "1px solid #2a2820",
                        borderLeft: "3px solid #6b6355",
                        borderRadius: "0 8px 8px 0", padding: "24px 28px", marginBottom: "24px",
                      }}>
                        <div style={{ fontSize: "11px", letterSpacing: "0.1em", color: "#6b6355", textTransform: "uppercase", marginBottom: "12px" }}>
                          Your version
                        </div>
                        <div style={{ fontSize: "15px", lineHeight: 1.8, color: "#e8e0d0", fontStyle: "italic" }}>
                          {userInput}
                        </div>
                      </div>
                    )}
                    <button onClick={() => setRevealed(true)}
                      style={{
                        background: "#c4a96e", color: "#0f0e0c", border: "none",
                        padding: "14px 28px", borderRadius: "6px", cursor: "pointer",
                        fontSize: "13px", fontWeight: "bold", letterSpacing: "0.05em",
                        fontFamily: "inherit", transition: "all 0.2s",
                        width: "100%",
                      }}
                      onMouseEnter={e => e.target.style.background = "#d4b97e"}
                      onMouseLeave={e => e.target.style.background = "#c4a96e"}
                    >
                      Reveal the Example
                    </button>
                  </div>
                ) : (
                  <div>
                    {userInput && (
                      <div style={{
                        background: "#161512", border: "1px solid #2a2820",
                        borderLeft: "3px solid #6b6355",
                        borderRadius: "0 8px 8px 0", padding: "24px 28px", marginBottom: "16px",
                      }}>
                        <div style={{ fontSize: "11px", letterSpacing: "0.1em", color: "#6b6355", textTransform: "uppercase", marginBottom: "12px" }}>
                          Your version
                        </div>
                        <div style={{ fontSize: "15px", lineHeight: 1.8, color: "#e8e0d0", fontStyle: "italic" }}>
                          {userInput}
                        </div>
                      </div>
                    )}
                    <div style={{
                      background: "#161512", border: "1px solid #2a2820",
                      borderLeft: "3px solid #c4a96e",
                      borderRadius: "0 8px 8px 0", padding: "24px 28px", marginBottom: "24px",
                    }}>
                      <div style={{ fontSize: "11px", letterSpacing: "0.1em", color: "#c4a96e", textTransform: "uppercase", marginBottom: "12px" }}>
                        Example
                      </div>
                      <div style={{ fontSize: "15px", lineHeight: 1.8, color: "#e8e0d0", fontStyle: "italic" }}>
                        {swipe.example}
                      </div>
                    </div>
                    <div style={{
                      background: "#161512", border: "1px solid #2a2820",
                      borderRadius: "8px", padding: "20px 24px", marginBottom: "24px",
                    }}>
                      <div style={{ fontSize: "12px", color: "#6b6355", lineHeight: 1.7 }}>
                        <strong style={{ color: "#9a8e7e" }}>Compare:</strong> Does your version use the same mechanism? Not the same words — the same structure. If it doesn't, write it again with the mechanism in mind, not the output.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "32px" }}>
              <button
                onClick={() => step > 0 ? setStep(step - 1) : null}
                disabled={step === 0}
                style={{
                  background: "none", border: "1px solid #2a2820", color: step === 0 ? "#2a2820" : "#6b6355",
                  padding: "10px 20px", borderRadius: "6px", cursor: step === 0 ? "default" : "pointer",
                  fontSize: "13px", fontFamily: "inherit", transition: "all 0.15s",
                }}
              >
                ← Previous
              </button>

              {step < STEPS.length - 1 ? (
                <button onClick={() => setStep(step + 1)}
                  style={{
                    background: "#1e1c18", border: "1px solid #c4a96e", color: "#c4a96e",
                    padding: "10px 24px", borderRadius: "6px", cursor: "pointer",
                    fontSize: "13px", fontFamily: "inherit", fontWeight: "bold",
                    letterSpacing: "0.03em", transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#c4a96e"; e.currentTarget.style.color = "#0f0e0c"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#1e1c18"; e.currentTarget.style.color = "#c4a96e"; }}
                >
                  {step === 1 ? "Try It →" : "Next →"}
                </button>
              ) : (
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={() => setView("technique")}
                    style={{
                      background: "none", border: "1px solid #2a2820", color: "#6b6355",
                      padding: "10px 20px", borderRadius: "6px", cursor: "pointer",
                      fontSize: "13px", fontFamily: "inherit", transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#c4a96e"; e.currentTarget.style.color = "#c4a96e"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a2820"; e.currentTarget.style.color = "#6b6355"; }}
                  >
                    More drills
                  </button>
                  <button onClick={() => { setView("menu"); setSelectedTechnique(null); }}
                    style={{
                      background: "#c4a96e", color: "#0f0e0c", border: "none",
                      padding: "10px 24px", borderRadius: "6px", cursor: "pointer",
                      fontSize: "13px", fontFamily: "inherit", fontWeight: "bold",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => e.target.style.background = "#d4b97e"}
                    onMouseLeave={e => e.target.style.background = "#c4a96e"}
                  >
                    All techniques
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
