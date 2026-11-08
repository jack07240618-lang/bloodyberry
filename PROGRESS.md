# Bloodyberry - Development Progress & Roadmap

## Phase 1: Scaffolding, Core Loop & Engine Foundation
- [x] Modern TypeScript + Vite setup with zero external asset dependencies
- [x] Fixed-step accumulator Game Loop with sub-step clamping
- [x] Vector2 2D math library (rotation, lerp, distance, normalization)
- [x] Input Controller (WASD, Arrows, 1-4 Upgrade hotkeys, Space/Enter, Touch/Virtual Joystick)
- [x] Dynamic Canvas Resizer with devicePixelRatio High-DPI crisp rendering
- [x] Camera2D with smooth target following and exponential screen shake decay
- [x] Player Entity base stats, i-frames, facing direction, and procedural Gothic Hunter sprite

## Phase 2: Spatial Partitioning, Enemy Horde & Collision
- [x] High-performance 2D Spatial Hash Grid ($O(N)$ lookup) supporting 500+ simultaneous enemies
- [x] Swarm Enemy types: Walkers, Dashers, Swarmers, Tanks
- [x] Flocking separation force to prevent enemy singularity stacking
- [x] Dynamic Spawn Director with wave scaling based on elapsed survival seconds
- [x] Player-enemy damage collision, i-frames, and red hit flash feedback

## Phase 3: Projectile System & Initial Weapons Pipeline
- [x] Generic Projectile & Weapon Engine
- [x] Magic Wand (nearest-enemy targeted energy bolt)
- [x] King Bible / Spinning Orbs (orbital contact damage barrier)
- [x] Santa Water / Ground Fire (thrown lingering AoE damage pools)
- [x] Piercing Dagger / Knife (directional piercing blades)
- [x] Screen shake, floating combat text system, and particle explosion bursts

## Phase 4: Drop System, Level-Up UI & Progression Loop
- [x] Drop system: Diamond XP Gems (Cyan, Green, Red, Violet), Health Potions, Magnets, Clocks, Gold Coins, Boss Chests
- [x] Experience and Level-Up State Machine with exponential XP curve
- [x] Procedural Canvas-based Level-Up UI modal with vector icons, hover states, and hotkeys
- [x] Seamless pause and resume gameplay loop

## Phase 5: Advanced Systems (Evolutions & Boss Waves)
- [x] Weapon Evolution / Fusion System (8 base weapons + 8 passives = 8 evolved forms)
- [x] Timed Elite Encounters: 3m Minotaur, 5m Encircling Ring, 7m Golem King, 10m Arch-Demon Malakor
- [x] Golden Treasure Chest opening animation and roulette evolution rewards
- [x] Game Over Screen with detailed stats, DPS breakdown table, and instant restart

## Phase 6: Infinite Autonomous Expansion Loop
- [x] 10 Unique Passive Items (Spinach, Wings, Empty Tome, Duplicator, Crown, Hollow Heart, Armor, Pummarola, Attractorb, Clover)
- [x] 4 Advanced Weapons: Chain Lightning, Cross Boomerang, Garlic Aura, Pentagram Screen Nuke
- [x] Advanced Enemy AI: Charging Minotaur, Ranged Gargoyle Spitter, Splitter Slimes, Spectral Ghosts
- [x] Elite Boss mechanics: Multi-phase demon with 8-way bullet ring bursts
- [x] Procedural infinite dungeon map with breakable torches/braziers
- [x] Web Audio API sound synthesizer with 8+ custom oscillator sound effects
- [x] LocalStorage persistence for High Scores, Lifetime Kills, Gold, and Unlocked Characters
- [x] Automated Headless Balance Simulation (100 runs passing with 0 errors)
- [x] Milestone 6.1: Procedural Chiptune Background Music (BGM) Synthesizer
- [x] Milestone 6.2: Dynamic Vignette Lighting & Torch Illumination + Blood Decal System
- [x] Milestone 6.3: 4 Additional Classic Weapons (Whip/Bloody Tear, Axe/Death Spiral, Fire Wand/Hellfire, Runetracer/No Future)
- [x] Milestone 6.4: Reroll, Skip, and Banish Meta Mechanics in Level-Up Modal
- [x] Milestone 6.5: Headless Simulation update and balance validation for all 12 weapons
- [x] Milestone 6.6: Audio Volume Controls & Hit-Stop / Screen-Juice Polish Engine
- [x] Milestone 6.7: Flashing Boss Warning Siren & Telegraph Banner Systems
- [x] Milestone 7.0: Triple Visual Elevation: WebGL Post-Processing (Bloom + Chromatic Aberration + CRT + Shockwaves) + Multi-layer Fog/Trails/Embers + 32x32 Gothic Pixel Art Sprites + 3D Holographic Foil Cards!
- [x] Milestone 7.1: Bugfix: Removed giant fog sphere from arena & fixed Level-Up modal occlusion by unifying rendering on single high-DPI Canvas
- [x] Milestone 7.2: Added stacked Level-Up queue (simultaneous multi-level gains queue all upgrade choices)
- [x] Milestone 8.0: Commercial AAA Visual Transformation:
  - Bundled authentic Dark Fantasy "Cinzel" vector typography for titles, HUD, and cards
  - Integrated GSAP for fluid card animations and elastic UI interaction
  - Full 10-archetype High-Res Spritesheet Animation Engine (Player, Ghouls, Bats, Spiders, Golems, Minotaurs, Gargoyles, Slimes, Ghosts, Demon Boss)
  - Beveled obsidian gold-framed Level-Up cards with holographic foil shimmer and embossed coin hotkeys
  - Crystal specular HP & XP meters with ornate metal brackets
