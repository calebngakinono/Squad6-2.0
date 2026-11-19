# Product

<!-- impeccable:product-schema 1 -->

## Platform

ios

iPhone first. Android (React Native, same codebase) comes after the first release and reuses this design; it is not designed separately for now.

## Users

Adults, roughly 18–40, who want to work out but struggle to stay consistent alone: they start strong and fall off after a few weeks, usually because nobody notices when they skip. They join a squad with friends, or with people in their city, so that five other people are counting on them.

Secondary: squad captains, who create a squad, share the invite code, and approve who joins after reading the person's details and note.

## Product Purpose

Squad Six is a social fitness accountability app. People join squads of up to six, record live workout sessions on their phone, earn server-calculated points, and compete as a squad through an annual season (January 1 – December 31). Success is a person still working out with their squad weeks and months after they joined.

The core app is free. Squad Six Pro (planned: progress analytics, captain tools, achievement history) is sold through RevenueCat; none of the Pro features is built yet.

## Positioning

Accountability comes from a small, fixed team, not from an algorithm, a coach or willpower. Points are trusted because they are computed on the server from live sessions and checked with GPS and Apple Health, so a squad's rank reflects real work. Squads, not individuals, are ranked, by city, country and world.

## Operating Context

- Used one-handed, often mid-workout, outdoors, in a gym, sweaty, glancing at the screen.
- Main loop: open app → start a live workout → pause/resume → finish → see the points breakdown → see the squad's standing.
- Weekly rhythm: weekly goal, weekly challenges (Bronze/Silver/Gold, 250-point weekly cap), squad activity over the last 7 days.
- Seasons and daily limits use the person's home time zone.
- Onboarding is a 15-screen flow that sells before it asks, with sign-up on screen 14 and the paywall on screen 15 (script: the Squad Six design handoff doc).
- A Fiverr/Figma designer may replace the visual design later; all styling stays in central tokens and shared components.

## Capabilities and Constraints

- Built: email, Apple and Google sign-in; onboarding engine (server-configured flows); squads (create, invite code, join request with note, captain approval, max six, roles); live workouts (GPS, set logging, pause/resume, offline queue, app-restart recovery); Apple Health evidence; scoring (Base + Verification + Performance, daily limits); squad standings; weekly challenges; workout history; squad activity; settings and account deletion.
- Not built: Health Connect (Android), squad chat, Pro features, live purchases.
- Points are server-authoritative: the client never calculates awarded points.
- Precise location is never shown to other users; teammates see city at most.
- A squad needs 4 members to be ranked; squad score is the plain total of members' points.
- Terms: squad, captain, member, season, live workout, points, standings, challenge, Squad Six Pro.
- Undecided: Pro prices and trial; which Pro features exist at launch.

## Brand Commitments

- Name: Squad Six. Tagline in use: "Fitness consistency is easier when five people are counting on you."
- Voice: a warm teammate. Direct and encouraging, never shaming; notices when you skip without guilt-tripping. Plain words, short sentences.

## Evidence on Hand

- No users, ratings, reviews, testimonials, press or usage statistics exist yet. Never invent any of them, in the app, onboarding, paywall or store listing.
- Personalized numbers may be shown only when computed from the person's own answers or data.
- Any research claim must show its source.
- City data © GeoNames (CC BY 4.0) must be credited in the app.

## Product Principles

1. **Nothing on screen is fabricated.** Every fitness number states its source (live, synced, manual, estimated); missing data shows as not recorded.
2. **The squad is the product.** Every screen should make the five other people feel present.
3. **Fair beats flashy.** Points and ranks must feel trustworthy and explainable; show the breakdown.
4. **Encourage, never shame.** Missed days are met with a way back, not a penalty message.
5. **Free core, honest upsell.** The free app is complete; Pro is always skippable ("Continue free" visible).

## Accessibility & Inclusion

Text scales with iOS Dynamic Type without clipping; touch targets at least 44pt; body text at least 4.5:1 contrast in light and dark mode; usable one-handed.
