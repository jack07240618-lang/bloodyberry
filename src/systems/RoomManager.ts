import { Vector2 } from '../core/Vector2';
import { Player } from '../entities/Player';
import { CombatSystem } from './CombatSystem';
import { EnemyType } from '../enemies/Enemy';
import { createEnemy } from '../enemies/EnemyRegistry';
import { DropItem, DropType } from '../entities/DropItem';
import { Destructible } from '../entities/Destructible';
import { Camera } from '../core/Camera';
import { SkillTag } from './BuildSystem';
import { t } from '../core/I18n';
import { createFloorSigil } from './FloorSigil';

/**
 * 房间状态机枚举 (Room State Machine)
 */
export enum RoomState {
  UNVISITED = 'UNVISITED',         // 未探索
  ACTIVE_LOCKED = 'ACTIVE_LOCKED', // 战斗中（所有出入口锁死）
  CLEARED = 'CLEARED',             // 已清理（解锁出入口 + 中央生成过关奖励）
  SPECIAL = 'SPECIAL'              // 特殊功能房（商店/铁匠 或 事件/奇遇）
}

/**
 * 房间类型枚举 (4种基础房间类型)
 */
export enum RoomType {
  COMBAT = 'COMBAT', // ⚔️ 普通战斗房
  ELITE = 'ELITE',   // 💀 精英高危房（高难高收益）
  SHOP = 'SHOP',     // 💰 商店/铁匠房
  EVENT = 'EVENT'    // ❓ 事件/奇遇房
}

export interface RoomTypeMeta {
  type: RoomType;
  title: string;
  subtitle: string;
  badgeIcon: string;
  themeColor: string;
  glowColor: string;
}

export const ROOM_TYPE_META: Record<RoomType, RoomTypeMeta> = {
  [RoomType.COMBAT]: {
    type: RoomType.COMBAT,
    title: '普通战斗房',
    subtitle: '击败驻守怪群，获取三选一构筑遗物',
    badgeIcon: '⚔️',
    themeColor: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.35)'
  },
  [RoomType.ELITE]: {
    type: RoomType.ELITE,
    title: '精英高危房',
    subtitle: '高难首领挑战，必掉神话宝箱与高额金币',
    badgeIcon: '💀',
    themeColor: '#ef4444',
    glowColor: 'rgba(239, 68, 68, 0.42)'
  },
  [RoomType.SHOP]: {
    type: RoomType.SHOP,
    title: '铁匠商店房',
    subtitle: '消耗金币淬炼武器、购买构筑与重随次数',
    badgeIcon: '💰',
    themeColor: '#fbbf24',
    glowColor: 'rgba(251, 191, 36, 0.38)'
  },
  [RoomType.EVENT]: {
    type: RoomType.EVENT,
    title: '奇遇事件房',
    subtitle: '未知的命运祭坛，风险转化或神圣赐福',
    badgeIcon: '❓',
    themeColor: '#c084fc',
    glowColor: 'rgba(192, 132, 252, 0.38)'
  }
};

/**
 * 出口门数据结构 (Door Portal)
 */
export interface DoorPortal {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  targetRoomType: RoomType;
  isOpen: boolean;
  pulseTimer: number;
}

/**
 * 房间中央过关奖励台 / 商店展台 / 奇遇祭坛 / 诅咒血箱互动项
 */
export interface RoomInteractable {
  id: string;
  kind:
    | 'CLEAR_REWARD'
    | 'SHOP_UPGRADE'
    | 'SHOP_HEAL_REROLL'
    | 'SHOP_RELIC_BOX'
    | 'EVENT_BLOOD_PACT'
    | 'EVENT_STAR_GRACE'
    | 'CURSED_BLOOD_CHEST';
  x: number;
  y: number;
  radius: number;
  title: string;
  subtitle: string;
  costGold: number;
  color: string;
  active: boolean;
  pulseTimer: number;
}

/**
 * 《地牢类》战术机关陷阱数据结构 (Dungeon Traps & Tactical Hazards)
 */
export type TrapKind = 'SPIKE_PLATE' | 'FLAME_PILLAR' | 'EXPLOSIVE_BARREL';

export interface DungeonTrap {
  id: number;
  kind: TrapKind;
  x: number;
  y: number;
  radius: number;
  cycleTimer: number;
  active: boolean;
  hp: number;
}

/**
 * 《元气骑士》风格立体战术掩体石柱 / 方尖碑 (3D Tactical Cover Pillar)
 */
export interface RoomPillar {
  x: number;
  y: number;
  radius: number;
  variant: number; // 0..4 matching biome
}

/**
 * 独立房间节点数据结构 (RoomNode)
 */
export interface RoomNode {
  roomNumber: number;
  biomeIndex: number;
  layoutPattern: number;
  gridX: number;
  gridY: number;
  type: RoomType;
  state: RoomState;
  width: number;
  height: number;
  totalWaves: number;
  currentWave: number;
  doors: DoorPortal[];
  interactables: RoomInteractable[];
  traps: DungeonTrap[];
  pillars: RoomPillar[];
}

export class RoomManager {
  public currentRoom!: RoomNode;
  public roomHistory: { roomNumber: number; type: RoomType; state: RoomState }[] = [];
  public elapsedSeconds = 0;

  // 房间几何尺寸（以 (0, 0) 为房间中心）
  public readonly halfWidth = 560;  // 总宽 1120
  public readonly halfHeight = 390; // 总高 780
  public readonly wallThickness = 44;

  // 波次刷怪延迟计时器
  private floorSigil: HTMLCanvasElement | null = null;
  private floorSigilSeed = 0;
  private sigilBag: number[] = [];
  private previousSigil = -1;
  private waveSpawnDelayTimer = 0;
  private isSpawningWave = false;
  private transitionBannerTimer = 0;
  private transitionFlashAlpha = 0;

  // 铁匠房(SHOP)与奇遇房(EVENT)两轮冷却追踪器：进入一次后，接下来两轮内绝不再次刷新
  private roundsSinceShop = 99;
  private roundsSinceEvent = 99;

  // 穹顶三束丁达尔体积光的对称斜射方向（-1: 左上角斜射向右下角；+1: 右上角斜射向左下角，每关随机对称切换）
  public currentRayDirSign: 1 | -1 = -1;

  constructor(private combatSystem: CombatSystem) {
    this.reset();
  }

  public reset(): void {
    this.elapsedSeconds = 0;
    this.roomHistory = [];
    this.roundsSinceShop = 99;
    this.roundsSinceEvent = 99;
    // 第 1 间房固定为普通战斗房，进入时由 UNVISITED 立即转为 ACTIVE_LOCKED
    this.loadRoom(1, RoomType.COMBAT);
  }

  /**
   * 加载并初始化指定序号与类型的独立房间
   */
  public loadRoom(roomNumber: number, type: RoomType, player?: Player): void {
    // 清理上一房间的残留怪物、敌方弹幕、地面可破坏物与旧掉落物
    this.combatSystem.enemies = [];
    this.combatSystem.enemyProjectiles = [];
    this.combatSystem.projectiles = [];
    this.combatSystem.dropItems = [];
    this.combatSystem.bossChestRolledThisRoom = false;
    this.combatSystem.bossChestDroppedThisRoom = false;
    this.combatSystem.delayedBombs = [];
    this.combatSystem.mapSystem.destructibles = [];
    this.combatSystem.mapSystem.shrines = [];
    this.combatSystem.mapSystem.mysteryDoor = null;

    // 更新铁匠房与奇遇房的两轮冷却计数：进入其中一种后，两轮之内不可再次刷新该房间
    if (type === RoomType.SHOP) {
      this.roundsSinceShop = 0;
      this.roundsSinceEvent++;
    } else if (type === RoomType.EVENT) {
      this.roundsSinceEvent = 0;
      this.roundsSinceShop++;
    } else {
      this.roundsSinceShop++;
      this.roundsSinceEvent++;
    }

    // 确定波次数：普通战斗房 2~3 波，精英房 2 波（含首领），商店/事件房 0 波
    const isCombatRoom = type === RoomType.COMBAT || type === RoomType.ELITE;
    const totalWaves = type === RoomType.COMBAT
      ? (roomNumber >= 3 ? 3 : 2)
      : type === RoomType.ELITE
      ? 2
      : 0;

    // 5 大主题生态场景轮转 (0: 绯红地牢, 1: 极寒冰渊, 2: 翡翠腐林, 3: 炼狱熔炉, 4: 星界虚空)
    const biomeIndex = (roomNumber - 1) % 5;
    this.combatSystem.mapSystem.currentBiomeIndex = biomeIndex;
    this.combatSystem.sound.setBiomeBGMHint(biomeIndex);

    // Shuffle all three paintings before reusing one; avoid repeats at bag boundaries.
    if (this.sigilBag.length === 0) {
      this.sigilBag = [0, 1, 2];
      for (let i = 2; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.sigilBag[i], this.sigilBag[j]] = [this.sigilBag[j], this.sigilBag[i]];
      }
      if (this.sigilBag[2] === this.previousSigil) {
        [this.sigilBag[0], this.sigilBag[2]] = [this.sigilBag[2], this.sigilBag[0]];
      }
    }
    this.previousSigil = this.sigilBag.pop()!;
    this.floorSigilSeed = Math.floor(Math.random() * 0xffffffff);
    this.floorSigil = null;


    // 随机对称切换本关屋顶三条光线的斜射方向（-1: 左上->右下，+1: 右上->左下；相邻关卡高概率对称翻转）
    if (roomNumber === 1) {
      this.currentRayDirSign = Math.random() < 0.5 ? -1 : 1;
    } else {
      this.currentRayDirSign =
        Math.random() < 0.75
          ? (this.currentRayDirSign === -1 ? 1 : -1)
          : (Math.random() < 0.5 ? -1 : 1);
    }
    // 8 套差异化房间地刺、掩体、火盆与机关小布局（确保每个房间的地刺与内部小布局各不相同）
    const layoutPattern =
      type === RoomType.ELITE
        ? 4 + (roomNumber % 2) * 3
        : (roomNumber * 3 + Math.floor(Math.random() * 2)) % 8;

    // 初始状态为 UNVISITED，随后玩家踏入房间立即触发状态切换
    this.currentRoom = {
      roomNumber,
      biomeIndex,
      layoutPattern,
      gridX: 0,
      gridY: -roomNumber,
      type,
      state: RoomState.UNVISITED,
      width: this.halfWidth * 2,
      height: this.halfHeight * 2,
      totalWaves,
      currentWave: 0,
      doors: this.generateNextRoomDoors(roomNumber),
      interactables: [],
      traps: [],
      pillars: isCombatRoom ? this.generateRoomPillars(layoutPattern, biomeIndex) : []
    };

    // 将玩家传送至房间南侧入口处
    if (player) {
      player.position.set(0, this.halfHeight - 95);
      player.velocity.set(0, 0);
    }

    // 按当前房间的 layoutPattern 生成差异化的哥特火盆可破坏物 & 地牢地刺/机关小布局
    this.spawnRoomBraziers(layoutPattern);
    if (isCombatRoom) {
      this.spawnRoomTrapsAndCursedChest(roomNumber, type, layoutPattern);
    }

    // 触发房间进入状态机转换
    if (isCombatRoom) {
      // 玩家进入未探索的战斗房间 -> 自动锁死所有出入口（ACTIVE_LOCKED），并按波次生成怪物
      this.currentRoom.state = RoomState.ACTIVE_LOCKED;
      for (const d of this.currentRoom.doors) {
        d.isOpen = false;
      }
      this.currentRoom.currentWave = 1;
      this.waveSpawnDelayTimer = 0.45;
      this.isSpawningWave = true;
    } else {
      // 商店房或奇遇事件房 -> 状态设为 SPECIAL，直接开启出口门并布置房间中央交互设施
      this.currentRoom.state = RoomState.SPECIAL;
      for (const d of this.currentRoom.doors) {
        d.isOpen = true;
      }
      if (type === RoomType.SHOP) {
        this.setupShopRoom();
      } else if (type === RoomType.EVENT) {
        this.setupEventRoom();
      }
    }

    this.roomHistory.push({
      roomNumber,
      type,
      state: this.currentRoom.state
    });