- [x] Milestone 8.1: 100% Guaranteed Enemy XP Drop & Global Infinite Distance Auto-Magnet for all gems
- [x] Milestone 9.0: Commercial Indie Pixel-Art & Additive VFX Overhaul:
  - Pixel-Art Outline Post-Processor (`applyPixelOutline`) + 6 unique Hero Sprites (`hero_antonio`, `hero_imelda`, `hero_gennaro`, `hero_arca`, `hero_pasqualina`, `hero_mortaccio`) and 9 detailed Monster Sprites with 3-step shading, ribcages, fangs, molten cores, and weapons
  - Commercial Additive Blending (`globalCompositeOperation = 'lighter'`) for all 12 weapons, motion trail ribbons, sacred geometry runes, and multi-branching sky lightning
  - Multi-shape Particle System (`RING`, `SPARK`, `SHARD`, `ORB`) with expanding shockwaves
  - Pre-rendered 8-variant Gothic Cobblestone & Ritual Rune Tile Atlas + Real-Time 2.5D Dynamic Colored Point Lights (Player aura, flickering Torch Braziers, glowing Projectiles, Boss hellfire) & Directional Cast Shadows
- [x] Milestone 10.0: Active Combat Mechanics, Ultimate Skill Overhaul, Elemental Synergies & Dungeon Shrines:
  - Removed `Pentagram` from regular weapon pool (`WeaponRegistry.ts`) and converted it into the Player's innate **Ultimate Screen-Nuke Skill** (`[Q] / [E]` or clickable bottom HUD button, cooldown-based + accelerated by enemy kills, with full-screen expanding Pentagram star geometry & auto-vacuum)
  - Added **Shadow Dash** (`[SPACE] / [SHIFT]` or clickable HUD button) with invulnerability frames (i-frames), luminous ghost afterimage trails, and kinetic shockwave knockback
  - Added **Elemental Synergy Reactions**: Fire + Lightning = `⚡ OVERLOAD!` AoE explosion; Freeze + Heavy Weapons = `❄️ SHATTER!` 2.5x damage; Bleed + Garlic = `🩸 SOUL DRAIN` lifesteal
  - Added procedural **Gothic Blood Shrines** (`ALTAR OF FRENZY`, `ALTAR OF GREED`, `SANCTUARY ALTAR`) across dungeon chunks
- [x] Milestone 11.0: Boss-Exclusive High-Rarity Relics, Seamless Continuous Holy Cross Shields & 6 Unique Character Ultimates:
  - **Boss-Only Shrines**: Shrines now exclusively spawn upon defeating a Boss (`spawnBossShrine`), featuring sky-high celestial light pillars and massively boosted attributes (`+75% DMG, +20% Crit & +25% Area` / `+40% DMG, +800 Gold & +50% XP` / `+35% DMG, +2 Armor, Full Heal & Ult Reset`)
  - **Seamless Continuous Orbiting Holy Cross Shield**: Eliminated the duration/cooldown gap in `SpinningOrbs.ts` so the golden crusader cross shields orbit smoothly 100% of the time without disappearing or resetting, connected by a glowing golden orbit ring
  - **6 Unique Damage-Scaled Character Ultimates**: Replaced instant-kill nuke with high-damage (`(180 + level * 22) * damageMult`) character-specific Ultimates (`CRIMSON CROSS`, `STARFALL PENTAGRAM`, `PHANTOM BLADESTORM`, `HELLFIRE CATACLYSM`, `PRISMATIC THUNDER`, `DEATH SPIRAL HARVEST`) that chunk Boss HP without one-shotting them
