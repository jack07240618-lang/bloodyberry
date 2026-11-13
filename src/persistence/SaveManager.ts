export interface SaveData {
  highScoreSeconds: number;
  lifetimeKills: number;
  totalGold: number;
  unlockedCharacters: string[];
}

const ALL_CHARACTER_IDS = ['antonio', 'imelda', 'gennaro', 'arca'];

const DEFAULT_SAVE: SaveData = {
  highScoreSeconds: 0,
  lifetimeKills: 0,
  totalGold: 0,
  unlockedCharacters: [...ALL_CHARACTER_IDS]
};

const SAVE_KEY = 'bloodyberry_save_v1';

export class SaveManager {
  private data: SaveData;

  constructor() {
    this.data = this.load();
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_SAVE,
          ...parsed,
          unlockedCharacters: [...ALL_CHARACTER_IDS]
        };
      }
    } catch {
      // Fallback if localStorage unavailable
    }
    return { ...DEFAULT_SAVE, unlockedCharacters: [...ALL_CHARACTER_IDS] };
  }

  public save(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      // Ignore
    }
  }

  public getData(): SaveData {
    return this.data;
  }

  public recordRun(timeSeconds: number, kills: number, gold: number): void {
    this.data.lifetimeKills += kills;
    this.data.totalGold += gold;
    if (timeSeconds > this.data.highScoreSeconds) {
      this.data.highScoreSeconds = Math.round(timeSeconds);
    }

    // All 4 core hero archetypes are unlocked by default for instant foolproof play
    for (const cid of ALL_CHARACTER_IDS) {
      if (!this.data.unlockedCharacters.includes(cid)) {
        this.data.unlockedCharacters.push(cid);
      }
    }

    this.save();
  }

  public isCharacterUnlocked(_id: string): boolean {
    return true;
  }
}
