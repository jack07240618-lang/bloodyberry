export interface SaveData {
  highScoreSeconds: number;
  lifetimeKills: number;
  totalGold: number;
  unlockedCharacters: string[];
}

const ALL_CHARACTER_IDS = ['antonio', 'imelda', 'gennaro', 'arca', 'pasqualina', 'mortaccio'];

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

    // Check unlocks
    if (this.data.lifetimeKills >= 200 && !this.data.unlockedCharacters.includes('gennaro')) {
      this.data.unlockedCharacters.push('gennaro');
    }
    if (this.data.lifetimeKills >= 500 && !this.data.unlockedCharacters.includes('arca')) {
      this.data.unlockedCharacters.push('arca');
    }
    if (this.data.lifetimeKills >= 1000 && !this.data.unlockedCharacters.includes('pasqualina')) {
      this.data.unlockedCharacters.push('pasqualina');
    }
    if (this.data.lifetimeKills >= 1500 && !this.data.unlockedCharacters.includes('mortaccio')) {
      this.data.unlockedCharacters.push('mortaccio');
    }

    this.save();
  }

  public isCharacterUnlocked(_id: string): boolean {
    return true;
  }
}