- [x] Milestone 12.0: Single Unlabeled Mystery Door & 2-Round Cooldown Room System:
  - Upon clearing a room (`RoomManager.ts`), strictly **one single unlabeled door** (`DoorPortal` at `x = 0`) is present at the north exit with zero room-type text labels, zero badge icons, and a uniform mysterious silver-violet dimensional vortex
  - Stepping into the door randomly routes the player into one of 4 room types: **Normal Combat Room (`COMBAT`)**, **Elite Room (`ELITE`)**, **Blacksmith Shop Room (`SHOP`)**, or **Mystery Event Room (`EVENT`)**
  - Enforced strict **2-round cooldown (`roundsSinceShop >= 2` / `roundsSinceEvent >= 2`)**: once `SHOP` or `EVENT` is entered, that room type is locked out of the random pool for the next two rounds so it can only appear at most once within any 2 consecutive rounds
  - Overhauled the first Swordsman's (`Antonio` / `whip`) attack VFX (`ProjectileType.WHIP_SLASH`) from a forward thrust into a **180-degree semicircular horizontal sword cleave (半圆形横劈)** with 5-layer Sword Qi (`剑气`): wide vacuum aura fan, tapered crescent-moon Sword Qi body, triple concentric Sword Qi ripple arcs, sweeping physical greatsword with 4 afterimage blades, and curved wind-shear spark ribbons
- [x] Milestone 13.0: Unified "Crimson Reliquary" Gothic Cathedral Art Direction:
  - Unified the entire game's visual identity around **Obsidian Slate, Filigree Reliquary Gold & Cathedral Stained-Glass** (`RoomManager.ts`, `CompanionSystem.ts`, `DamageTextSystem.ts`, `Player.ts`, `Enemy.ts`)
  - Replaced flat room borders with **3D Beveled Gothic Masonry Walls**, stone battlements, interior ambient occlusion wall shadows, 4 carved Corner Bastion Pillars, 8 flickering Wall Sconces, and a 12-petal **Cathedral Rose-Window Floor Medallion**
  - Replaced generic diamonds and raw OS emojis with bespoke **Gothic Reliquary Altar Sculptures** (Blacksmith Anvil & Forge Hammer, Sacred Ruby Vial, Crimson Blood Chalice, Celestial Astrolabe, Chained Reliquary Coffer, Winged Prism) and custom Heraldic Vector Crests
  - Upgraded the Soul Companion into a **Seraphic Golden-Winged Reliquary Thurible** with runic chain-nodes along the Soul Tether, and unified combat damage numbers with metallic `"Cinzel"` serif gradients
- [x] Milestone 13.1: Minimalist Zero-Clutter Visual Language, Multi-Layer Volumetric Lighting & 3D Beveled Character/Enemy UI:
  - **Eliminated MMO-Style Chinese Text Clutter**: Removed all floating Chinese status text popups (`addStatusText`) from `BuildSystem.ts`, `CombatSystem.ts`, and `RoomManager.ts`; removed floating Chinese mode labels on the Soul Companion (`CompanionSystem.ts`); removed the 3-line Chinese text floating over room altars (`RoomManager.ts`); removed the 5-row Chinese Tag Resonance text wall on the left HUD (`UIManager.ts`); and replaced the wordy top Chinese room banner with a minimalist 3D Floor Crest (`FLOOR X`) and faceted diamond wave pips (`◆`)
  - **Multi-Layer Atmospheric Lighting & God Rays**: Added diagonal **Volumetric Cathedral Light Shafts (丁达尔斜射体积光束)** and vertical altar light columns in `RoomManager.ts`, plus upgraded `MapSystem.ts` `renderLighting` with a multi-stop layered darkness vignette and dual-layer volumetric point lights for the player and torch braziers
  - **Exquisite 3D-Dimensional Character, Enemy & HUD UI**:
    - Upgraded the Player overhead gauge (`Player.ts`) into a 3D beveled dark-steel & gold-filigree casing with floating drop shadow, diamond end-studs, 4-stop cylindrical liquid-glass fill, and a 2px Dash stamina micro-bar
    - Added 3D beveled crimson micro-health bars for all damaged normal/elite enemies (`Enemy.ts`), and upgraded the Boss health bar into a 3D sculpted obsidian-gold gauge with ruby end-caps, 25% tick dividers, and a pure vector gold crown crest
    - Redesigned the Screen-Space HUD (`UIManager.ts`) with a 3D Hero Portrait Medallion, 3D cylindrical glass HP/XP tubes, 3D recessed weapon/relic sockets, minimalist 3D faceted resonance gem badges (`II` / `IV`), and 3D beveled bottom skill medallions (`DASH`, `ULTIMATE`, `ORBIT/ANCHOR`)
    - Overhauled all Modals & Menus in `UIManager.ts` (`renderLevelUpModal`, `renderUpgradeCard`, `renderBossChestModal`, `renderGameOver`, `renderCharacterSelect`, `renderCharacterCard`, `renderVectorIcon`) with volumetric cathedral light shafts, 3D sculpted stone/gold tablets with extruded bottom thickness lips, 3D recessed icon wells, faceted tag gem sockets, visual weapon DPS proportion bars, and a semicircular Sword-Qi greatsword vector icon for `whip`
