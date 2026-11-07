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
- [ ] Milestone 7.1: Continuous Gameplay & Visual Optimization