    this.transitionBannerTimer = 2.6;
    this.transitionFlashAlpha = 0.65;
  }

  /**
   * 为房间北侧出口仅生成 1 扇无任何标注的随机门（普通房/精英房/铁匠房/奇遇房）
   * 铁匠房(SHOP)与奇遇房(EVENT)在两轮之内只可能刷新一次
   */
  private generateNextRoomDoors(_currentRoomNum: number): DoorPortal[] {
    const weightedPool: { type: RoomType; weight: number }[] = [
      { type: RoomType.COMBAT, weight: 40 },
      { type: RoomType.ELITE, weight: 26 }
    ];

    if (this.roundsSinceShop >= 2) {
      weightedPool.push({ type: RoomType.SHOP, weight: 17 });
    }
    if (this.roundsSinceEvent >= 2) {
      weightedPool.push({ type: RoomType.EVENT, weight: 17 });
    }

    const totalWeight = weightedPool.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * totalWeight;
    let chosenType: RoomType = RoomType.COMBAT;
    for (const entry of weightedPool) {
      roll -= entry.weight;
      if (roll <= 0) {
        chosenType = entry.type;
        break;
      }
    }

    const doorY = -this.halfHeight + 18;
    return [
      {
        id: 0,
        x: 0,
        y: doorY,
        width: 112,
        height: 58,
        targetRoomType: chosenType,
        isOpen: false,
        pulseTimer: 0
      }
    ];
  }

  private spawnRoomBraziers(layoutPattern = 0): void {
    const brazierLayouts: Array<Array<[number, number]>> = [
      // Layout 0: 四角圣殿火盆
      [[-365, -225], [365, -225], [-365, 205], [365, 205]],
      // Layout 1: 南北迎宾回廊火盆
      [[-180, -235], [180, -235], [-290, 195], [290, 195]],
      // Layout 2: 东西侧翼双列火盆
      [[-385, -110], [-385, 95], [385, -110], [385, 95]],
      // Layout 3: 内环菱形祭祀火盆
      [[-280, -175], [280, -175], [-340, 40], [340, 40]],
      // Layout 4: 精英角斗场六芒火盆
      [[-375, -220], [375, -220], [-390, 0], [390, 0], [-350, 210], [350, 210]],
      // Layout 5: 交错斜阵火盆
      [[-330, -210], [220, -210], [-220, 185], [330, 185]],
      // Layout 6: 北侧高台拱卫火盆
      [[-250, -230], [0, -235], [250, -230], [-360, 170], [360, 170]],
      // Layout 7: 四象对称双火盆阵
      [[-360, -180], [360, -180], [-200, -225], [200, -225], [-350, 195], [350, 195]]
    ];
    const coords = brazierLayouts[layoutPattern % brazierLayouts.length];
    for (const [bx, by] of coords) {
      this.combatSystem.mapSystem.destructibles.push(new Destructible(bx, by));
    }
  }

  /**
   * 按 8 套房间战术蓝图布置差异化的《地牢类》地刺阵、喷火柱、炼金炸药桶与诅咒血箱
   */
  private spawnRoomTrapsAndCursedChest(roomNumber: number, type: RoomType, layoutPattern = 0): void {
    const pat = layoutPattern % 8;
    const traps: DungeonTrap[] = [];
    let nextId = 1;

    const addSpike = (x: number, y: number, phaseOffset: number, radius = 44) => {
      traps.push({
        id: nextId++,
        kind: 'SPIKE_PLATE',
        x,
        y,
        radius,
        cycleTimer: phaseOffset % 3.2,
        active: true,
        hp: 999
      });
    };

    const addBarrel = (x: number, y: number, phaseOffset = 0) => {
      traps.push({
        id: nextId++,
        kind: 'EXPLOSIVE_BARREL',
        x,
        y,
        radius: 20,
        cycleTimer: phaseOffset,
        active: true,
        hp: 1
      });
    };

    const addFlame = (x: number, y: number, phaseOffset = 0.5) => {
      traps.push({
        id: nextId++,
        kind: 'FLAME_PILLAR',
        x,
        y,
        radius: 34,
        cycleTimer: phaseOffset % 3.2,
        active: true,
        hp: 999
      });
    };

    switch (pat) {
      case 0:
        // 布局 0：【十字回廊绞杀阵】中央十字四向地刺（顺时针轮流弹出）+ 两侧炸药桶
        addSpike(0, -118, 0.0, 44);
        addSpike(168, -8, 0.8, 44);
        addSpike(0, 96, 1.6, 44);
        addSpike(-168, -8, 2.4, 44);
        addBarrel(-290, -90, 0.0);
        addBarrel(290, 85, 0.9);
        break;

      case 1:
        // 布局 1：【交错斜向地刺走廊】双排斜交地刺走廊 + 南北炸药桶 + 中央喷火柱
        addSpike(-220, -95, 0.0, 42);
        addSpike(-95, 55, 1.1, 42);
        addSpike(95, -95, 0.5, 42);
        addSpike(220, 55, 1.6, 42);
        addBarrel(-195, 135, 0.2);
        addBarrel(195, -165, 1.0);
        if (roomNumber >= 2) addFlame(0, -20, 0.6);
        break;

      case 2:
        // 布局 2：【品字形中枢处刑台】中央紧凑三连大号地刺板 + 四翼炸药桶
        addSpike(-68, -36, 0.2, 46);
        addSpike(68, -36, 0.2, 46);
        addSpike(0, 58, 1.8, 46);
        addBarrel(-250, -30, 0.0);
        addBarrel(250, -30, 0.7);
        addBarrel(0, -175, 1.3);
        break;

      case 3:
        // 布局 3：【五连波浪多米诺地刺带】横贯房间中线的 S 型五连波浪地刺（依次掀起刺浪！）
        addSpike(-260, -55, 0.0, 38);
        addSpike(-130, 22, 0.55, 38);
        addSpike(0, -35, 1.1, 40);
        addSpike(130, 22, 1.65, 38);
        addSpike(260, -55, 2.2, 38);
        addBarrel(-170, -145, 0.3);
        addBarrel(170, 125, 1.1);
        break;

      case 4:
        // 布局 4：【精英角斗场·双火柱与三角地刺阵】
        addSpike(-175, -85, 0.0, 46);
        addSpike(175, -85, 0.0, 46);
        addSpike(0, 45, 1.6, 48);
        addFlame(-120, 35, 0.4);
        addFlame(120, 35, 2.0);
        addBarrel(-270, 110, 0.0);
        addBarrel(270, 110, 0.8);
        break;

      case 5:
        // 布局 5：【四象对称锁魂阵】内四角地刺 + 中央炸药桶簇 + 北侧喷火柱
        addSpike(-185, -105, 0.0, 42);
        addSpike(185, -105, 1.6, 42);
        addSpike(-185, 85, 1.6, 42);
        addSpike(185, 85, 0.0, 42);
        addBarrel(-65, -10, 0.2);
        addBarrel(65, -10, 0.9);
        if (roomNumber >= 2) addFlame(0, -145, 0.8);
        break;

      case 6:
        // 布局 6：【双翼夹击长廊】左右各两块纵向相连地刺带 + 中轴线双喷火柱
        addSpike(-195, -75, 0.3, 42);
        addSpike(-195, 25, 0.9, 42);
        addSpike(195, -75, 1.9, 42);
        addSpike(195, 25, 2.5, 42);
        addBarrel(0, 95, 0.4);
        addBarrel(0, -165, 1.2);
        if (roomNumber >= 2 || type === RoomType.ELITE) {
          addFlame(0, -35, 0.5);
        }
        break;

      default:
        // 布局 7：【星盘六芒地刺阵】外环四枚地刺 + 北翼双喷火柱 + 侧翼炸药桶
        addSpike(-235, -15, 0.0, 42);
        addSpike(235, -15, 0.0, 42);
        addSpike(-110, -125, 1.2, 40);
        addSpike(110, -125, 1.2, 40);
        addSpike(0, 75, 2.2, 44);
        addBarrel(-155, 115, 0.1);
        addBarrel(155, 115, 0.8);
        if (roomNumber >= 2) addFlame(0, -45, 1.4);
        break;
    }

    this.currentRoom.traps = traps;

    // 18% 概率在战斗房刷出【禁忌诅咒血箱】，位置随房间布局动态变化
    if (Math.random() < 0.18) {
      const chestSpots: Array<[number, number]> = [
        [-315, 15],
        [315, 15],
        [-305, -125],
        [305, -125],
        [-310, 115],
        [310, 115],
        [-295, -140],
        [295, -140]
      ];
      const [cx, cy] = chestSpots[pat];
      this.currentRoom.interactables.push({
        id: 'cursed_blood_chest',
        kind: 'CURSED_BLOOD_CHEST',
        x: cx,
        y: cy,
        radius: 32,
        title: '✦ 禁忌诅咒血箱 ✦',
        subtitle: '唤醒血影伏击，立得三选一构筑 + 90金币 + 1重随',
        costGold: 0,
        color: '#f43f5e',
        active: true,
        pulseTimer: 0
      });
    }
  }

  /**
   * 布置商店/铁匠房设施
   */
  private setupShopRoom(): void {
    this.currentRoom.interactables = [
      {
        id: 'shop_relic_box',
        kind: 'SHOP_RELIC_BOX',
        x: -210,
        y: -20,
        radius: 36,
        title: '✦ 奥术构筑圣匣 ✦',
        subtitle: '开启三选一机制遗物 + 赠送1次封印',
        costGold: 60,
        color: '#c084fc',
        active: true,
        pulseTimer: 0
      },
      {
        id: 'shop_upgrade',
        kind: 'SHOP_UPGRADE',
        x: 0,
        y: -20,
        radius: 36,
        title: '✦ 铁匠武器淬炼 ✦',
        subtitle: '主武器直升1级 + 附加[过载]标签',
        costGold: 50,
        color: '#fbbf24',
        active: true,
        pulseTimer: 1.2
      },
      {
        id: 'shop_heal_reroll',
        kind: 'SHOP_HEAL_REROLL',
        x: 210,
        y: -20,
        radius: 36,
        title: '✦ 圣血命运药剂 ✦',
        subtitle: '恢复 65 HP + 获得 2 次重随(Reroll)',
        costGold: 35,
        color: '#34d399',
        active: true,
        pulseTimer: 2.4
      }
    ];
  }

  /**
   * 布置奇遇/事件房设施（二选一互斥祭坛）
   */
  private setupEventRoom(): void {
    this.currentRoom.interactables = [
      {
        id: 'event_blood_pact',
        kind: 'EVENT_BLOOD_PACT',
        x: -155,
        y: -15,
        radius: 40,
        title: '✦ 鲜血契约祭坛 ✦',
        subtitle: '献祭20%当前生命：立即开启三选一机制构筑 + 120金币',
        costGold: 0,
        color: '#ef4444',
        active: true,
        pulseTimer: 0
      },
      {
        id: 'event_star_grace',
        kind: 'EVENT_STAR_GRACE',
        x: 155,
        y: -15,
        radius: 40,
        title: '✦ 星界律令圣泉 ✦',
        subtitle: '完全恢复生命 + 终极技能就绪 + 重随/封印次数+2',
        costGold: 0,
        color: '#38bdf8',
        active: true,
        pulseTimer: 1.5
      }
    ];
  }

  /**
   * 核心主循环更新：波次刷怪、房间清场判定、奖励台交互、出口门选择与墙壁约束
   */
  public update(
    dt: number,
    player: Player,
    onOpenBuildRewardModal: () => void
  ): void {
    this.elapsedSeconds += dt;

    if (this.transitionBannerTimer > 0) {
      this.transitionBannerTimer -= dt;
    }
    if (this.transitionFlashAlpha > 0) {
      this.transitionFlashAlpha = Math.max(0, this.transitionFlashAlpha - dt * 1.8);
    }

    // 1. 强制约束玩家、敌人在当前独立房间的四面城墙内部，并处理投射物墙壁反弹
    this.constrainEntitiesToRoom(player);

    // 1b. 更新《地牢类》房间战术机关（地刺翻转板、喷火柱、高危炼金炸药桶）
    this.updateTraps(dt, player);

    // 2. 若房间处于 ACTIVE_LOCKED（战斗封锁状态），管理预设波次刷怪与清场检测
    if (this.currentRoom.state === RoomState.ACTIVE_LOCKED) {
      if (this.isSpawningWave) {
        this.waveSpawnDelayTimer -= dt;
        if (this.waveSpawnDelayTimer <= 0) {
          this.isSpawningWave = false;
          this.spawnRoomWave(this.currentRoom.currentWave, player);
        }
      } else {
        const activeEnemyCount = this.combatSystem.enemies.filter(e => e.active).length;
        if (activeEnemyCount === 0) {
          if (this.currentRoom.currentWave < this.currentRoom.totalWaves) {
            // 进入下一波次（纯视觉/音效过渡，不再弹出遮挡视线的文字横幅）
            this.currentRoom.currentWave++;
            this.waveSpawnDelayTimer = 0.65;
            this.isSpawningWave = true;
          } else {
            // 所有波次怪物均被击败 -> 房间状态切换为 CLEARED（已清理）！
            this.onRoomCleared(player);
          }
        }
      }
    }

    // 3. 更新并检测房间中央交互物（过关奖励水晶、商店商品、奇遇祭坛）
    for (const item of this.currentRoom.interactables) {
      if (!item.active) continue;
      item.pulseTimer += dt * 3.2;

      const dist = Math.hypot(player.position.x - item.x, player.position.y - item.y);
      if (dist <= item.radius + player.radius) {
        this.handleInteractableTrigger(item, player, onOpenBuildRewardModal);
      }
    }

    // 4. 当房间已清理 (CLEARED) 或为特殊功能房 (SPECIAL) 时，检测玩家是否走进开启的出口门
    if (this.currentRoom.state === RoomState.CLEARED || this.currentRoom.state === RoomState.SPECIAL) {
      for (const door of this.currentRoom.doors) {
        door.pulseTimer += dt * 3;
        if (!door.isOpen) continue;

        const inDoorX = Math.abs(player.position.x - door.x) <= door.width * 0.48;
        const inDoorY = Math.abs(player.position.y - door.y) <= door.height * 0.65;
        if (inDoorX && inDoorY) {
          this.combatSystem.sound.playPortalTransition();
          this.loadRoom(this.currentRoom.roomNumber + 1, door.targetRoomType, player);
          break;
        }
      }
    }
  }

  /**
   * 房间内所有波次怪物被击败后触发：
   * 1. 状态变为 CLEARED
   * 2. 解锁北侧所有通往下一房间的门
   * 3. 概率生成构筑祭坛，并掉落金币
   */
  private onRoomCleared(player: Player): void {
    this.currentRoom.state = RoomState.CLEARED;
    for (const d of this.currentRoom.doors) {
      d.isOpen = true;
    }

    this.combatSystem.sound.playLevelUp();
    this.combatSystem.particleSystem.emitLevelUpFanfare(0, 0);
    this.combatSystem.vacuumAllGems();

    // A boss chest replaces the clear altar; neither reward is guaranteed.
    const rewardChance = this.currentRoom.type === RoomType.ELITE ? 0.60 : 0.35;
    if (!this.combatSystem.bossChestDroppedThisRoom && Math.random() < rewardChance) {
      this.currentRoom.interactables.push({
        id: 'room_clear_reward',
        kind: 'CLEAR_REWARD',
        x: 0,
        y: 0,
        radius: 38,
        title: this.currentRoom.type === RoomType.ELITE
          ? '✦ 精英过关圣物 (三选一构筑) ✦'
          : '✦ 房间清理圣物 (三选一构筑) ✦',
        subtitle: '踏入光圈选择你的多维标签与机制改造词条',
        costGold: 0,
        color: this.currentRoom.type === RoomType.ELITE ? '#fbbf24' : '#38bdf8',
        active: true,
        pulseTimer: 0
      });
    }

    // 金币保留，移除精英房重复赠送的进化宝箱。
    const coinCount = this.currentRoom.type === RoomType.ELITE ? 6 : 3;
    for (let i = 0; i < coinCount; i++) {
      const ang = (i * Math.PI * 2) / coinCount;
      const coin = new DropItem(DropType.GOLD_COIN, Math.cos(ang) * 65, Math.sin(ang) * 65, 15);
      coin.isMagnetized = true;
      this.combatSystem.dropItems.push(coin);
    }
  }

  /**
   * 处理玩家触碰房间中央奖励、商店展台或奇遇祭坛
   */
  private handleInteractableTrigger(
    item: RoomInteractable,
    player: Player,
    onOpenBuildRewardModal: () => void
  ): void {
    if (item.costGold > 0 && player.gold < item.costGold) {
      return; // 金币不足时不触发购买
    }

    if (item.costGold > 0) {
      player.gold -= item.costGold;
    }

    item.active = false;
    if (item.kind === 'SHOP_UPGRADE') {
      this.combatSystem.sound.playShrineInteract('FORGE');
    } else if (item.kind === 'CURSED_BLOOD_CHEST' || item.kind === 'EVENT_BLOOD_PACT') {
      this.combatSystem.sound.playShrineInteract('CURSED');
    } else if (item.kind === 'SHOP_HEAL_REROLL') {
      this.combatSystem.sound.playItemPickup('POTION');
    } else {
      this.combatSystem.sound.playShrineInteract('RELIC');
    }
    this.combatSystem.particleSystem.emitLevelUpFanfare(item.x, item.y);

    switch (item.kind) {
      case 'CLEAR_REWARD':
        onOpenBuildRewardModal();
        break;

      case 'SHOP_RELIC_BOX':
        player.banishesRemaining += 1;
        onOpenBuildRewardModal();
        break;

      case 'SHOP_UPGRADE': {
        const mainWep = player.weapons[0];
        if (mainWep) {
          mainWep.levelUp();
          mainWep.addTag(SkillTag.OVERLOAD);
        }
        break;
      }

      case 'SHOP_HEAL_REROLL':
        player.heal(65);
        player.rerollsRemaining += 2;
        break;

      case 'EVENT_BLOOD_PACT': {
        // 奇遇二选一：触发后关闭另一个祭坛
        for (const other of this.currentRoom.interactables) {
          other.active = false;
        }
        player.hp = Math.max(1, Math.round(player.hp * 0.8));
        player.gold += 120;
        if (player.weapons[0]) {
          player.weapons[0].addTag(SkillTag.OVERLOAD);
        }
        onOpenBuildRewardModal();
        break;
      }

      case 'EVENT_STAR_GRACE': {
        for (const other of this.currentRoom.interactables) {
          other.active = false;
        }
        player.heal(999);
        player.reduceUltimateCooldown(999);
        player.rerollsRemaining += 2;
        player.banishesRemaining += 2;
        break;
      }

      case 'CURSED_BLOOD_CHEST': {
        // 触发诅咒血箱：召唤 6 只血影精锐刺客围攻，并立即奖励 1 次三选一构筑 + 90 金币 + 1 重随
        player.gold += 90;
        player.rerollsRemaining += 1;
        const depth = this.currentRoom.roomNumber;
        const mult = 1.15 + depth * 0.15;
        for (let i = 0; i < 6; i++) {
          const ang = (i * Math.PI * 2) / 6;
          const ex = item.x + Math.cos(ang) * 165;
          const ey = item.y + Math.sin(ang) * 165;
          const ambushEnemy = createEnemy(i % 2 === 0 ? EnemyType.DASHER : EnemyType.GHOST, ex, ey, mult);
          this.combatSystem.addEnemy(ambushEnemy);
        }
        this.combatSystem.camera.triggerShake(9);
        onOpenBuildRewardModal();
        break;
      }
    }
  }

  /**
   * 更新地牢机关陷阱逻辑：地刺穿刺、喷火柱灼烧、炸药桶链式引爆
   */
  private updateTraps(dt: number, player: Player): void {
    for (const trap of this.currentRoom.traps) {
      if (!trap.active) continue;
      const prevTimer = trap.cycleTimer;
      trap.cycleTimer = (trap.cycleTimer + dt) % 3.2;

      if (trap.kind === 'SPIKE_PLATE') {
        // 周期 2.15s 猛烈弹出瞬間：迸发金属寒芒裂痕
        if (prevTimer < 2.15 && trap.cycleTimer >= 2.15) {
          this.combatSystem.particleSystem.emitHit(trap.x, trap.y, '#cbd5e1', 4);
        }

        // 周期 2.15s ~ 2.96s 之间利刺完全弹出，对踏入地刺范围且未处于冲刺/无敌帧的主角造成穿刺伤害（不再伤害敌人）
        const isSpikesUp = trap.cycleTimer >= 2.15 && trap.cycleTimer <= 2.96;
        if (isSpikesUp && !player.isDead && player.iFrameTimer <= 0 && player.dashActiveTimer <= 0) {
          const distToPlayer = Math.hypot(player.position.x - trap.x, player.position.y - trap.y);
          if (distToPlayer <= trap.radius * 0.92 + player.radius * 0.55) {
            const spikeDmg = Math.round(10 + this.currentRoom.roomNumber * 2);
            const actualDmg = player.takeDamage(spikeDmg);
            if (actualDmg > 0) {
              this.combatSystem.damageTextSystem.addPlayerDamage(player.position.x, player.position.y, actualDmg);
              this.combatSystem.sound.playPlayerHurt();
              this.combatSystem.camera.triggerShake(4.5);
              this.combatSystem.particleSystem.emitSlashImpact(
                player.position.x,
                player.position.y,
                -Math.PI / 2 + (Math.random() - 0.5) * 0.4,
                '#ef4444',
                true
              );
            }
          }
        }
      } else if (trap.kind === 'FLAME_PILLAR') {
        // 周期 1.8s ~ 2.8s 喷射旋转火环
        const isFiring = trap.cycleTimer >= 1.8 && trap.cycleTimer <= 2.8;
        const crossedTick = Math.floor(prevTimer * 3) !== Math.floor(trap.cycleTimer * 3);
        if (isFiring && crossedTick) {
          const pos = new Vector2(trap.x, trap.y);
          const fireRadius = 105;
          const victims = this.combatSystem.spatialGrid.queryRadius(pos, fireRadius);
          for (const e of victims) {
            if (!e.active) continue;
            e.burnTimer = 4.5;
            const fireDmg = Math.round(22 + this.currentRoom.roomNumber * 6);
            const killed = e.takeDamage(fireDmg);
            this.combatSystem.damageTextSystem.addDamage(e.position.x, e.position.y, fireDmg, false);
            if (killed) {
              player.kills++;
              this.combatSystem.handleEnemyDeath(e);
            }
          }
        }
      } else if (trap.kind === 'EXPLOSIVE_BARREL') {
        // 检测玩家投射物或冲刺是否击中炼金炸药桶
        let triggered = false;
        for (const proj of this.combatSystem.projectiles) {
          if (proj.active && Math.hypot(proj.position.x - trap.x, proj.position.y - trap.y) <= proj.radius + trap.radius) {
            triggered = true;
            break;
          }
        }
        if (!triggered && player.dashActiveTimer > 0 && Math.hypot(player.position.x - trap.x, player.position.y - trap.y) <= player.radius + trap.radius + 16) {
          triggered = true;
        }

        if (triggered) {
          trap.active = false;
          const blastPos = new Vector2(trap.x, trap.y);
          const blastDmg = Math.round((85 + this.currentRoom.roomNumber * 25) * player.damageMult);
          this.combatSystem.sound.playExplosion(0.55, 520);
          this.combatSystem.camera.triggerShake(10);
          this.combatSystem.particleSystem.emitHit(trap.x, trap.y, '#f97316', 24);

          const victims = this.combatSystem.spatialGrid.queryRadius(blastPos, 150);
          for (const e of victims) {
            if (!e.active) continue;
            e.burnTimer = 5.0;
            const pushDir = e.position.clone().sub(blastPos);
            e.applyKnockback(pushDir, 360);
            const killed = e.takeDamage(blastDmg);
            this.combatSystem.damageTextSystem.addDamage(e.position.x, e.position.y, blastDmg, true);
            if (killed) {
              player.kills++;
              this.combatSystem.handleEnemyDeath(e);
            }
          }
        }
      }
    }
  }

  /**
   * 生成《元气骑士》风格的 8 套房间内部立体战术掩体石柱阵列 (与 8 套地刺布局严格错位互补)
   */
  private generateRoomPillars(layoutPattern: number, biomeIndex: number): RoomPillar[] {
    const r = 28;
    const layouts: Array<Array<[number, number]>> = [
      // Pattern 0: 四象对称圣殿柱阵 (配合中央十字地刺)
      [
        [-265, -145],
        [265, -145],
        [-265, 135],
        [265, 135]
      ],
      // Pattern 1: 南北双门壁垒柱阵 (配合斜向交错地刺走廊)
      [
        [-310, -15],
        [310, -15],
        [-130, -175],
        [130, 155]
      ],
      // Pattern 2: 外扩回廊六柱阵 (配合中央品字形处刑地刺台)
      [
        [-285, -155],
        [285, -155],
        [-325, 45],
        [325, 45],
        [-185, 175],
        [185, 175]
      ],
      // Pattern 3: 交错掩体柱阵 (配合中线 S 型五连波浪地刺带)
      [
        [-245, -165],
        [245, -165],
        [-245, 145],
        [245, 145]
      ],
      // Pattern 4: 首领决斗外环方尖碑 (配合角斗场双火柱与三角地刺阵)
      [
        [-345, -180],
        [345, -180],
        [-345, 175],
        [345, 175]
      ],
      // Pattern 5: 十字翼卫柱阵 (配合内四角对称地刺)
      [
        [-315, -10],
        [315, -10],
        [-110, -185],
        [110, -185]
      ],
      // Pattern 6: 四角重装墩柱 + 侧翼掩体 (配合左右纵向地刺带)
      [
        [-330, -155],
        [330, -155],
        [-330, 145],
        [330, 145],
        [-95, 15],
        [95, 15]
      ],
      // Pattern 7: 宽距弧形圣堂柱阵 (配合星盘六芒地刺阵)
      [
        [-295, -150],
        [295, -150],
        [-280, 150],
        [280, 150]
      ]
    ];

    const coords = layouts[layoutPattern % layouts.length];
    return coords.map(([x, y]) => ({
      x,
      y,
      radius: r,
      variant: biomeIndex
    }));
  }

  /**
   * 按当前房间深度与波次在房间内部生成怪物
   */
  private spawnRoomWave(waveIndex: number, player: Player): void {
    const depth = this.currentRoom.roomNumber;
    const isEliteRoom = this.currentRoom.type === RoomType.ELITE;
    const waveMult = 1.0 + (depth - 1) * 0.28 + (waveIndex - 1) * 0.14;

    // 确定普通怪物池
    const pool: EnemyType[] = [EnemyType.WALKER, EnemyType.DASHER];
    if (depth >= 2) pool.push(EnemyType.SWARMER, EnemyType.RANGED_SPITTER);
    if (depth >= 3) pool.push(EnemyType.SLIME_LARGE, EnemyType.TANK);
    if (depth >= 4) pool.push(EnemyType.GHOST, EnemyType.MINOTAUR);

    const baseCount = isEliteRoom
      ? 10 + depth * 3 + waveIndex * 3
      : 8 + depth * 3 + waveIndex * 4;

    for (let i = 0; i < baseCount; i++) {
      const spawnPos = this.getValidRoomSpawnPos(player.position);
      const chosenType = pool[Math.floor(Math.random() * pool.length)];
      const enemy = createEnemy(chosenType, spawnPos.x, spawnPos.y, waveMult);
      this.combatSystem.addEnemy(enemy);
    }

    // 精英房的最后一波，或每 3 层的最终波次，降临高机动多技能首领 (BOSS_DEMON)；中后期同场刷新 2~3 只不同原型 Boss！
    const isBossFloor = isEliteRoom || depth % 3 === 0;
    if (isBossFloor && waveIndex === this.currentRoom.totalWaves) {
      let bossCount = 1;
      if (depth >= 7 || (depth >= 6 && isEliteRoom)) {
        bossCount = 3;
      } else if (depth >= 4 || (depth === 3 && isEliteRoom)) {
        bossCount = 2;
      }

      const spawnOffsets: Array<[number, number]> =
        bossCount === 1
          ? [[0, -this.halfHeight * 0.42]]
          : bossCount === 2
          ? [
              [-175, -this.halfHeight * 0.38],
              [175, -this.halfHeight * 0.38]
            ]
          : [
              [0, -this.halfHeight * 0.46],
              [-215, -this.halfHeight * 0.22],
              [215, -this.halfHeight * 0.22]
            ];

      // 多 Boss 同场时适度微调单只生命系数，保持高密度弹幕压迫感与爽快击破节奏
      const multiBossScale = bossCount === 1 ? 1.0 : bossCount === 2 ? 0.82 : 0.72;
      const baseVariant = this.currentRoom.biomeIndex % 4;

      for (let bIdx = 0; bIdx < bossCount; bIdx++) {
        const [bx, by] = spawnOffsets[bIdx];
        const bossVariant = (baseVariant + bIdx) % 4;
        const boss = createEnemy(
          EnemyType.BOSS_DEMON,
          bx,
          by,
          waveMult * (isEliteRoom ? 1.15 : 1.0) * multiBossScale,
          bossVariant
        );
        boss.isBoss = true;
        this.combatSystem.addEnemy(boss);
      }
      this.combatSystem.camera.triggerShake(9 + (bossCount - 1) * 2);
    }
  }

  private getValidRoomSpawnPos(playerPos: Vector2): Vector2 {
    const margin = 75;
    for (let attempt = 0; attempt < 18; attempt++) {
      const rx = (Math.random() * 2 - 1) * (this.halfWidth - margin);
      const ry = (Math.random() * 2 - 1) * (this.halfHeight - margin);
      if (Math.hypot(rx - playerPos.x, ry - playerPos.y) < 190) continue;
      let insidePillar = false;
      for (const p of this.currentRoom.pillars) {
        if (Math.hypot(rx - p.x, ry - p.y) < p.radius + 32) {
          insidePillar = true;
          break;
        }
      }
      if (!insidePillar) {
        return new Vector2(rx, ry);
      }
    }
    return new Vector2(0, -this.halfHeight + margin);
  }

  /**
   * 约束角色与敌人在房间墙壁内，处理《元气骑士》立体掩体石柱物理阻挡与弹幕遮挡
   */
  private constrainEntitiesToRoom(player: Player): void {
    const minX = -this.halfWidth + player.radius + 8;
    const maxX = this.halfWidth - player.radius - 8;
    const minY = -this.halfHeight + player.radius + 8;
    const maxY = this.halfHeight - player.radius - 8;

    player.position.x = Math.max(minX, Math.min(maxX, player.position.x));
    player.position.y = Math.max(minY, Math.min(maxY, player.position.y));

    // 立体战术掩体石柱阻挡玩家移动
    for (const p of this.currentRoom.pillars) {
      const dx = player.position.x - p.x;
      const dy = player.position.y - p.y;
      const dist = Math.hypot(dx, dy);
      const minDist = player.radius + p.radius;
      if (dist < minDist && dist > 0.001) {
        const push = (minDist - dist) / dist;
        player.position.x += dx * push;
        player.position.y += dy * push;
      }
    }

    for (const enemy of this.combatSystem.enemies) {
      if (!enemy.active) continue;
      enemy.position.x = Math.max(-this.halfWidth + enemy.radius, Math.min(this.halfWidth - enemy.radius, enemy.position.x));
      enemy.position.y = Math.max(-this.halfHeight + enemy.radius, Math.min(this.halfHeight - enemy.radius, enemy.position.y));

      // 掩体石柱阻挡怪物移动
      for (const p of this.currentRoom.pillars) {
        const dx = enemy.position.x - p.x;
        const dy = enemy.position.y - p.y;
        const dist = Math.hypot(dx, dy);
        const minDist = enemy.radius + p.radius;
        if (dist < minDist && dist > 0.001) {
          const push = (minDist - dist) / dist;
          enemy.position.x += dx * push;
          enemy.position.y += dy * push;
        }
      }
    }

    // 掩体石柱阻挡敌方普通/扇形/风车弹幕（玩家可利用石柱战术躲避 BOSS 弹幕！）
    for (let i = this.combatSystem.enemyProjectiles.length - 1; i >= 0; i--) {
      const ep = this.combatSystem.enemyProjectiles[i];
      if (!ep.active || ep.visualType === 'METEOR_ZONE') continue;
      for (const p of this.currentRoom.pillars) {
        if (Math.hypot(ep.position.x - p.x, ep.position.y - p.y) <= ep.radius + p.radius - 2) {
          ep.active = false;
          this.combatSystem.particleSystem.emitHit(ep.position.x, ep.position.y, ep.color, 3);
          break;
        }
      }
    }

    // 投射物触碰房间边界墙壁时的反弹检测 (Wall Ricochet for Example A & Runetracer)
    for (const proj of this.combatSystem.projectiles) {
      if (!proj.active) continue;

      let hitWallX = false;
      let hitWallY = false;

      if (proj.position.x - proj.radius <= -this.halfWidth) {
        proj.position.x = -this.halfWidth + proj.radius;
        hitWallX = true;
      } else if (proj.position.x + proj.radius >= this.halfWidth) {
        proj.position.x = this.halfWidth - proj.radius;
        hitWallX = true;
      }

      if (proj.position.y - proj.radius <= -this.halfHeight) {
        proj.position.y = -this.halfHeight + proj.radius;
        hitWallY = true;
      } else if (proj.position.y + proj.radius >= this.halfHeight) {
        proj.position.y = this.halfHeight - proj.radius;
        hitWallY = true;
      }

      if (hitWallX || hitWallY) {
        if (proj.wallBounces > 0) {
          proj.wallBounces--;
          if (hitWallX) proj.velocity.x *= -1;
          if (hitWallY) proj.velocity.y *= -1;
          proj.rotation = proj.velocity.angle();
          // 反弹后重置已命中列表并获得轻微伤害与速度增幅
          proj.hitEnemies.clear();
          proj.damage = Math.round(proj.damage * 1.15);
          this.combatSystem.particleSystem.emitHit(proj.position.x, proj.position.y, '#38bdf8', 5);
        }
      }
    }
  }

  /**
   * 渲染独立房间的 5 大生态主题城墙、地砖星盘阵纹、立体战术掩体石柱、壁挂火炬、唯一无标注神秘拱门以及圣物祭坛
   */
  public renderRoomArena(ctx: CanvasRenderingContext2D, _camera: Camera): void {
    const hw = this.halfWidth;
    const hh = this.halfHeight;
    const wt = this.wallThickness;
    const meta = ROOM_TYPE_META[this.currentRoom.type];
    const isLocked = this.currentRoom.state === RoomState.ACTIVE_LOCKED;

    // 5 大主题生态色彩规范 (0: 绯红地牢, 1: 极寒冰渊, 2: 翡翠腐林, 3: 炼狱熔炉, 4: 星界虚空)
    const biomeThemes = [
      {
        wallBase: '#120e1f',
        wallBrick: '#1d1730',
        wallStroke: '#2e254a',
        borderOuter: '#78350f',
        borderUnlocked: '#f59e0b',
        sconceCore: '#fde047',
        sconceMid: 'rgba(251, 191, 36, 0.55)',
        sconceOuter: 'rgba(234, 88, 12, 0.22)',
        rayTop: '186, 230, 253',
        rayMid: '251, 191, 36',
        pillarTop: '#312e48',
        pillarSide: '#181528',
        pillarGem: '#ef4444'
      },
      {
        wallBase: '#071426',
        wallBrick: '#0f233f',
        wallStroke: '#1e3a5f',
        borderOuter: '#0369a1',
        borderUnlocked: '#38bdf8',
        sconceCore: '#e0f2fe',
        sconceMid: 'rgba(56, 189, 248, 0.55)',
        sconceOuter: 'rgba(14, 165, 233, 0.22)',
        rayTop: '224, 242, 254',
        rayMid: '56, 189, 248',
        pillarTop: '#1e3a5f',
        pillarSide: '#0c1e36',
        pillarGem: '#38bdf8'
      },
      {
        wallBase: '#081811',
        wallBrick: '#10281d',
        wallStroke: '#1e4632',
        borderOuter: '#15803d',
        borderUnlocked: '#34d399',
        sconceCore: '#bbf7d0',
        sconceMid: 'rgba(52, 211, 153, 0.52)',
        sconceOuter: 'rgba(16, 185, 129, 0.22)',
        rayTop: '209, 250, 229',
        rayMid: '52, 211, 153',
        pillarTop: '#1f4431',
        pillarSide: '#0d2318',
        pillarGem: '#10b981'
      },
      {
        wallBase: '#1b0b07',
        wallBrick: '#2c130d',
        wallStroke: '#4a2016',
        borderOuter: '#9a3412',
        borderUnlocked: '#f97316',
        sconceCore: '#fef08a',
        sconceMid: 'rgba(249, 115, 22, 0.60)',
        sconceOuter: 'rgba(220, 38, 38, 0.26)',
        rayTop: '254, 240, 138',
        rayMid: '249, 115, 22',
        pillarTop: '#451a11',
        pillarSide: '#240d08',
        pillarGem: '#f97316'
      },
      {
        wallBase: '#110824',
        wallBrick: '#1d103b',
        wallStroke: '#351d66',
        borderOuter: '#6b21a8',
        borderUnlocked: '#c084fc',
        sconceCore: '#f5d0fe',
        sconceMid: 'rgba(192, 132, 252, 0.55)',
        sconceOuter: 'rgba(147, 51, 234, 0.24)',
        rayTop: '243, 232, 255',
        rayMid: '192, 132, 252',
        pillarTop: '#341b61',
        pillarSide: '#190c33',
        pillarGem: '#c084fc'
      }
    ];
    const theme = biomeThemes[this.currentRoom.biomeIndex % biomeThemes.length];

    ctx.save();

    // 1. 房间外部深渊暗影遮罩
    ctx.fillStyle = 'rgba(4, 2, 10, 0.92)';
    ctx.fillRect(-hw - 1000, -hh - 1000, (hw + 1000) * 2, 1000); // Top outside
    ctx.fillRect(-hw - 1000, hh, (hw + 1000) * 2, 1000);         // Bottom outside
    ctx.fillRect(-hw - 1000, -hh, 1000, hh * 2);                 // Left outside
    ctx.fillRect(hw, -hh, 1000, hh * 2);                         // Right outside

    // 2. Static cult paint decal, cached on entry and grounded in the stone material.
    ctx.save();
    this.floorSigil ??= createFloorSigil(this.previousSigil, this.floorSigilSeed, this.currentRoom.biomeIndex);
    ctx.drawImage(this.floorSigil, -220, -220);

    // 地面四向石板走道引导线
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.10)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-hw + 36, -hh + 36, (hw - 36) * 2, (hh - 36) * 2);
    ctx.restore();

    // 2b. 墙体内侧立体环境光遮蔽阴影 (Interior Ambient Occlusion Wall Shadows)
    const shadowDepth = 52;
    const topShad = ctx.createLinearGradient(0, -hh, 0, -hh + shadowDepth);
    topShad.addColorStop(0, 'rgba(2, 1, 8, 0.78)');
    topShad.addColorStop(1, 'rgba(2, 1, 8, 0)');
    ctx.fillStyle = topShad;
    ctx.fillRect(-hw, -hh, hw * 2, shadowDepth);

    const botShad = ctx.createLinearGradient(0, hh, 0, hh - shadowDepth);
    botShad.addColorStop(0, 'rgba(2, 1, 8, 0.78)');
    botShad.addColorStop(1, 'rgba(2, 1, 8, 0)');
    ctx.fillStyle = botShad;
    ctx.fillRect(-hw, hh - shadowDepth, hw * 2, shadowDepth);

    const leftShad = ctx.createLinearGradient(-hw, 0, -hw + shadowDepth, 0);
    leftShad.addColorStop(0, 'rgba(2, 1, 8, 0.78)');
    leftShad.addColorStop(1, 'rgba(2, 1, 8, 0)');
    ctx.fillStyle = leftShad;
    ctx.fillRect(-hw, -hh, shadowDepth, hh * 2);

    const rightShad = ctx.createLinearGradient(hw, 0, hw - shadowDepth, 0);
    rightShad.addColorStop(0, 'rgba(2, 1, 8, 0.78)');
    rightShad.addColorStop(1, 'rgba(2, 1, 8, 0)');
    ctx.fillStyle = rightShad;
    ctx.fillRect(hw - shadowDepth, -hh, shadowDepth, hh * 2);

    // 3. 立体生态主题城墙与石砖砌缝 (3D Beveled Biome Masonry Walls)
    ctx.fillStyle = theme.wallBase;
    ctx.fillRect(-hw - wt, -hh - wt, (hw + wt) * 2, wt); // 北墙
    ctx.fillRect(-hw - wt, hh, (hw + wt) * 2, wt);       // 南墙
    ctx.fillRect(-hw - wt, -hh, wt, hh * 2);             // 西墙
    ctx.fillRect(hw, -hh, wt, hh * 2);                   // 东墙

    // 墙体石砖垛口浮雕细节 (Stone Battlement Crenellations)
    ctx.fillStyle = theme.wallBrick;
    ctx.strokeStyle = theme.wallStroke;
    ctx.lineWidth = 1;
    const brickStep = 64;
    for (let bx = -hw; bx < hw; bx += brickStep) {
      if (Math.abs(bx) > 72) {
        ctx.fillRect(bx + 4, -hh - wt + 6, brickStep - 8, wt - 12);
        ctx.strokeRect(bx + 4, -hh - wt + 6, brickStep - 8, wt - 12);
      }
      ctx.fillRect(bx + 4, hh + 6, brickStep - 8, wt - 12);
      ctx.strokeRect(bx + 4, hh + 6, brickStep - 8, wt - 12);
    }
    for (let by = -hh; by < hh; by += brickStep) {
      ctx.fillRect(-hw - wt + 6, by + 4, wt - 12, brickStep - 8);
      ctx.strokeRect(-hw - wt + 6, by + 4, wt - 12, brickStep - 8);
      ctx.fillRect(hw + 6, by + 4, wt - 12, brickStep - 8);
      ctx.strokeRect(hw + 6, by + 4, wt - 12, brickStep - 8);
    }

    // 城墙双层警戒镶边
    ctx.strokeStyle = theme.borderOuter;
    ctx.lineWidth = 5;
    ctx.strokeRect(-hw - 2, -hh - 2, hw * 2 + 4, hh * 2 + 4);

    ctx.strokeStyle = isLocked ? '#ef4444' : theme.borderUnlocked;
    ctx.lineWidth = 2;
    ctx.strokeRect(-hw, -hh, hw * 2, hh * 2);

    // 四角石雕柱墩与立柱火盆/符文灯塔 (4 Corner Bastion Pillars & Beacon Lanterns)
    const corners = [
      [-hw - wt * 0.5, -hh - wt * 0.5],
      [hw + wt * 0.5, -hh - wt * 0.5],
      [-hw - wt * 0.5, hh + wt * 0.5],
      [hw + wt * 0.5, hh + wt * 0.5]
    ];
    for (let cIdx = 0; cIdx < corners.length; cIdx++) {
      const [cx, cy] = corners[cIdx];
      ctx.fillStyle = theme.wallBase;
      ctx.fillRect(cx - 26, cy - 26, 52, 52);
      ctx.strokeStyle = theme.borderUnlocked;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - 26, cy - 26, 52, 52);

      // 铸铁八角灯座底盘
      ctx.fillStyle = '#090d16';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 燃烧/充能灯芯与辉光
      const cFlicker = 0.85 + Math.sin(this.elapsedSeconds * 7 + cIdx * 1.9) * 0.15;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const cg = ctx.createRadialGradient(cx, cy, 2, cx, cy, 34 * cFlicker);
      cg.addColorStop(0, '#ffffff');
      cg.addColorStop(0.35, isLocked ? 'rgba(239, 68, 68, 0.55)' : theme.sconceMid);
      cg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, 34 * cFlicker, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = isLocked ? '#ef4444' : theme.pillarGem;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 9);
      ctx.lineTo(cx + 9, cy);
      ctx.lineTo(cx, cy + 9);
      ctx.lineTo(cx - 9, cy);
      ctx.closePath();
      ctx.fill();
    }

    // 城墙壁挂哥特铸铁灯具 / 壁炉火盆与真实光照投射 (3D Wall-Mounted Gothic Lantern Sconces)
    const sconces: Array<{ x: number; y: number; wall: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT' }> = [
      { x: -260, y: -hh, wall: 'TOP' },
      { x: 260, y: -hh, wall: 'TOP' },
      { x: -260, y: hh, wall: 'BOTTOM' },
      { x: 260, y: hh, wall: 'BOTTOM' },
      { x: -hw, y: -160, wall: 'LEFT' },
      { x: -hw, y: 160, wall: 'LEFT' },
      { x: hw, y: -160, wall: 'RIGHT' },
      { x: hw, y: 160, wall: 'RIGHT' }
    ];
    for (let i = 0; i < sconces.length; i++) {
      this.renderWallLanternSconce(ctx, sconces[i], i, theme);
    }

    // 4. 渲染北侧唯一无标注出口拱门 (Single Unlabeled Mystery Archway)
    for (const door of this.currentRoom.doors) {
      this.renderDoorPortal(ctx, door);
    }

    // 4a. 渲染《元气骑士》立体战术掩体石柱 / 方尖碑 (3D Tactical Cover Pillars)
    for (const pillar of this.currentRoom.pillars) {
      this.renderRoomPillar(ctx, pillar, theme);
    }

    // 4b. 渲染《地牢类》房间战术机关陷阱 (Spike Plates, Flame Pillars, Explosive Barrels)
    for (const trap of this.currentRoom.traps) {
      if (!trap.active) continue;
      this.renderTrap(ctx, trap);
    }

    // 5. 渲染房间中央交互圣物台（过关圣物、铁匠砧台、奇遇圣爵、诅咒血箱）
    for (const item of this.currentRoom.interactables) {
      if (!item.active) continue;
      this.renderInteractable(ctx, item);
    }

    // 6. 渲染穹顶高窗投射在石砖地面上的柔和漫反射光斑与窗棂光印 (Dappled Floor Caustic Pools)
    this.renderFloorGodRayCaustics(ctx, hw, hh, theme);

    ctx.restore();
  }

  /**
   * 获取当前房间生态的体积光配色参数
   */
  private getCurrentBiomeRayTheme(): { rayTop: string; rayMid: string } {
    const rayThemes = [
      { rayTop: '224, 242, 254', rayMid: '251, 191, 36' }, // 0: 绯红地牢 (清冷月华 + 圣金余晖)
      { rayTop: '224, 242, 254', rayMid: '56, 189, 248' }, // 1: 极寒冰渊 (极光冰蓝)
      { rayTop: '220, 252, 231', rayMid: '52, 211, 153' }, // 2: 翡翠腐林 (幽林翠光)
      { rayTop: '254, 240, 138', rayMid: '249, 115, 22' }, // 3: 炼狱熔炉 (炽金火光)
      { rayTop: '243, 232, 255', rayMid: '192, 132, 252' }  // 4: 星界虚空 (星云紫晶)
    ];
    return rayThemes[this.currentRoom.biomeIndex % rayThemes.length];
  }

  /**
   * 第一层（地面层）：在穹顶三束光线落点处绘制石砖地面漫反射光池与哥特三联窗棂柔光斑（位于角色与怪物脚下）
   * 支持随关卡对称随机切换方向（dir === -1: 左上至右下；dir === 1: 右上至左下）
   */
  private renderFloorGodRayCaustics(
    ctx: CanvasRenderingContext2D,
    hw: number,
    hh: number,
    theme: { rayTop: string; rayMid: string }
  ): void {
    const dir = this.currentRayDirSign;
    const shafts = [
      { landX: -275, landY: 65, scale: 0.95, phase: 0.0 },
      { landX: 18, landY: -5, scale: 1.12, phase: 1.7 },
      { landX: 295, landY: 75, scale: 0.92, phase: 3.4 }
    ];

    ctx.save();
    ctx.beginPath();
    ctx.rect(-hw, -hh, hw * 2, hh * 2);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < shafts.length; i++) {
      const s = shafts[i];
      const symLandX = s.landX * -dir;
      const breathe = 0.85 + Math.sin(this.elapsedSeconds * 0.95 + s.phase) * 0.15;
      const rx = 115 * s.scale;
      const ry = 64 * s.scale;

      ctx.save();
      ctx.translate(symLandX, s.landY);
      ctx.rotate(0.18 * dir);

      // 1. 地面宽幅柔和漫反射光池 (Soft Ground Bounce Pool)
      ctx.save();
      ctx.scale(rx, ry);
      const poolGrad = ctx.createRadialGradient(0, 0, 0.05, 0, 0, 1.0);
      poolGrad.addColorStop(0, `rgba(${theme.rayTop}, ${(0.075 * breathe).toFixed(4)})`);
      poolGrad.addColorStop(0.45, `rgba(${theme.rayMid}, ${(0.042 * breathe).toFixed(4)})`);
      poolGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = poolGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2. 哥特高窗三联窗格投射在地面上的柔化光印 (3 Soft Lancet Window Pane Caustics)
      for (let pane = -1; pane <= 1; pane++) {
        const px = pane * 34 * s.scale * -dir;
        const py = pane * 6;
        const panePulse = 0.8 + Math.sin(this.elapsedSeconds * 1.3 + s.phase + pane * 1.1) * 0.2;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(0.42 * dir);
        ctx.scale(16 * s.scale, 38 * s.scale);
        const paneGrad = ctx.createRadialGradient(0, 0, 0.05, 0, 0, 1.0);
        paneGrad.addColorStop(0, `rgba(${theme.rayTop}, ${(0.068 * panePulse).toFixed(4)})`);
        paneGrad.addColorStop(0.55, `rgba(${theme.rayMid}, ${(0.032 * panePulse).toFixed(4)})`);
        paneGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = paneGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * 第二层（空中体积光层，在角色与怪物之上渲染）：
   * 渲染从屋顶高窗斜射而下的三条自然柔化丁达尔体积光束（支持左上->右下与右上->左下随机对称切换）
   */
  public renderCeilingGodRaysOverlay(ctx: CanvasRenderingContext2D): void {
    const hw = this.halfWidth;
    const hh = this.halfHeight;
    const theme = this.getCurrentBiomeRayTheme();
    const t = this.elapsedSeconds;
    const dir = this.currentRayDirSign;

    const shafts = [
      { landX: -275, landY: 65, scale: 0.95, phase: 0.0 },
      { landX: 18, landY: -5, scale: 1.12, phase: 1.7 },
      { landX: 295, landY: 75, scale: 0.92, phase: 3.4 }
    ];

    ctx.save();
    // 严格裁剪在房间四壁内部，避免光线穿出城墙外侧黑底
    ctx.beginPath();
    ctx.rect(-hw, -hh, hw * 2, hh * 2);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < shafts.length; i++) {
      const s = shafts[i];
      const symLandX = s.landX * -dir;
      const breathe = 0.88 + Math.sin(t * 0.95 + s.phase) * 0.12;
      const swayAngle = 0.42 * dir + Math.sin(t * 0.35 + s.phase) * 0.012;
      const shaftHalfLen = 340 * s.scale;
      const shaftHalfW = 78 * s.scale;

      ctx.save();
      ctx.translate(symLandX, s.landY);
      ctx.rotate(swayAngle);

      // 1. 外层宽幅柔化大气散射光幕（使用二维椭圆径向衰减，四面边缘 100% 羽化柔和，绝无生硬多边形切边）
      ctx.save();
      ctx.translate(0, -shaftHalfLen * 0.62);
      ctx.scale(shaftHalfW, shaftHalfLen);
      const envGrad = ctx.createRadialGradient(0, -0.32, 0.02, 0, 0, 1.0);
      envGrad.addColorStop(0, `rgba(${theme.rayTop}, ${(0.065 * breathe).toFixed(4)})`);
      envGrad.addColorStop(0.42, `rgba(${theme.rayMid}, ${(0.038 * breathe).toFixed(4)})`);
      envGrad.addColorStop(0.78, `rgba(${theme.rayMid}, ${(0.014 * breathe).toFixed(4)})`);
      envGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = envGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2. 窗棂分束丁达尔光丝（每道主光束内部由 4 缕粗细错落、缓慢呼吸交织的次级光缕组成，还原真实高窗铁格透光感）
      const subRays = [
        { offsetX: -30, width: 22, lenScale: 0.96, alphaMult: 0.85, speed: 1.1 },
        { offsetX: -9, width: 28, lenScale: 1.04, alphaMult: 1.15, speed: 0.85 },
        { offsetX: 13, width: 24, lenScale: 1.0, alphaMult: 1.0, speed: 1.25 },
        { offsetX: 32, width: 18, lenScale: 0.92, alphaMult: 0.75, speed: 0.95 }
      ];

      for (let sr = 0; sr < subRays.length; sr++) {
        const sub = subRays[sr];
        const symOffsetX = sub.offsetX * -dir;
        const shimmer = 0.72 + Math.sin(t * sub.speed + s.phase + sr * 1.45) * 0.28;
        const alphaTop = 0.068 * sub.alphaMult * shimmer;
        const alphaMid = 0.036 * sub.alphaMult * shimmer;

        ctx.save();
        // 轻微扇形发散角，使光束从屋顶窄窗向下自然微微散开
        const fanAngle = (symOffsetX / 32) * 0.035;
        ctx.rotate(fanAngle);
        ctx.translate(symOffsetX * s.scale, -shaftHalfLen * 0.62 * sub.lenScale);
        ctx.scale(sub.width * s.scale, shaftHalfLen * sub.lenScale);

        const subGrad = ctx.createRadialGradient(0, -0.38, 0.01, 0, 0, 1.0);
        subGrad.addColorStop(0, `rgba(255, 255, 255, ${(alphaTop * 1.15).toFixed(4)})`);
        subGrad.addColorStop(0.24, `rgba(${theme.rayTop}, ${alphaTop.toFixed(4)})`);
        subGrad.addColorStop(0.62, `rgba(${theme.rayMid}, ${alphaMid.toFixed(4)})`);
        subGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = subGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 3. 屋顶高窗入射源头柔光晕 (High Vault Aperture Bloom)
      ctx.save();
      ctx.translate(0, -shaftHalfLen * 1.18);
      ctx.scale(shaftHalfW * 0.72, 42 * s.scale);
      const srcGrad = ctx.createRadialGradient(0, 0, 0.02, 0, 0, 1.0);
      srcGrad.addColorStop(0, `rgba(255, 255, 255, ${(0.14 * breathe).toFixed(4)})`);
      srcGrad.addColorStop(0.45, `rgba(${theme.rayTop}, ${(0.08 * breathe).toFixed(4)})`);
      srcGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = srcGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 4. 光束内部悬浮漂移的丁达尔微尘颗粒 (Illuminated Tyndall Dust Motes)
      const moteCount = 11;
      for (let m = 0; m < moteCount; m++) {
        const seed = i * 31.7 + m * 13.3;
        // 微尘在光束剖面内随微弱气流缓慢起伏漂移
        const normY = ((t * (0.045 + (m % 3) * 0.018) + seed * 0.13) % 1);
        const localY = -shaftHalfLen * 1.15 + normY * (shaftHalfLen * 1.25);
        const driftX = Math.sin(t * (0.6 + (m % 4) * 0.15) + seed) * (shaftHalfW * 0.62);

        // 越靠近光束中心轴与中上段，微尘被照亮得越明显；移出光束边缘则自然隐没
        const radialNorm = Math.abs(driftX) / (shaftHalfW * 0.68);
        const longitudinalEnvelope = Math.sin(normY * Math.PI);
        const radialEnvelope = Math.max(0, 1 - radialNorm * radialNorm);
        const twinkle = 0.65 + Math.sin(t * 2.4 + seed * 2.1) * 0.35;
        const moteAlpha = longitudinalEnvelope * radialEnvelope * twinkle * 0.58;

        if (moteAlpha > 0.03) {
          const moteR = (1.6 + (m % 3) * 0.9) * s.scale;
          const mGrad = ctx.createRadialGradient(driftX, localY, 0.1, driftX, localY, moteR * 2.4);
          mGrad.addColorStop(0, `rgba(255, 255, 255, ${moteAlpha.toFixed(4)})`);
          mGrad.addColorStop(0.45, `rgba(${theme.rayTop}, ${(moteAlpha * 0.65).toFixed(4)})`);
          mGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = mGrad;
          ctx.beginPath();
          ctx.arc(driftX, localY, moteR * 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * 渲染四面城墙壁挂式哥特铸铁灯具/火炬架与定向地面投射光池，使房间四周的光源具备真实严谨的物理与视觉逻辑来源
   */
  private renderWallLanternSconce(
    ctx: CanvasRenderingContext2D,
    sconce: { x: number; y: number; wall: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT' },
    index: number,
    theme: {
      sconceCore: string;
      sconceMid: string;
      sconceOuter: string;
      borderUnlocked: string;
      pillarGem: string;
    }
  ): void {
    const { x, y, wall } = sconce;
    // 计算从墙面向房间内部伸出的单位方向向量
    const inX = wall === 'LEFT' ? 1 : wall === 'RIGHT' ? -1 : 0;
    const inY = wall === 'TOP' ? 1 : wall === 'BOTTOM' ? -1 : 0;
    // 墙面切线向量
    const tanX = -inY;
    const tanY = inX;

    // 提灯炉头悬挂中心点（从墙体向房间内伸出 14px）
    const headX = x + inX * 14;
    const headY = y + inY * 14;
    const flicker = 0.88 + Math.sin(this.elapsedSeconds * 8.5 + index * 1.9) * 0.12;
    const sway = Math.sin(this.elapsedSeconds * 11 + index * 2.3) * 2.2;

    ctx.save();

    // 1. 灯架下方墙根与地面的铸铁投影 (Cast Bracket Shadow)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
    ctx.beginPath();
    ctx.ellipse(headX + inX * 4 + 2, headY + inY * 4 + 4, 11, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. 镶嵌在城墙石砖上的哥特铆钉黑铁背板 (Wall-Mounted Wrought-Iron Escutcheon Plate)
    const plateBaseX = x - inX * 4;
    const plateBaseY = y - inY * 4;
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(plateBaseX + tanX * 12 - inX * 5, plateBaseY + tanY * 12 - inY * 5);
    ctx.lineTo(plateBaseX - tanX * 12 - inX * 5, plateBaseY - tanY * 12 - inY * 5);
    ctx.lineTo(plateBaseX - tanX * 9 + inX * 4, plateBaseY - tanY * 9 + inY * 4);
    ctx.lineTo(plateBaseX + tanX * 9 + inX * 4, plateBaseY + tanY * 9 + inY * 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 背板两侧黄铜固定铆钉
    ctx.fillStyle = '#f59e0b';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(plateBaseX + tanX * 7 * side, plateBaseY + tanY * 7 * side, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. 锻铁悬挑支架与斜拉锁链 (Forged Iron Cantilever Arm & Support Struts)
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - inX * 3, y - inY * 3);
    ctx.lineTo(headX, headY);
    ctx.stroke();

    // 鎏金装饰箍环與斜撑铁链
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x + tanX * 8 - inX * 2, y + tanY * 8 - inY * 2);
    ctx.lineTo(headX, headY);
    ctx.moveTo(x - tanX * 8 - inX * 2, y - tanY * 8 - inY * 2);
    ctx.lineTo(headX, headY);
    ctx.stroke();

    // 4. 六角哥特铁笼提灯/火盆主体 (Hexagonal Caged Sanctuary Brazier Lantern)
    ctx.fillStyle = '#131c2e';
    ctx.strokeStyle = theme.borderUnlocked;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(headX, headY, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 铁笼十字护栏条
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(headX - 8, headY);
    ctx.lineTo(headX + 8, headY);
    ctx.moveTo(headX, headY - 8);
    ctx.lineTo(headX, headY + 8);
    ctx.stroke();

    // 5. 动态多层摇曳灯芯火焰 + 朝向房间内部投射的扇形体积光晕 (Directional Light Cone & Flickering Flame)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // 5a. 向房间内侧地面扩散的柔和照明光扇 (Inward Cast Illumination Pool)
    const poolX = headX + inX * 26;
    const poolY = headY + inY * 26;
    const poolRadius = 82 * flicker;
    const poolGrad = ctx.createRadialGradient(headX, headY, 3, poolX, poolY, poolRadius);
    poolGrad.addColorStop(0, '#ffffff');
    poolGrad.addColorStop(0.22, theme.sconceMid);
    poolGrad.addColorStop(0.62, theme.sconceOuter);
    poolGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = poolGrad;
    ctx.beginPath();
    ctx.arc(poolX, poolY, poolRadius, 0, Math.PI * 2);
    ctx.fill();

    // 5b. 提灯核心三层动态火苗 (Outer Tongue -> Mid Amber -> White-Hot Core)
    ctx.fillStyle = theme.pillarGem;
    ctx.beginPath();
    ctx.moveTo(headX - 5, headY + 2);
    ctx.quadraticCurveTo(headX - 4, headY - 9, headX + sway * 0.8, headY - 13 * flicker);
    ctx.quadraticCurveTo(headX + 4, headY - 9, headX + 5, headY + 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = theme.sconceCore;
    ctx.beginPath();
    ctx.moveTo(headX - 3.2, headY + 1.5);
    ctx.quadraticCurveTo(headX - 2, headY - 6, headX + sway * 0.4, headY - 9 * flicker);
    ctx.quadraticCurveTo(headX + 2, headY - 6, headX + 3.2, headY + 1.5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(headX, headY - 1.5, 2.6, 0, Math.PI * 2);
    ctx.fill();

    // 5c. 提灯周围上升的细微火星微粒 (Rising Lantern Sparks)
    for (let s = 0; s < 2; s++) {
      const sparkProg = ((this.elapsedSeconds * 1.6 + index * 0.37 + s * 0.5) % 1);
      const sx = headX + Math.sin(this.elapsedSeconds * 5 + index + s * 3) * 5;
      const sy = headY - 4 - sparkProg * 16;
      ctx.fillStyle = theme.sconceCore;
      ctx.globalAlpha = (1 - sparkProg) * 0.85;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.3 * (1 - sparkProg * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    ctx.restore();
  }

  /**
   * 渲染《元气骑士》风格 2.5D 立体战术掩体石柱 / 圣殿方尖碑（可阻挡走位与敌方弹幕）
   */
  private renderRoomPillar(
    ctx: CanvasRenderingContext2D,
    p: RoomPillar,
    theme: { pillarTop: string; pillarSide: string; pillarGem: string; borderUnlocked: string }
  ): void {
    ctx.save();
    ctx.translate(p.x, p.y);
    const r = p.radius;

    // 1. 地面立体环境光遮蔽投影 (2.5D Ground Drop Shadow)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.ellipse(4, 10, r * 1.15, r * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. 底座八角石阶基石 (Stepped Plinth Base)
    ctx.fillStyle = '#090d16';
    ctx.fillRect(-r, -r * 0.65, r * 2, r * 1.65);
    ctx.strokeStyle = theme.borderUnlocked;
    ctx.lineWidth = 1.6;
    ctx.strokeRect(-r, -r * 0.65, r * 2, r * 1.65);

    // 3. 2.5D 立柱正面阴影柱身 (Vertical Column Shaft)
    ctx.fillStyle = theme.pillarSide;
    ctx.fillRect(-r * 0.86, -r * 1.15, r * 1.72, r * 1.9);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-r * 0.86, -r * 1.15, r * 1.72, r * 1.9);

    // 4. 柱顶斜切高光台面 (Top Beveled Capital)
    ctx.fillStyle = theme.pillarTop;
    ctx.fillRect(-r * 0.92, -r * 1.28, r * 1.84, r * 1.18);
    ctx.strokeStyle = theme.borderUnlocked;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-r * 0.92, -r * 1.28, r * 1.84, r * 1.18);

    // 顶部高光切面线
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(-r * 0.88, -r * 1.25, r * 1.76, 3);

    // 5. 柱心镶嵌发光能量晶核 / 符文徽记 (Glowing Biome Energy Core)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.85 + Math.sin(this.elapsedSeconds * 4 + p.x * 0.05) * 0.15;
    const gemGrad = ctx.createRadialGradient(0, -r * 0.68, 1, 0, -r * 0.68, r * 0.72 * pulse);
    gemGrad.addColorStop(0, '#ffffff');
    gemGrad.addColorStop(0.45, theme.pillarGem);
    gemGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gemGrad;
    ctx.beginPath();
    ctx.arc(0, -r * 0.68, r * 0.72 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // 菱形晶石切面
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.68 - 7);
    ctx.lineTo(6, -r * 0.68);
    ctx.lineTo(0, -r * 0.68 + 7);
    ctx.lineTo(-6, -r * 0.68);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  /**
   * 渲染暗黑哥特风格地牢战术机关（精锻地刺铁板、黑曜喷火龙柱、炼金颅骨火药桶）
   */
  private renderTrap(ctx: CanvasRenderingContext2D, trap: DungeonTrap): void {
    ctx.save();
    ctx.translate(trap.x, trap.y);

    if (trap.kind === 'SPIKE_PLATE') {
      const t = trap.cycleTimer;
      const isWarning = t >= 1.45 && t < 2.15;
      const isUp = t >= 2.15 && t <= 2.96;
      const isRetracting = t > 2.96 && t <= 3.2;
      const r = trap.radius;

      // 计算平滑的 4 阶段机械地刺伸缩曲线 (0 = 完全缩回, 0.24 = 预警露尖, 1.0~1.16 = 猛烈穿刺弹出)
      let ext = 0;
      if (isWarning) {
        const warnProg = (t - 1.45) / 0.7;
        ext = 0.14 + 0.14 * Math.sin(warnProg * Math.PI * 0.5);
      } else if (isUp) {
        const upElapsed = t - 2.15;
        if (upElapsed < 0.09) {
          // 弹簧瞬间暴起过冲 (Overshoot spring thrust)
          const p = upElapsed / 0.09;
          ext = 0.28 + 0.90 * (1 - Math.pow(1 - p, 3));
        } else {
          ext = 1.0 + Math.max(0, 0.18 * (1 - (upElapsed - 0.09) / 0.12));
        }
      } else if (isRetracting) {
        const retProg = (t - 2.96) / 0.24;
        ext = Math.max(0, 1 - Math.pow(retProg, 1.6));
      }

      // 预警与弹出瞬间的机械震颤偏移
      const tremorX = isWarning ? Math.sin(this.elapsedSeconds * 58 + trap.id) * 1.3 : 0;
      const tremorY = isWarning ? Math.cos(this.elapsedSeconds * 64 + trap.id) * 1.1 : 0;
      ctx.translate(tremorX, tremorY);

      const cut = 10; // 八角斜切边角
      const drawOctagon = (rad: number) => {
        ctx.beginPath();
        ctx.moveTo(-rad + cut, -rad);
        ctx.lineTo(rad - cut, -rad);
        ctx.lineTo(rad, -rad + cut);
        ctx.lineTo(rad, rad - cut);
        ctx.lineTo(rad - cut, rad);
        ctx.lineTo(-rad + cut, rad);
        ctx.lineTo(-rad, rad - cut);
        ctx.lineTo(-rad, -rad + cut);
        ctx.closePath();
      };

      // 1. 地面深凹铸铁基座阴影与外沿斜切装甲框 (2.5D Recessed Octagonal Iron Chassis)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.save();
      ctx.translate(2, 4);
      drawOctagon(r + 2);
      ctx.fill();
      ctx.restore();

      const frameGrad = ctx.createLinearGradient(-r, -r, r, r);
      frameGrad.addColorStop(0, '#334155');
      frameGrad.addColorStop(0.5, '#0f172a');
      frameGrad.addColorStop(1, '#020617');
      ctx.fillStyle = frameGrad;
      drawOctagon(r);
      ctx.fill();

      // 2. 内层下沉式暗黑铁格栅面板 (Recessed Grate Plate)
      const plateGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, r * 0.95);
      plateGrad.addColorStop(0, isUp ? '#2a0a14' : isWarning ? '#29180b' : '#131726');
      plateGrad.addColorStop(1, '#070911');
      ctx.fillStyle = plateGrad;
      drawOctagon(r - 5);
      ctx.fill();

      // 机械十字排水血槽与金属网格刻线
      ctx.strokeStyle = isUp
        ? 'rgba(239, 68, 68, 0.42)'
        : isWarning
        ? 'rgba(245, 158, 11, 0.38)'
        : 'rgba(71, 85, 105, 0.28)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-r + 8, 0);
      ctx.lineTo(r - 8, 0);
      ctx.moveTo(0, -r + 8);
      ctx.lineTo(0, r - 8);
      ctx.stroke();

      // 外框状态辉光描边
      ctx.strokeStyle = isUp ? '#ef4444' : isWarning ? '#f59e0b' : '#475569';
      ctx.lineWidth = isUp ? 2.4 : 1.8;
      drawOctagon(r - 1);
      ctx.stroke();

      // 弹出瞬间的地面气浪冲击环 (Eruption Shockwave Ring)
      if (isUp && t - 2.15 < 0.22) {
        const ringProg = (t - 2.15) / 0.22;
        ctx.save();
        ctx.globalAlpha = (1 - ringProg) * 0.75;
        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 2.2 * (1 - ringProg);
        drawOctagon(r * (0.95 + ringProg * 0.28));
        ctx.stroke();
        ctx.restore();
      }

      // 8 颗立体高光黄铜铆钉
      for (const [rx, ry] of [
        [-r + 12, -r + 5],
        [r - 12, -r + 5],
        [-r + 12, r - 5],
        [r - 12, r - 5],
        [-r + 5, -r + 12],
        [r - 5, -r + 12],
        [-r + 5, r - 12],
        [r - 5, r - 12]
      ]) {
        ctx.fillStyle = '#b45309';
        ctx.beginPath();
        ctx.arc(rx, ry, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.arc(rx - 0.5, ry - 0.5, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. 9 孔哥特立体三棱放血枪刺阵列 (3x3 2.5D Three-Faceted Steel Spikes)
      const spacing = r * 0.51;
      for (let gy = -1; gy <= 1; gy++) {
        for (let gx = -1; gx <= 1; gx++) {
          const sx = gx * spacing;
          const sy = gy * spacing;

          // 3a. 深渊机械矛孔底座与金属套环 (Recessed Socket & Collar)
          ctx.fillStyle = '#02040a';
          ctx.beginPath();
          ctx.ellipse(sx, sy, 6.2, 4.8, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = isUp ? '#f87171' : isWarning ? '#fbbf24' : '#475569';
          ctx.lineWidth = 1.3;
          ctx.stroke();

          // 3b. 预警状态：孔洞深处透出炽红机械蓄力微光
          if (isWarning) {
            const glowGrad = ctx.createRadialGradient(sx, sy, 0.5, sx, sy, 7.5);
            glowGrad.addColorStop(0, '#fef08a');
            glowGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.65)');
            glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = glowGrad;
            ctx.beginPath();
            ctx.arc(sx, sy, 7.5, 0, Math.PI * 2);
            ctx.fill();
          }

          // 3c. 动态伸缩的立体三棱钢刺 (3D Faceted Blade with Shadow & Blood Tip)
          if (ext > 0.02) {
            const spikeH = 23 * ext;
            const baseW = 5.6 * Math.min(1, 0.55 + ext * 0.45);
            const tipY = sy - spikeH;

            // 斜向地面投影 (Cast Shadow on Grate)
            ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
            ctx.beginPath();
            ctx.moveTo(sx - baseW * 0.6, sy + 1);
            ctx.lineTo(sx + spikeH * 0.48, sy - spikeH * 0.25);
            ctx.lineTo(sx + baseW * 0.9, sy + 2);
            ctx.closePath();
            ctx.fill();

            // 左侧背光暗钢切面 (Left Dark-Steel Facet)
            ctx.fillStyle = '#64748b';
            ctx.beginPath();
            ctx.moveTo(sx - baseW, sy + 1.5);
            ctx.lineTo(sx, tipY);
            ctx.lineTo(sx, sy + 3);
            ctx.closePath();
            ctx.fill();

            // 右侧迎光亮银切面 (Right Polished Chrome Facet)
            ctx.fillStyle = '#f1f5f9';
            ctx.beginPath();
            ctx.moveTo(sx, sy + 3);
            ctx.lineTo(sx, tipY);
            ctx.lineTo(sx + baseW, sy + 1.5);
            ctx.closePath();
            ctx.fill();

            // 矛尖寒铁染血涂层 (Crimson Blood-Stained Tip)
            if (ext > 0.35) {
              const bloodY = tipY + spikeH * 0.42;
              const bloodW = baseW * 0.42;
              ctx.fillStyle = '#dc2626';
              ctx.beginPath();
              ctx.moveTo(sx - bloodW, bloodY);
              ctx.lineTo(sx, tipY);
              ctx.lineTo(sx, bloodY + 1.5);
              ctx.closePath();
              ctx.fill();

              ctx.fillStyle = '#f87171';
              ctx.beginPath();
              ctx.moveTo(sx, bloodY + 1.5);
              ctx.lineTo(sx, tipY);
              ctx.lineTo(sx + bloodW, bloodY);
              ctx.closePath();
              ctx.fill();
            }

            // 中央锋利高光脊线 (Central Razor Ridge Highlight)
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.moveTo(sx, sy + 2);
            ctx.lineTo(sx, tipY);
            ctx.stroke();

            // 完全刺出瞬间的矛尖十字寒芒闪光 (Tip Star Glint on Eruption)
            if (isUp && t - 2.15 < 0.16 && gx === 0 && gy === 0) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(sx - 6, tipY - 1, 12, 1.6);
              ctx.fillRect(sx - 0.8, tipY - 6, 1.6, 12);
            }
          }
        }
      }
    } else if (trap.kind === 'FLAME_PILLAR') {
      const isFiring = trap.cycleTimer >= 1.8 && trap.cycleTimer <= 2.8;
      if (isFiring) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const fireGrad = ctx.createRadialGradient(0, 0, 8, 0, 0, 105);
        fireGrad.addColorStop(0, 'rgba(255, 255, 255, 0.88)');
        fireGrad.addColorStop(0.35, 'rgba(251, 191, 36, 0.65)');
        fireGrad.addColorStop(0.7, 'rgba(239, 68, 68, 0.35)');
        fireGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = fireGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 105, 0, Math.PI * 2);
        ctx.fill();

        // 4 道旋转炼狱火舌
        for (let f = 0; f < 4; f++) {
          const fang = this.elapsedSeconds * 5 + (f * Math.PI) / 2;
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, 72, fang, fang + 0.7);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 哥特八角黄铜熔炉柱座
      ctx.fillStyle = '#130f24';
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isFiring ? '#f59e0b' : '#b45309';
      ctx.lineWidth = 3;
      ctx.stroke();

      // 十字喷火龙口浮雕
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-26, -4, 52, 8);
      ctx.fillRect(-4, -26, 8, 52);

      ctx.fillStyle = isFiring ? '#ffffff' : '#ea580c';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
    } else if (trap.kind === 'EXPLOSIVE_BARREL') {
      const pulse = 1 + Math.sin(trap.cycleTimer * 6) * 0.05;
      ctx.scale(pulse, pulse);

      // 炼金爆破法阵警戒圈
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.20)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, 145, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 地面投影
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      ctx.ellipse(2, 18, 16, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // 暗红橡木与黄铜箍炼金火药桶
      const barrelGrad = ctx.createLinearGradient(-15, 0, 15, 0);
      barrelGrad.addColorStop(0, '#450a0a');
      barrelGrad.addColorStop(0.5, '#991b1b');
      barrelGrad.addColorStop(1, '#450a0a');
      ctx.fillStyle = barrelGrad;
      ctx.beginPath();
      ctx.roundRect(-15, -18, 30, 34, 6);
      ctx.fill();

      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 上下双道铆钉黑铁箍
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-15, -11, 30, 4);
      ctx.fillRect(-15, 6, 30, 4);

      // 桶身中央鎏金炼金颅骨徽记（取代生硬的 TNT 文字）
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(0, -2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-3, 1, 6, 4);
      ctx.fillStyle = '#450a0a';
      ctx.fillRect(-2.5, -3, 1.8, 1.8);
      ctx.fillRect(0.8, -3, 1.8, 1.8);

      // 顶部滋滋燃烧的引信火花
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.quadraticCurveTo(4, -24, 7, -23);
      ctx.stroke();

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(7, -23, 3 + Math.sin(this.elapsedSeconds * 20) * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * 渲染唯一的一扇无标注 2.5D 重度光影体块圣所传送门（摒弃简笔线条，采用多层石质浮雕体块、体积光晕与实时粒子渲染，与地牢整体光影质感深度统一）
   */
  private renderDoorPortal(ctx: CanvasRenderingContext2D, door: DoorPortal): void {
    ctx.save();
    ctx.translate(door.x, door.y);

    const w = door.width;   // 112
    const h = door.height;  // 58
    const halfW = w / 2;
    const halfH = h / 2;
    const t = this.elapsedSeconds;

    // 2.5D 圣所厚重尖拱门洞路径
    const traceSanctuaryArch = (inset = 0) => {
      const aw = halfW - inset;
      const ah = halfH - inset * 0.55;
      const springY = -ah * 0.12;
      const apexY = -ah - 15 + inset * 0.85;
      const bottomY = ah + 6 - inset * 0.45;

      ctx.beginPath();
      ctx.moveTo(-aw, bottomY);
      ctx.lineTo(-aw, springY);
      ctx.quadraticCurveTo(-aw * 0.88, apexY + 7, 0, apexY);
      ctx.quadraticCurveTo(aw * 0.88, apexY + 7, aw, springY);
      ctx.lineTo(aw, bottomY);
      ctx.closePath();
    };

    // 1. 地面深邃环境光遮蔽软阴影 (Deep Soft Ground Ambient Occlusion)
    const groundShadow = ctx.createRadialGradient(0, halfH + 14, 12, 0, halfH + 14, halfW + 46);
    groundShadow.addColorStop(0, 'rgba(0, 0, 0, 0.92)');
    groundShadow.addColorStop(0.62, 'rgba(2, 1, 8, 0.64)');
    groundShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = groundShadow;
    ctx.beginPath();
    ctx.ellipse(0, halfH + 14, halfW + 46, 24, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. 三层 3D 浮雕斜切石阶基座（与地图石砖图集同源的高光/暗部立体切面，无简笔描边）
    for (let step = 2; step >= 0; step--) {
      const sw = w + 38 - step * 12;
      const sh = 7;
      const sx = -sw / 2;
      const sy = halfH + 1 + step * 4.5;

      // 石阶暗部灰缝底色
      ctx.fillStyle = '#07060d';
      ctx.fillRect(sx - 1, sy - 1, sw + 2, sh + 2);

      // 石阶主体石板渐变
      const stepGrad = ctx.createLinearGradient(0, sy, 0, sy + sh);
      stepGrad.addColorStop(0, step % 2 === 0 ? '#231f36' : '#1c182c');
      stepGrad.addColorStop(1, '#0e0c18');
      ctx.fillStyle = stepGrad;
      ctx.fillRect(sx, sy, sw, sh);

      // 顶部迎光高光切面与底部深影切面
      ctx.fillStyle = door.isOpen ? 'rgba(233, 213, 255, 0.22)' : 'rgba(255, 255, 255, 0.10)';
      ctx.fillRect(sx, sy, sw, 1.5);
      ctx.fillStyle = '#040308';
      ctx.fillRect(sx, sy + sh - 2, sw, 2);

      // 石砖纵向砌缝
      ctx.fillStyle = 'rgba(4, 3, 8, 0.75)';
      for (const seamX of [-sw * 0.28, 0, sw * 0.28]) {
        ctx.fillRect(seamX - 0.8, sy, 1.6, sh);
      }
    }

    // 3. 厚重 3D 石砌尖拱门廊外框与楔形拱石体块 (3D Sculpted Stone Archway & Voussoirs)
    ctx.save();
    traceSanctuaryArch(-11);
    const outerStoneGrad = ctx.createLinearGradient(0, -halfH - 28, 0, halfH + 12);
    outerStoneGrad.addColorStop(0, '#312b4b');
    outerStoneGrad.addColorStop(0.35, '#1d192e');
    outerStoneGrad.addColorStop(0.8, '#100d1b');
    outerStoneGrad.addColorStop(1, '#07050d');
    ctx.fillStyle = outerStoneGrad;
    ctx.fill();

    // 内层石框深凹阴影台阶 (Recessed Stone Chamfer)
    traceSanctuaryArch(-4);
    const innerChamferGrad = ctx.createLinearGradient(0, -halfH - 20, 0, halfH + 8);
    innerChamferGrad.addColorStop(0, '#090712');
    innerChamferGrad.addColorStop(0.5, '#161226');
    innerChamferGrad.addColorStop(1, '#251f3d');
    ctx.fillStyle = innerChamferGrad;
    ctx.fill();
    ctx.restore();

    // 4. 左右两侧 2.5D 立体石雕墩柱 + 柱顶燃烧圣火盆 (3D Beveled Stone Pylons & Top Braziers)
    for (const side of [-1, 1]) {
      const px = side * (halfW + 10);
      const pw = 20;
      const ph = h + 16;
      const py = -halfH - 6;

      // 墩柱地面与墙面环境光遮蔽阴影
      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      ctx.fillRect(px - pw / 2 + 2, py + 3, pw, ph);

      // 墩柱 4 层堆叠立体石块 (Stacked 3D Masonry Blocks)
      const blockCount = 4;
      const blockH = ph / blockCount;
      for (let b = 0; b < blockCount; b++) {
        const by = py + b * blockH;
        const bx = px - pw / 2;

        ctx.fillStyle = '#07060c';
        ctx.fillRect(bx, by, pw, blockH);

        const blkGrad = ctx.createLinearGradient(bx, by, bx + pw, by);
        blkGrad.addColorStop(0, '#27223d');
        blkGrad.addColorStop(0.5, b % 2 === 0 ? '#1b172b' : '#161324');
        blkGrad.addColorStop(1, '#0c0a14');
        ctx.fillStyle = blkGrad;
        ctx.fillRect(bx + 1, by + 1, pw - 2, blockH - 1.5);

        // 石块左上高光切面与右下暗影切面
        ctx.fillStyle = '#383154';
        ctx.fillRect(bx + 1, by + 1, pw - 2, 1.5);
        ctx.fillRect(bx + 1, by + 1, 1.5, blockH - 2);
        ctx.fillStyle = '#050409';
        ctx.fillRect(bx + 1, by + blockH - 2, pw - 2, 1.5);
      }

      // 墩柱顶部立体挑檐柱头 (3D Stepped Stone Capital)
      ctx.fillStyle = '#2d2747';
      ctx.fillRect(px - 12, py - 5, 24, 6);
      ctx.fillStyle = '#433b66';
      ctx.fillRect(px - 12, py - 5, 24, 1.5);
      ctx.fillStyle = '#080610';
      ctx.fillRect(px - 12, py - 0.5, 24, 1.5);

      // 柱头镶嵌体块火盆与真实体积光晕 (Pylon Sanctuary Brazier & Volumetric Glow)
      const glowY = py - 7;
      const flicker = 0.86 + Math.sin(t * 7.5 + side * 1.7) * 0.14;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const pGlow = ctx.createRadialGradient(px, glowY, 1, px, glowY, 32 * flicker);
      if (door.isOpen) {
        pGlow.addColorStop(0, '#ffffff');
        pGlow.addColorStop(0.32, 'rgba(233, 213, 255, 0.78)');
        pGlow.addColorStop(0.68, 'rgba(139, 92, 246, 0.32)');
      } else {
        pGlow.addColorStop(0, '#fef08a');
        pGlow.addColorStop(0.35, 'rgba(239, 68, 68, 0.72)');
        pGlow.addColorStop(0.72, 'rgba(153, 27, 27, 0.28)');
      }
      pGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = pGlow;
      ctx.beginPath();
      ctx.arc(px, glowY, 32 * flicker, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 5. 门洞内部核心渲染：体积光影、流体星云/炼狱熔岩与粒子特效（严格裁剪在尖拱内部）
    ctx.save();
    traceSanctuaryArch(2);
    ctx.fillStyle = '#020107';
    ctx.fill();
    ctx.clip();

    if (door.isOpen) {
      // =======================================================================
      // OPEN STATE: 深渊星界事件视界、多层体积星云团与漂浮灵魂光尘 (Volumetric Rift)
      // =======================================================================
      const pulse = 0.92 + Math.sin(t * 2.6) * 0.08;

      // 5a. 底层深渊星云体积光场
      ctx.globalCompositeOperation = 'lighter';
      const baseNebula = ctx.createRadialGradient(0, -2, 4, 0, -2, halfW * 1.08 * pulse);
      baseNebula.addColorStop(0, 'rgba(168, 85, 247, 0.65)');
      baseNebula.addColorStop(0.45, 'rgba(109, 40, 217, 0.42)');
      baseNebula.addColorStop(0.78, 'rgba(217, 119, 6, 0.22)');
      baseNebula.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = baseNebula;
      ctx.fillRect(-halfW, -halfH - 20, w, h + 30);

      // 5b. 10 团柔和交叠旋转的体积能量云团（取代生硬的简笔线条，营造 Shader 流体云雾质感）
      const cloudCount = 10;
      for (let c = 0; c < cloudCount; c++) {
        const speed = c % 2 === 0 ? 1.15 : -0.85;
        const orbitR = (10 + (c % 3) * 11) * pulse;
        const ang = t * speed + (c * Math.PI * 2) / cloudCount;
        const cx = Math.cos(ang) * orbitR * 1.15;
        const cy = -2 + Math.sin(ang) * orbitR * 0.78;
        const cloudR = 24 + (c % 3) * 7;

        const cGrad = ctx.createRadialGradient(cx, cy, 1, cx, cy, cloudR);
        if (c % 3 === 0) {
          cGrad.addColorStop(0, 'rgba(243, 232, 255, 0.46)');
          cGrad.addColorStop(0.5, 'rgba(147, 51, 234, 0.24)');
        } else if (c % 3 === 1) {
          cGrad.addColorStop(0, 'rgba(254, 240, 138, 0.36)');
          cGrad.addColorStop(0.5, 'rgba(217, 119, 6, 0.18)');
        } else {
          cGrad.addColorStop(0, 'rgba(186, 230, 253, 0.34)');
          cGrad.addColorStop(0.5, 'rgba(79, 70, 229, 0.20)');
        }
        cGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = cGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, cloudR, 0, Math.PI * 2);
        ctx.fill();
      }

      // 5c. 门心深渊黑洞奇点与吸积盘高光环 (Event-Horizon Void Singularity & Accretion Halo)
      ctx.globalCompositeOperation = 'source-over';
      const horizonR = 24 * pulse;
      const voidGrad = ctx.createRadialGradient(0, -3, 2, 0, -3, horizonR);
      voidGrad.addColorStop(0, '#010005');
      voidGrad.addColorStop(0.52, 'rgba(3, 1, 10, 0.94)');
      voidGrad.addColorStop(0.78, 'rgba(19, 7, 38, 0.55)');
      voidGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = voidGrad;
      ctx.beginPath();
      ctx.ellipse(0, -3, horizonR * 1.15, horizonR * 0.88, 0, 0, Math.PI * 2);
      ctx.fill();

      // 奇点边缘熾白星界吸积光环
      ctx.globalCompositeOperation = 'lighter';
      const ringGrad = ctx.createRadialGradient(0, -3, horizonR * 0.45, 0, -3, horizonR * 1.45);
      ringGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      ringGrad.addColorStop(0.38, 'rgba(255, 255, 255, 0.72)');
      ringGrad.addColorStop(0.58, 'rgba(216, 180, 254, 0.52)');
      ringGrad.addColorStop(0.8, 'rgba(251, 191, 36, 0.24)');
      ringGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = ringGrad;
      ctx.beginPath();
      ctx.ellipse(0, -3, horizonR * 1.45, horizonR * 1.12, 0, 0, Math.PI * 2);
      ctx.fill();

      // 5d. 18 颗带体积光晕的星尘能量微粒向奇点螺旋坍缩 (Volumetric Halo Motes)
      for (let m = 0; m < 18; m++) {
        const mPhase = (t * (0.45 + (m % 3) * 0.12) + m * 0.055) % 1;
        const mDist = (1 - Math.pow(mPhase, 1.3)) * 52;
        const mAng = t * 1.65 + m * 1.1;
        const mx = Math.cos(mAng) * mDist;
        const my = -3 + Math.sin(mAng) * mDist * 0.72;
        const mr = (1 - mPhase * 0.4) * (3.8 + (m % 3) * 1.4);

        const mGrad = ctx.createRadialGradient(mx, my, 0.2, mx, my, mr);
        mGrad.addColorStop(0, '#ffffff');
        mGrad.addColorStop(0.4, m % 3 === 0 ? '#fef08a' : '#e9d5ff');
        mGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = mGrad;
        ctx.globalAlpha = Math.sin(mPhase * Math.PI) * 0.92;
        ctx.beginPath();
        ctx.arc(mx, my, mr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      // =======================================================================
      // CLOSED STATE: 3D 铸铁黑曜封门巨石、圆柱立体铁栏、炼狱熔岩裂隙与升腾余烬
      // =======================================================================
      const lockPulse = 0.82 + Math.sin(t * 3.8) * 0.18;

      // 5a. 深凹黑曜石封门石板与浮雕暗格 (Recessed Obsidian Monolith Slab)
      const slabGrad = ctx.createLinearGradient(0, -halfH - 14, 0, halfH + 8);
      slabGrad.addColorStop(0, '#06040c');
      slabGrad.addColorStop(0.5, '#110b1a');
      slabGrad.addColorStop(1, '#1a0c14');
      ctx.fillStyle = slabGrad;
      ctx.fillRect(-halfW, -halfH - 16, w, h + 24);

      // 门板中央裂缝与底部渗出的炼狱熔岩体积辉光 (Smoldering Magma Fissure Glow)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const magmaGlow = ctx.createRadialGradient(0, halfH * 0.35, 3, 0, halfH * 0.1, halfW * 0.95 * lockPulse);
      magmaGlow.addColorStop(0, 'rgba(254, 240, 138, 0.55)');
      magmaGlow.addColorStop(0.32, 'rgba(239, 68, 68, 0.45)');
      magmaGlow.addColorStop(0.68, 'rgba(153, 27, 27, 0.22)');
      magmaGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = magmaGlow;
      ctx.fillRect(-halfW, -halfH - 16, w, h + 24);
      ctx.restore();

      // 5b. 3D 圆柱高光金属落闸铁柱（每根铁柱均带投影与圆柱立体金属渐变，杜绝平面简笔感）
      for (let barX = -halfW + 14; barX <= halfW - 14; barX += 14) {
        const bw = 6;
        const bx = barX - bw / 2;
        const by = -halfH - 16;
        const bh = h + 22;

        // 铁柱投射在黑曜石板上的深影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
        ctx.fillRect(bx + 2, by, bw, bh);

        // 3D 圆柱体金属受光渐变
        const barGrad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        barGrad.addColorStop(0, '#060911');
        barGrad.addColorStop(0.32, '#334155');
        barGrad.addColorStop(0.52, '#64748b');
        barGrad.addColorStop(0.82, '#1e293b');
        barGrad.addColorStop(1, '#04060c');
        ctx.fillStyle = barGrad;
        ctx.fillRect(bx, by, bw, bh);
      }

      // 5c. 上下两道 3D 铆钉黑铁横梁 (3D Beveled Iron Crossbeams & Specular Rivets)
      for (const beamY of [-11, 11]) {
        const bh = 8;
        const by = beamY - bh / 2;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
        ctx.fillRect(-halfW, by + 2.5, w, bh);

        const beamGrad = ctx.createLinearGradient(0, by, 0, by + bh);
        beamGrad.addColorStop(0, '#334155');
        beamGrad.addColorStop(0.45, '#1e293b');
        beamGrad.addColorStop(1, '#070a12');
        ctx.fillStyle = beamGrad;
        ctx.fillRect(-halfW, by, w, bh);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.fillRect(-halfW, by, w, 1.4);

        // 立体金属铆钉
        for (let rx = -halfW + 14; rx <= halfW - 14; rx += 14) {
          ctx.fillStyle = '#090d16';
          ctx.beginPath();
          ctx.arc(rx + 0.8, beamY + 0.8, 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#94a3b8';
          ctx.beginPath();
          ctx.arc(rx, beamY, 1.9, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 5d. 门心深渊血蚀封印浮雕轮盘与体积熔岩火核 (3D Sculpted Blood-Eclipse Core)
      const sealShadow = ctx.createRadialGradient(0, 0, 4, 0, 0, 26);
      sealShadow.addColorStop(0, 'rgba(0, 0, 0, 0.92)');
      sealShadow.addColorStop(0.65, 'rgba(15, 3, 9, 0.65)');
      sealShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = sealShadow;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fill();

      // 铸铁浮雕底座圆盘
      const discGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, 15);
      discGrad.addColorStop(0, '#475569');
      discGrad.addColorStop(0.55, '#1e293b');
      discGrad.addColorStop(1, '#060911');
      ctx.fillStyle = discGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();

      // 封印核心体积血焰与升腾余烬微粒 (Volumetric Blood Core & Rising Hellfire Embers)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const coreGlow = ctx.createRadialGradient(0, 0, 1, 0, 0, 22 * lockPulse);
      coreGlow.addColorStop(0, '#ffffff');
      coreGlow.addColorStop(0.28, '#fef08a');
      coreGlow.addColorStop(0.58, 'rgba(239, 68, 68, 0.82)');
      coreGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(0, 0, 22 * lockPulse, 0, Math.PI * 2);
      ctx.fill();

      // 14 颗从门缝与火核升腾的炼狱火星余烬
      for (let eIdx = 0; eIdx < 14; eIdx++) {
        const eProg = (t * (0.55 + (eIdx % 3) * 0.18) + eIdx * 0.07) % 1;
        const ex = ((eIdx * 17) % (w - 24)) - (halfW - 12) + Math.sin(t * 3 + eIdx) * 5;
        const ey = halfH + 4 - eProg * (h + 16);
        const er = (1 - eProg * 0.5) * (3.2 + (eIdx % 2) * 1.4);
        const eGrad = ctx.createRadialGradient(ex, ey, 0.2, ex, ey, er);
        eGrad.addColorStop(0, '#fef08a');
        eGrad.addColorStop(0.45, 'rgba(239, 68, 68, 0.78)');
        eGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = eGrad;
        ctx.globalAlpha = Math.sin(eProg * Math.PI) * 0.88;
        ctx.beginPath();
        ctx.arc(ex, ey, er, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();

    // 6. 门洞内沿环境光遮蔽暗影圈 + 拱顶 3D 浮雕拱心石 (Inner AO Vignette & 3D Sculpted Keystone)
    ctx.save();
    traceSanctuaryArch(2);
    ctx.clip();
    const innerAo = ctx.createRadialGradient(0, 0, halfW * 0.45, 0, 0, halfW * 1.05);
    innerAo.addColorStop(0, 'rgba(0, 0, 0, 0)');
    innerAo.addColorStop(0.75, 'rgba(0, 0, 0, 0.35)');
    innerAo.addColorStop(1, 'rgba(2, 1, 8, 0.85)');
    ctx.fillStyle = innerAo;
    ctx.fillRect(-halfW, -halfH - 20, w, h + 30);
    ctx.restore();

    // 7. 门前地面投射体积光毯与丁达尔光束 (Volumetric Threshold Light Cascade)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (door.isOpen) {
      // 从开启的传送门向外倾泻的地面体积光扇
      const coneGrad = ctx.createLinearGradient(0, halfH - 6, 0, halfH + 54);
      coneGrad.addColorStop(0, 'rgba(233, 213, 255, 0.42)');
      coneGrad.addColorStop(0.45, 'rgba(139, 92, 246, 0.22)');
      coneGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(-halfW + 6, halfH);
      ctx.lineTo(halfW - 6, halfH);
      ctx.lineTo(halfW + 34, halfH + 54);
      ctx.lineTo(-halfW - 34, halfH + 54);
      ctx.closePath();
      ctx.fill();
    } else {
      // 封锁状态：石阶表面的暗红熔岩微光反射
      const lockSpill = ctx.createRadialGradient(0, halfH + 6, 2, 0, halfH + 12, 46);
      lockSpill.addColorStop(0, 'rgba(239, 68, 68, 0.25)');
      lockSpill.addColorStop(0.55, 'rgba(153, 27, 27, 0.10)');
      lockSpill.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = lockSpill;
      ctx.beginPath();
      ctx.ellipse(0, halfH + 10, 48, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 8. 拱顶中央 3D 浮雕楔形拱心石 (3D Beveled Keystone Block)
    const ky = -halfH - 17;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.beginPath();
    ctx.moveTo(0, ky - 8);
    ctx.lineTo(13, ky - 2);
    ctx.lineTo(9, ky + 11);
    ctx.lineTo(-9, ky + 11);
    ctx.lineTo(-13, ky - 2);
    ctx.closePath();
    ctx.fill();

    const keyGrad = ctx.createLinearGradient(-12, ky - 8, 12, ky + 10);
    keyGrad.addColorStop(0, '#3b3358');
    keyGrad.addColorStop(0.5, '#221d36');
    keyGrad.addColorStop(1, '#0d0b16');
    ctx.fillStyle = keyGrad;
    ctx.beginPath();
    ctx.moveTo(0, ky - 9);
    ctx.lineTo(12, ky - 3);
    ctx.lineTo(8, ky + 9);
    ctx.lineTo(-8, ky + 9);
    ctx.lineTo(-12, ky - 3);
    ctx.closePath();
    ctx.fill();

    // 拱心石能量晶核高光
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const kGem = ctx.createRadialGradient(0, ky, 0.5, 0, ky, 10);
    kGem.addColorStop(0, '#ffffff');
    kGem.addColorStop(0.45, door.isOpen ? 'rgba(216, 180, 254, 0.85)' : 'rgba(239, 68, 68, 0.85)');
    kGem.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = kGem;
    ctx.beginPath();
    ctx.arc(0, ky, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  /**
   * 渲染具有独立哥特圣物雕塑造型的交互祭坛与黑曜石鎏金铭牌
   */
  private renderInteractable(ctx: CanvasRenderingContext2D, item: RoomInteractable): void {
    ctx.save();
    ctx.translate(item.x, item.y);

    const bob = Math.sin(item.pulseTimer) * 4;

    // 1. 地面哥特八芒星圣光法阵
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const auraR = item.radius + Math.sin(item.pulseTimer * 1.5) * 3;
    ctx.strokeStyle = item.color;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 6, auraR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 6, auraR * 0.76, 0, Math.PI * 2);
    ctx.stroke();

    const glow = ctx.createRadialGradient(0, 4, 2, 0, 4, item.radius * 1.35);
    glow.addColorStop(0, item.color);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 4, item.radius * 1.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. 黑曜石雕刻祭坛底座 (Carved Stone Altar Pedestal)
    ctx.fillStyle = '#130f22';
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(-18, 2, 36, 12, 3);
    ctx.fill();
    ctx.stroke();

    // 3. 根据圣物类型绘制专属哥特雕塑 (Bespoke Gothic Reliquary Sculpture)
    ctx.save();
    ctx.translate(0, -12 + bob);

    switch (item.kind) {
      case 'SHOP_UPGRADE': {
        // 铁匠黑曜石铁砧与熔火符文战锤
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-16, 6);
        ctx.lineTo(16, 6);
        ctx.lineTo(11, 14);
        ctx.lineTo(-11, 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 悬浮锻造神锤
        ctx.rotate(-0.35 + Math.sin(item.pulseTimer * 2) * 0.15);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-2, -12, 4, 18);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-10, -16, 20, 8);
        break;
      }

      case 'SHOP_HEAL_REROLL': {
        // 哥特鎏金圣血水晶瓶
        ctx.fillStyle = '#10b981';
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, 2, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(-4, -14, 8, 6);
        // 十字圣印
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-5, 0, 10, 3);
        ctx.fillRect(-1.5, -3.5, 3, 10);
        break;
      }

      case 'EVENT_BLOOD_PACT': {
        // 猩红双角献祭圣爵 (Crimson Blood Chalice)
        ctx.fillStyle = '#991b1b';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, -4, 12, 0, Math.PI, false);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-3, 6, 6, 8);
        ctx.fillRect(-9, 12, 18, 3);
        // 升腾血珠
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, -10, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'EVENT_STAR_GRACE': {
        // 星界三环浑天仪 (Celestial Astrolabe)
        ctx.strokeStyle = '#7dd3fc';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#fde047';
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 6, item.pulseTimer * 0.6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'CURSED_BLOOD_CHEST':
      case 'SHOP_RELIC_BOX': {
        // 锁链封印圣物秘匣 (Chained Reliquary Coffer)
        ctx.fillStyle = item.kind === 'CURSED_BLOOD_CHEST' ? '#4c0519' : '#2e1065';
        ctx.strokeStyle = item.kind === 'CURSED_BLOOD_CHEST' ? '#f43f5e' : '#fbbf24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-14, -8, 28, 20, 4);
        ctx.fill();
        ctx.stroke();
        // 中央魔眼/宝石锁扣
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(0, 2, 4.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      default: {
        // CLEAR_REWARD: 圣翼加冕棱镜圣物核
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-20, -4);
        ctx.quadraticCurveTo(-12, -14, -6, 2);
        ctx.moveTo(20, -4);
        ctx.quadraticCurveTo(12, -14, 6, 2);
        ctx.stroke();

        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(12, 0);
        ctx.lineTo(0, 14);
        ctx.lineTo(-12, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        break;
      }
    }
    ctx.restore();

    // 4. 垂直丁达尔圣物光柱 (Volumetric Reliquary Light Beam - 替代原本繁杂的3行中文悬浮字)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const beamGrad = ctx.createLinearGradient(0, 6, 0, -95);
    beamGrad.addColorStop(0, item.color);
    beamGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.14)');
    beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalAlpha = 0.26;
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(-16, 6);
    ctx.lineTo(16, 6);
    ctx.lineTo(26, -95);
    ctx.lineTo(-26, -95);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 仅在需要金币购买时显示极简 3D 价格铭牌 (Zero verbose text clutter)
    if (item.costGold > 0) {
      ctx.fillStyle = 'rgba(9, 13, 22, 0.92)';
      ctx.beginPath();
      ctx.roundRect(-22, 18, 44, 15, 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f8fafc';
      ctx.font = '600 10px ui-monospace, "SF Mono", -apple-system, sans-serif';
      ctx.fillText(`${item.costGold}G`, 0, 26);
    }

    ctx.restore();
  }

  /**
   * 渲染极简立体层数徽章与波次宝石指示器
   */
  public renderRoomOverlayHUD(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const room = this.currentRoom;
    const meta = ROOM_TYPE_META[room.type];

    ctx.save();

    // 房间切换瞬间柔和暗影过渡
    if (this.transitionFlashAlpha > 0) {
      ctx.fillStyle = `rgba(6, 4, 14, ${this.transitionFlashAlpha * 0.85})`;
      ctx.fillRect(0, 0, width, height);
    }

    // 极简 3D 浮雕层数铭牌与波次菱形晶石（当存在活跃首领时自动下移，礼让顶部全屏首领血条 HUD）
    const hasActiveBoss = this.combatSystem.enemies.some(e => e.isBoss && e.active);
    const badgeW = 96;
    const badgeH = 22;
    const bx = width / 2 - badgeW / 2;
    const by = hasActiveBoss ? 142 : 56;

    // 立体投影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(bx + 1, by + 3, badgeW, badgeH, 5);
    ctx.fill();

    // 3D 斜切黑曜金属底壳
    const plateGrad = ctx.createLinearGradient(bx, by, bx, by + badgeH);
    plateGrad.addColorStop(0, '#1e293b');
    plateGrad.addColorStop(1, '#090d16');
    ctx.fillStyle = plateGrad;
    ctx.beginPath();
    ctx.roundRect(bx, by, badgeW, badgeH, 5);
    ctx.fill();

    ctx.strokeStyle = room.state === RoomState.ACTIVE_LOCKED ? 'rgba(239, 68, 68, 0.6)' : 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", ui-monospace, sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(t(`第 ${room.roomNumber} 层`, `FLOOR ${room.roomNumber}`), width / 2, by + 11.5);

    // 波次立体切面晶石指示点 (3D Faceted Wave Pips - 无需任何汉字即可直观感知波次进度)
    if (room.totalWaves > 0) {
      const pipSpacing = 16;
      const startPipX = width / 2 - ((room.totalWaves - 1) * pipSpacing) / 2;
      const pipY = by + badgeH + 10;

      for (let wIdx = 1; wIdx <= room.totalWaves; wIdx++) {
        const px = startPipX + (wIdx - 1) * pipSpacing;
        const isCleared =
          room.state === RoomState.CLEARED || wIdx < room.currentWave;
        const isCurrent =
          room.state === RoomState.ACTIVE_LOCKED && wIdx === room.currentWave;

        ctx.save();
        ctx.translate(px, pipY);
        // 晶石底座暗影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(5, 1);
        ctx.lineTo(0, 6);
        ctx.lineTo(-5, 1);
        ctx.closePath();
        ctx.fill();

        // 晶石立体填充
        ctx.fillStyle = isCleared
          ? '#4ade80'
          : isCurrent
          ? '#ef4444'
          : '#1e293b';
        ctx.strokeStyle = isCleared
          ? '#bbf7d0'
          : isCurrent
          ? '#fca5a5'
          : '#475569';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(4.5, 0);
        ctx.lineTo(0, 5);
        ctx.lineTo(-4.5, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    } else {
      // 特殊房间单颗发光星钻
      ctx.save();
      ctx.translate(width / 2, by + badgeH + 10);
      ctx.fillStyle = meta.themeColor;
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(5, 0);
      ctx.lineTo(0, 5);
      ctx.lineTo(-5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }
}