- [x] Milestone 13.2: Modern Minimalist Typography & Copywriting Overhaul:
  - Replaced heavy `900` weight `"Cinzel"` serif, yellow-red text gradients, thick `strokeText` outlines, and `✦`/`【】` promotional symbols across `UIManager.ts`, `DamageTextSystem.ts`, `RoomManager.ts`, `PassiveRegistry.ts`, and `main.ts`
  - Unified typography around a clean, modern geometric sans (`UI_FONT`: `SF Pro Display` / `Inter` / `PingFang SC`, weights `400`–`600`) and tabular monospace (`MONO_FONT`: `SF Mono` / `JetBrains Mono`) with restrained off-white (`#f8fafc`) and slate (`#94a3b8` / `#64748b`) contrast
  - Streamlined all relic/passive names and descriptions in `PassiveRegistry.ts` into concise 4-character titles (`棱镜折射`, `跃迁余烬`, `湮灭律令`, etc.) with clean middle-dot (`·`) separators instead of bilingual parentheses and bracketed tags
- [x] Milestone 13.3: Complete Bilingual (`简体中文` / `English`) Localization & Settings Menu:
  - Created `src/core/I18n.ts` (`i18n`, `t`, `getCharacterText`, `getWeaponDisplayName`, `getWeaponDescription`, `getWeaponUpgradeDescription`, `getPassiveDisplayName`, `getPassiveLevelDescription`), defaulting to `简体中文` (`zh`) and persisted in `localStorage` (`bloodyberry_lang_v1`)
  - Fully localized every UI element across `UIManager.ts`, `RoomManager.ts`, and `main.ts`: Title Screen, 6 Characters (names, titles, traits, ultimates), all 11 Weapons (names, evolved names, descriptions, Level 2–8 upgrades), all 10 Relics/Passives (names, descriptions, Level 1–5 upgrades), HUD skill medallions, Level-Up modal (`选择强化`, `重掷`, `跳过`, `放逐`), Boss Chest modal, and Run Summary screen
  - Added a 3D Settings Gear button (`⚙`) on the top-right of both the Title Screen and In-Game HUD (also accessible via `ESC` / `P`) and implemented `renderSettingsModal` allowing real-time switching between `简体中文` and `English`, audio mute toggle, resume, and return to title
