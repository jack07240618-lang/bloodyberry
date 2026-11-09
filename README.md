# Bloodyberry 🦇🩸
### Complete HTML5 Canvas + TypeScript Vampire Survivors Clone (Auto-Shooter / Horde Survival)

**Bloodyberry** is a production-grade, zero-external-asset auto-shooter built with modern TypeScript, Vite, and HTML5 Canvas 2D. All graphics, weapons, enemy sprites, particle FX, damage numbers, and UI cards are drawn programmatically using pure Canvas vector primitives. Sound effects are synthesized on-the-fly using the Web Audio API.

---

## 🎮 How to Play

### Controls
| Input | Action |
|---|---|
| **W, A, S, D** or **Arrow Keys** | Move character |
| **C / Parry HUD button** | Active parry: 0.24s window, 4.5s cooldown; reflect flying bullets or interrupt melee. Ground hazards must be dodged. |
| **Mouse / Touch Screen** | Virtual joystick / directional steering & UI click |
| **1, 2, 3, 4** | Select level-up upgrade option |
| **Enter / Space** | Select / Claim / Start run / Close modal |
| **Escape / P** | Pause / Resume gameplay |
| **Mute Button (🔊/🔇)** | Toggle retro chiptune sound synthesizer |

---

## ⚔️ Weapons & Evolutions Matrix

Reach **Level 8** on a base weapon while holding at least 1 rank in the paired passive item. Defeating an Elite Mini-Boss or Boss drops a **Golden Treasure Chest** that unlocks its evolved ultimate form:

| Base Weapon | Paired Passive | Evolved Ultimate Form | Special Effect |
|---|---|---|---|
| **Magic Wand** | Empty Tome (-CD) | **Holy Wand** | Fires piercing machine-gun blue bolts with zero attack delay. |
| **Knife** | Wings (+Speed) | **Thousand Edge** | Unbroken continuous stream of piercing throwing blades. |
| **King Bible** | Hollow Heart (+MaxHP) | **Unholy Vespers** | Permanent, never-expiring rotating ring of dark scripture with heavy knockback. |
| **Santa Water** | Attractorb (+Magnet) | **La Borra** | Lingering holy flame zones that drift inward toward the player while expanding in radius. |
| **Lightning Ring** | Duplicator (+Projectiles) | **Thunder Loop** | Double thunder strikes with explosive area-of-effect electrical shockwaves. |
| **Cross** | Clover (+Luck/Crit) | **Heaven Sword** | Giant celestial spinning blades that deal lethal 2.5x critical strikes. |
| **Garlic** | Pummarola (+Regen) | **Soul Eater** | Massive dark aura that steals enemy life essence to heal the player. |
| **Pentagram** | Crown (+EXP) | **Gorgeous Moon** | Periodic screen-wipe lunar pulse that vacuums all XP gems across the entire map. |

---

## 🛡️ Passive Items Matrix

- **Spinach**: +10% Damage per rank (up to +50%).
- **Wings**: +10% Move Speed per rank (up to +50%).
- **Empty Tome**: -8% Weapon Cooldown per rank (up to -40%).
- **Duplicator**: +1 Additional Projectile per rank.
- **Crown**: +15% Experience Gain per rank (up to +75%).
- **Hollow Heart**: +20% Max Health per rank (up to +100%).
- **Armor**: +1 Flat Damage Reduction per rank.
- **Pummarola**: +0.6 HP/second passive health regeneration per rank.
- **Attractorb**: +30% Gem and item attraction radius per rank.
- **Clover**: +10% Critical strike chance and lucky drop rates.

---

## 🧙 Unlockable Characters

1. **Antonio (The Belpaese Blade)**: Starts with *Knife*. Trait: +10% Max HP, +1 Natural Armor.
2. **Imelda (The Arcane Scholar)**: Starts with *Magic Wand*. Trait: +25% Experience Gain, +5% Move Speed.
3. **Gennaro (The Dual Shadow)**: Starts with *Knife*. Trait: +1 Permanent Projectile for all weapons. (Unlock: 200 Lifetime Kills)
4. **Arca (The Crimson Warlock)**: Starts with *Santa Water*. Trait: -15% Weapon Cooldowns, +15% Area Size. (Unlock: 500 Lifetime Kills)
5. **Pasqualina (The Storm Weaver)**: Starts with *Lightning Ring*. Trait: +20% Weapon Damage, +15% Crit Chance. (Unlock: 1000 Lifetime Kills)

---

## ⚡ Technical Highlights

1. **Zero External Assets**: 100% vector primitives, gradients, and dynamic canvas rendering.
2. **Spatial Hash Grid ($O(N)$)**: Guarantees silky smooth 60 FPS with 500+ enemies on screen.
3. **Web Audio API Synthesizer**: Retro oscillators, white noise bursts, and custom lowpass filter envelopes for all game audio without loading external files.
4. **Headless Balance Simulator**: Includes a 100-run simulation script (`npm run simulate`) verifying zero NaN anomalies and proper difficulty scaling.
5. **Local Persistence**: Saves high scores, total lifetime kills, gold earned, and unlocked characters in `localStorage`.

---

## 🚀 Running the Project

```bash
# Install dependencies
npm install

# Start local dev server
npm run dev

# Run automated 100-run balance simulation
npm run simulate

# Build production bundle
npm run build
```
