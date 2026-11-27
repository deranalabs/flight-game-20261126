# Tidewing identity

**World.** The Cinder Reach: six islands (Halyard Isle, Mount Cinder, Saltmoor, Tallow Island,
Gannet Point, Far Skerry), listed with harbour, trade, landmark, custom and history in
`game/src/world/gazetteer.js`. Naming rule: an island is a plain landscape word with a local
noun; a person is a given name and a trade surname. No real place or brand.

**Premise (the cover sentence).** A floatplane pilot owes the Port Halyard Board 12,000 sh and
flies contracts across the Cinder Reach to clear it before the season closes.

**Arc.** Four chapters laid over the real sortie count (`chapterBounds` in
`game/src/story/storyline.js`):
1. THE NOTE: the clerk, Ansel Mott, radios the amount and the due date. The first sorties teach the controls.
2. THE WORK: each sortie is a contract with a named person on a named island, with a radio line before and after.
3. THE SQUEEZE: the Board adds a 1,500 sh fee, and one contract forces a choice: the Board's charter
   (1,200 sh off the note) or the clinic's spare parts (300 sh and Saltmoor's trust).
4. THE RECKONING: the last sortie. The final receipt stamps PAID, PART-PAID (an extension, up to
   3,000 sh left) or UNPAID (a lien on the Tern).

Every completed sortie pays one shilling per score point. Events add bonuses. Refits and the fee
are charged. The ledger (`game/src/hangar/harbourDebt.js`) keeps every entry.

**Palette** (declared once in `game/src/identity/palette.js`): basalt `#16120f` for panels,
sulphur `#f2c230` for labels and trim, lagoon teal `#2fc4b4` for live data and things done well,
ledger cream `#efe6cf` for ink and numerals, ember `#e5482d` for the debt only, and mist
`#9fbccc` for secondary ink.

**Type.** One display face for banners and the wordmark (Impact and its kin, tall and
condensed), one narrow numeral face (DIN Condensed, Bahnschrift) and a condensed body face.
Banners and key strings are in capitals so they read at a glance.

**Panel.** One shape from `box()`: basalt, the top-right corner cut, a sulphur ledger tab down
the left edge. The screens use the same shape through the `.panel` CSS rule.

**Signature.** The Board's round stamp, DUE in ember and PAID in lagoon. It appears on the HUD
note card, the title, the board, the briefing, the chapter plate and the receipt.

**Livery.** The Tern Mk II: ledger cream, sulphur trim, a lagoon teal fin with a sulphur sun and
sulphur-over-basalt rudder bands, registration TW-07.

**Voice.** The radio is the Reach talking: the tower, the hangar, the clinic, and the clerk's
notices in a dry ledger voice. One line per beat.