- [x] **Milestone 14: 5-Biome Sanctuaries & Cover Pillars, Balanced Power Scaling, Fluid Sword/Arrow Qi VFX Transitions, No-Enemy Hold-Fire, and *Soul Knight* High-Mobility Bosses**
  - **5 Distinct Biome Sanctuaries & Tactical Cover Pillar Layouts** (`src/systems/MapSystem.ts`, `src/systems/RoomManager.ts`): Pre-rendered 5×8 Biome tile atlases (`0: 绯红地牢 Crimson Catacombs`, `1: 极寒冰渊 Frostbite Glacier`, `2: 翡翠腐林 Verdant Blight`, `3: 炼狱熔炉 Infernal Forge`, `4: 星界虚空 Astral Void`) and 5 interior 3D cover pillar formations (`RoomPillar`) that physically block movement and intercept enemy bullet-hell volleys.
  - **Balanced Power Scaling Curve** (`src/entities/Player.ts`, `src/systems/CombatSystem.ts`, `src/systems/BuildSystem.ts`, `src/systems/CompanionSystem.ts`, `src/systems/RoomManager.ts`): Steepened XP curve (`nextLevelXp = 12 -> 1.24^L`), eliminated duplicate passive proc stacking (`duplicator` / `clover`), rebalanced trait/relic/shrine multipliers, and increased enemy `waveMult` scaling per floor.
  - **Fluid 3-Phase Sword Qi & Arrow Qi VFX Transitions** (`src/weapons/Projectile.ts`, `src/weapons/implementations/Whip.ts`): Replaced the hard-clamped `Math.max(0.28, alpha)` in `WHIP_SLASH` with a continuous `0 -> 1 -> 0` lifecycle envelope, progressive 180° blade-carve easing, air-drag deceleration, 14-segment tapered crescent ribbon, inner-edge razor thinning, and dispersing Qi motes; added smooth spawn/fade easing and sonic arrow-qi wakes (`破空箭气弧光`) to ranged projectiles.
  - **Strict Hold-Fire When No Enemies Are Present** (`src/weapons/Weapon.ts`, `src/systems/CombatSystem.ts`, `src/weapons/implementations/SpinningOrbs.ts`, `src/weapons/implementations/GarlicAura.ts`, `src/systems/CompanionSystem.ts`): Added `combatSystem.hasActiveEnemies()` check across all weapons, orbitals, auras, and companions so no attacks are launched in empty/cleared/shop/event rooms.
  - ***Soul Knight* (元气骑士) High-Mobility Multi-Skill Boss Battles** (`src/enemies/Enemy.ts`, `src/enemies/EnemyRegistry.ts`): Overhauled `updateBossAI` with 4 Boss archetypes, Phase 2 Enrage (`<50% HP`), and 6 high-mobility skills (high-speed tactical strafing, 2–3 chained lock-on dashes with afterimage ghosts & perpendicular star bolts, phantom leap slam + skyfall meteor hazard zones `METEOR_ZONE`, 4/6-arm rotating spiral bullet curtains, sweeping twin/triple plasma laser beams `LASER_SWEEP`, and lateral blitz shotgun fan volleys + homing orbs `HOMING`).
- [x] **Milestone 15: Multi-Style Studio BGM Engine, *Soul Knight* Spawn Portals, Sword Qi Deflection & 360° Directional High-Impact Sword Qi VFX**:
  - **Default Audio Preserved + 6 Studio-Grade BGM Styles** (`src/core/SoundSynthesizer.ts`, `src/ui/UIManager.ts`, `src/main.ts`, `src/systems/RoomManager.ts`): Preserved all original SFX and `DEFAULT` BGM as the default, while adding 5 non-fatiguing 128-step multi-phrase BGM styles (`SYNTHWAVE` Dark Synthwave, `BAROQUE` Gothic Organ & Harpsichord, `ETHEREAL` Celestial Handpan & Harp, `CHIPTUNE_PRO` 16-Bit Arcade, and `AUTO` Auto-Biome Cycle) using low-pass filtered analog bass, stereo detuned pads, FM crystal bells, and LFO vibrato leads, plus a metallic `playParry()` chime.
  - ***Soul Knight* (元气骑士) Enemy Spawn Summoning Portal Animation** (`src/enemies/Enemy.ts`, `src/systems/CombatSystem.ts`): Every enemy spawns with a `spawnTimer` (`0.62s` normal / `0.85s` Boss) displaying a rotating ground summoning circle, pulsing `✖` target cross-mark, rising vertical portal beam, and elastic materialization (`0.35 -> 1.1 -> 1.0`) before becoming active and dealing contact damage.
  - **Sword Qi Projectile Deflection & Friendly Emerald-Gold Visual Distinction** (`src/enemies/Enemy.ts`, `src/systems/CombatSystem.ts`): `ProjectileType.WHIP_SLASH` deflects hostile enemy projectiles (`ep.reflect(...)`) back toward the nearest enemy at `1.75x` speed, transforming their appearance into a distinct Friendly Emerald-Jade & Holy Gold (`#34d399` / `#fef08a`) orb with a protective ring and 4-pointed star core (`✦`) that deals zero damage to the player and strikes enemies for heavy counter-damage.
  - **360° Directional Melee Aiming & High-Impact Sword Qi VFX** (`src/weapons/implementations/Whip.ts`, `src/weapons/implementations/PiercingDagger.ts`, `src/weapons/implementations/Axe.ts`, `src/weapons/Projectile.ts`, `src/systems/ParticleSystem.ts`, `src/systems/CombatSystem.ts`): Upgraded melee/Sword Qi (`WHIP_SLASH`) to cleave along the exact 360° vector toward the nearest enemy (top-left, bottom-right, etc.) and rendered a 5-layer crescent Sword Qi with outer sonic shockwave, 18-segment dual-tone crescent body, crackling lightning/qi filaments, rune greatsword with star-flare tip, and directional cross-slash hit sparks (`emitSlashImpact`).
