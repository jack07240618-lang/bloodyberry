# Bloodyberry — 项目架构与开发交接文档 (Claude Reference Guide)

本文件为 **Bloodyberry（血莓圣殿）** 的完整工程架构、核心玩法系统、视觉光影规范、程序化音频引擎与审美约束总结，供 Claude 及后续开发者快速接手与扩展。

---

## 一、项目概览与技术栈

- **项目路径**：`/Users/liangdongqchen/Downloads/Bloodyberry`
- **永久在线试玩地址 (GitHub Pages)**：`https://jack07240618-lang.github.io/bloodyberry/`
- **Git 仓库**：`https://github.com/jack07240618-lang/bloodyberry.git`（主分支 `master`，部署分支 `gh-pages`）
- **核心技术栈**：
  - **语言与构建**：TypeScript (`strict: true`) + Vite 6
  - **图形渲染**：纯原生 **HTML5 Canvas 2D** 程序化矢量与径向/线性渐变光影管线 + 可选 `WebGLPostProcessor` 后处理
  - **音频系统**：纯原生 **Web Audio API** 实时程序化合成器（`SoundSynthesizer.ts`）
  - **零外部静态资源依赖**：项目内所有角色、怪物、Boss、哥特建筑、体积光、传送门、粒子特效、BGM 与音效均为 **100% 纯代码实时合成与绘制**，不依赖任何外部 PNG/MP3 文件，保证极速加载与 60 FPS 满帧运行。

---

## 二、核心设计哲学与用户审美规范（重要！修改时请严格遵守）

1. **压迫感源于光影而非浮夸 UI（Minimalist UI, Maximum Optical Atmosphere）**
   - **禁止**在屏幕正上方绘制臃肿的巨型全屏 Boss 血条，也**禁止**在 Boss 出场时弹出遮挡视野的大字警报横幅。
   - Boss 的压迫感完全通过 **动态光影对比** 来塑造：
     - Boss 降临与在场时，全场环境自动进入深渊蚀变暗角（`bossEclipseFactor`），并通过 [`UIManager.renderBossEclipseLightingPulse`](src/ui/UIManager.ts) 产生纯光影呼吸脉动；
     - 每个 Boss 全程笼罩在斜射而下的**专属天顶聚光灯柱（Overhead Eclipse Spotlight）**与高对比度边缘体积光（Rim-Light Halo）中，脚下带有吞噬地面光线的深渊蚀变暗影池；
     - Boss 血条仅保留头顶紧凑精炼的极简黑曜金血条（[`Enemy.renderBossHealthBar`](src/enemies/Enemy.ts)，`76px × 5px`），带白金受击残影（Lag Gauge）与二阶段（HP < 50%）熔岩金变色。
2. **拒绝简笔画线条，追求 2.5D 体积渲染质感（Volumetric 2.5D Shading）**
   - 场景物件与特效严禁只用单薄的 `stroke()` 线条勾勒，必须具备 **高光、漫反射、环境光遮蔽（AO）与 `'lighter'` 发光层**。
   - **传送门（[`RoomManager.renderDoorPortal`](src/systems/RoomManager.ts) / [`MapSystem.renderMysteryDoor`](src/systems/MapSystem.ts)）**：采用多层黑曜石立体阶梯底座、立体拱门柱体明暗渐变、地面体积漫反射光池、多层反向旋转星云旋涡（开启态）或交叉立体熔岩锁链与脉冲封印核心（封印态）。
   - **墙壁光源合理性（[`RoomManager.renderWallLanternSconce`](src/systems/RoomManager.ts)）**：房间四周的亮光均由安装在四壁石墙上的**哥特铸铁壁挂提灯**提供物理逻辑支撑（含锻铁支架、菱形玻璃灯笼、跳动多层火苗及向外投射的扇形暖光锥）。
   - **穹顶三束丁达尔体积光（[`RoomManager.renderFloorGodRayCaustics`](src/systems/RoomManager.ts) & [`RoomManager.renderCeilingGodRaysOverlay`](src/systems/RoomManager.ts)）**：
     - 严禁画成生硬的梯形/多边形！必须使用 `ctx.scale(rx, ry)` + `createRadialGradient` 二维高斯椭圆径向衰减，实现四面边缘 100% 羽化融合；
     - 分为地面层（角色脚下的石砖漫反射光池与哥特三联窗棂光印）与空中层（主光幕、4 缕窗棂分束丁达尔光丝、屋顶入射光晕、内部随气流缓慢漂浮闪烁的丁达尔微尘颗粒）；
     - **方向随机对称切换**：每进入新关卡时，`currentRayDirSign` 随机在 `-1`（左上角斜射向右下角）与 `+1`（右上角斜射向左下角）之间对称切换。
   - **不规则有机血水渍（[`MapSystem.renderOrganicBloodPuddle`](src/systems/MapSystem.ts)）**：
     - 击杀敌人后留下的地面血迹使用 10~14 个极坐标控制点配合**三段闭合贝塞尔曲线（Cubic Bezier）**绘制出带张力凸起的不规则水渍形态，配合偏心液体厚度渐变、表面湿润高光弧以及周围飞溅小液滴。

---

## 三、目录结构与核心模块职责

```text
src/
├── main.ts                        # 游戏主入口、GameState 状态机、分层渲染管线调度、顿帧(hitStop)控制
├── core/
│   ├── GameLoop.ts                # 固定时间步长 / requestAnimationFrame 主循环
│   ├── Camera.ts                  # 视口跟随平滑插值、屏幕震动(shake)、可见性裁剪(isVisible)
│   ├── Input.ts                   # 键盘(WASD/方向键/快捷键)与鼠标坐标输入管理
│   ├── Vector2.ts                 # 2D 向量数学库
│   ├── SpatialHashGrid.ts         # 空间哈希网格（加速海量怪群与投射物碰撞检测）
│   ├── I18n.ts                    # 中英双语国际化词典与辅助函数 t(zh, en)
│   └── SoundSynthesizer.ts        # 纯 Web Audio API 合成器（双级压缩器、6首BGM顺序循环、双套随机交互音效）
├── entities/
│   ├── Entity.ts                  # 实体基类
│   ├── Player.ts                  # 玩家属性、移动、残影冲刺、连杀狂暴、武器与被动槽位管理
│   ├── Destructible.ts            # 哥特火盆等可破坏场景物
│   └── DropItem.ts                # 经验宝石、金币、恢复药水、全屏磁铁、时停怀表、进化宝箱掉落物
├── enemies/
│   ├── Enemy.ts                   # 怪物与 4 大 Boss 行为树、高机动技能、召唤光柱、极简头顶血条与程序化绘制
│   └── EnemyRegistry.ts           # 怪物类型枚举(EnemyType)与基础数值注册表
├── systems/
│   ├── RoomManager.ts             # 《元气骑士》风格地牢房间状态机、波次刷怪、递增组合多Boss、壁挂提灯、传送门与丁达尔光线
│   ├── CombatSystem.ts            # 战斗结算、剑气弹反敌方弹幕(Parry)、Boss延时陨石/扫射激光预警、连杀与暴击伤害
│   ├── MapSystem.ts               # 5大生态地砖纹理、不规则水渍血迹、祭坛/铁匠铺交互物、全局动态光影与Boss聚光灯
│   ├── CompanionSystem.ts         # 「相依」双生灵体伙伴系统（协同跟随/法阵锚定切换、共鸣连线伤害、守护屏障）
│   ├── BuildSystem.ts             # 「羁绊」6大流派共鸣系统（2/4/6件套阶梯光环与特效触发）
│   ├── ParticleSystem.ts          # 战斗受击火星、刀光冲击、死亡爆散、升级圣光等动态粒子池
│   ├── AmbientParticleSystem.ts   # 环境浮尘、角色移动拖尾残影
│   ├── DamageTextSystem.ts        # 浮动伤害数字、暴击放大、弹反/进化专属飘字
│   └── SpawnDirector.ts           # 波次威胁度与刷怪辅助导演系统
├── weapons/
│   ├── Weapon.ts                  # 武器抽象基类与标签(BuildTag)定义
│   ├── Projectile.ts              # 玩家投射物与轨线渲染
│   ├── WeaponRegistry.ts          # 12把主武器注册表与「超武进化(Evolution)」配对表
│   └── implementations/           # 12把具体武器实现（Whip, MagicWand, PiercingDagger, Axe, SpinningOrbs, GarlicAura, FireWand, ChainLightning, HolyWater, Runetracer, CrossBoomerang, Pentagram）
├── passives/
│   └── PassiveRegistry.ts         # 8大被动圣物注册表与属性加成逻辑
├── renderer/
│   ├── SpriteRenderer.ts          # 高精度程序化角色/怪物矢量精灵渲染器
│   └── WebGLPostProcessor.ts      # WebGL 屏幕后处理管线
├── persistence/
│   ├── CharacterSelect.ts         # 4名核心英雄原型与每名角色Lv.5双线后期分化定义
│   └── SaveManager.ts             # LocalStorage 金币、历史最高记录与局外天赋存档
└── ui/
    └── UIManager.ts               # 玻璃拟态 HUD、3栏升级构筑面板、宝箱抽奖、设置面板与角色选择界面
```

---

## 四、主渲染管线层级顺序（`src/main.ts -> renderWorld`）

世界空间（World-Space，受 `camera` 平移影响）到屏幕空间（Screen-Space）的绘制顺序经过严格调校，新增特效时请放置在对应层级：

1. **`mapSystem.renderBackground`** & **`roomManager.renderRoomArenaFloor`**：
   - 绘制当前房间 5 大主题生态（绯红地牢、极寒冰渊、翡翠腐林、炼狱熔炉、星界虚空）的石砖地板、地毯、地刺陷阱、地面交互祭坛；
   - 绘制房间地面层焦散光池 [`renderFloorGodRayCaustics`](src/systems/RoomManager.ts)（位于角色与怪物脚下）。
2. **`mapSystem.renderElements`**：
   - 绘制地面不规则有机血水渍 [`renderOrganicBloodPuddle`](src/systems/MapSystem.ts)、哥特火盆可破坏物。
3. **`roomManager.renderRoomWallsAndDoors`**：
   - 绘制四周立体石墙、壁挂哥特铸铁提灯 [`renderWallLanternSconce`](src/systems/RoomManager.ts)、战术掩体石柱，以及北侧 2.5D 立体体积渲染传送门 [`renderDoorPortal`](src/systems/RoomManager.ts)。
4. **地面预警与法阵层**：
   - `combatSystem.renderGroundTelegraphs`（Boss 陨石轰炸收缩聚焦环、激光扫射预警线、首领讨伐金色冲击波）；
   - `companionSystem.renderTetherAndField`（双生灵体共鸣连线与锚定法阵）。
5. **实体层（Entities）**：
   - 掉落物 `dropItems` -> 怪物与 Boss `enemies`（含召唤降临光柱、脚下蚀变暗影、本体与头顶极简血条） -> 玩家 `player` -> 灵体伙伴 `companionSystem.renderSpirit`。
6. **投射物与战斗粒子层**：
   - 玩家投射物 `projectiles` -> 敌方弹幕 `enemyProjectiles` -> 战斗粒子 `particleSystem` -> 刀光与闪电链 `combatSystem.renderEffects`。
7. **空中丁达尔体积光层（`roomManager.renderCeilingGodRaysOverlay`）**：
   - 在角色与怪物上方叠加屋顶斜射而下的三条高斯羽化丁达尔光束与悬浮微尘，使角色穿行于光束中时产生真实的受光感。
8. **屏幕空间动态光照遮罩层（`mapSystem.renderLighting`）**：
   - 全屏多段暗角（随 Boss 在场加深为深渊蚀变）、玩家双层暖光环、传送门体积点光源、火盆摇曳点光源、投射物微光，以及 **Boss 全程笼罩的斜射聚光灯柱与高对比度边缘辉光**。
9. **浮动伤害数字与 HUD 层（`damageTextSystem.render` & `uiManager.renderHUD`）**。

---

## 五、核心玩法机制说明

### 1. 多 Boss 递增同屏与技能机制（`RoomManager.ts` & `Enemy.ts` & `CombatSystem.ts`）
- **4 类异化 Boss 原型（`bossVariant: 0..3`）**：
  - `0`: 深渊领主 · 玛拉考斯 (Arch-Demon Malakor)
  - `1`: 腐化主教 · 萨尔瓦托 (Corrupted Bishop)
  - `2`: 熔岩督军 · 克洛诺斯 (Molten Warlord)
  - `3`: 虚空行者 · 泽拉图尔 (Void Stalker)
- **多 Boss 同屏递增刷新（[`RoomManager.spawnRoomWave`](src/systems/RoomManager.ts)）**：
  - 第 1~3 关精英房：刷 **1** 只 Boss；
  - 第 4~6 关精英房（及第 5 关起的普通房最终波）：同屏刷出 **2** 只不同原型的 Boss 协同作战；
  - 第 7 关及以上精英房：同屏刷出 **3** 只不同原型的 Boss，形成高强度弹幕与走位压迫。
- **Boss 招式与二阶段狂暴（HP < 50%）**：
  - 具备残影冲刺（Dash）、跳跃重砸（Leap Slam）、猩红月牙重斩（`CRESCENT`）、机械十字飞轮（`STAR`）、深渊追踪魔眼（`HOMING`）、天降陨石预警轰炸（`METEOR_ZONE`）与回旋扫射激光（`LASER_SWEEP`）。
- **剑气弹反（Parry）机制（[`CombatSystem.deflectOrDestroyBulletsInArc`](src/systems/CombatSystem.ts)）**：
  - 玩家的近战挥砍/弧光武器可斩碎或弹反敌方弹幕，将其转化为 `#34d399` 翡翠金友方星弹并触发清脆水晶弹反音效 [`playParry`](src/core/SoundSynthesizer.ts)。

### 2. 音频合成器与 6 首 BGM 顺序循环歌单（`src/core/SoundSynthesizer.ts`）
- **硬件级防爆音架构**：内置 `masterCompressor` 与 `sfxCompressor` 双级动态压限器，并在高频受击/拾取音效上设有 45ms~65ms 智能防抖合并，彻底杜绝多怪同屏爆音。
- **6 首「哥特交响 / 暗潮 / 电影配乐」歌单（[`BGM_STYLE_ORDER`](src/core/SoundSynthesizer.ts)）**：
  1. `BAROQUE` — **♪ Ⅰ. 哥特交响 · 圣堂管风琴 (Gothic Symphony)** *(默认首曲)*
  2. `SYNTHWAVE` — **♪ Ⅱ. 暗潮脉动 · 夜行合成器 (Darkwave Pulse)**
  3. `CINEMATIC_EPIC` — **♪ Ⅲ. 电影交响 · 黯蚀史诗 (Cinematic Epic)**
  4. `GOTHIC_REQUIEM` — **♪ Ⅳ. 哥特安魂曲 · 绯红咏叹 (Gothic Requiem)**
  5. `DARK_INDUSTRIAL` — **♪ Ⅴ. 冷冽暗潮 · 机械深渊 (Cold Darkwave)**
  6. `CINEMATIC_NOCTURNE` — **♪ Ⅵ. 电影夜曲 · 星界审判 (Cinematic Nocturne)**
- **顺序循环与 Boss 战专属切换逻辑**：
  - 常态战斗默认从第 1 首 `BAROQUE` 开始播放；每首曲目完整演奏完一次（128 个十六分音符步长 = 完整 8 小节乐段）后，自动按 `Ⅰ -> Ⅱ -> Ⅲ -> Ⅳ -> Ⅴ -> Ⅵ -> Ⅰ` 的顺序平滑切换到下一首往复循环。
  - **Boss 登场音乐**：当 Boss 降临时，立即触发 [`playBossWarning`](src/core/SoundSynthesizer.ts)（深渊管风琴低频轰鸣 + 三声巴洛克减五度丧钟），同时 `playBGM('BOSS')` 保存当前普通战斗曲目的步长进度 `savedBattleStep`，立即从第 0 步奏响 148 BPM 的高燃 Boss 专属交响曲；当 Boss 被讨伐后，自动恢复 `savedBattleStep` 继续 6 首 BGM 歌单的顺序播放。
- **双套随机触发交互音效（Set A / Set B）**：
  - 局内所有交互动作（[`playShrineInteract`](src/core/SoundSynthesizer.ts) 圣物/铁匠/诅咒祭坛、[`playChestOpen`](src/core/SoundSynthesizer.ts) 开宝箱、[`playPortalTransition`](src/core/SoundSynthesizer.ts) 进出传送门、[`playItemPickup`](src/core/SoundSynthesizer.ts) 金币/药水/遗物拾取、[`playLevelUp`](src/core/SoundSynthesizer.ts) 升级、[`playUIConfirm`](src/core/SoundSynthesizer.ts) UI 确认、[`playParry`](src/core/SoundSynthesizer.ts) 弹反）均内置 **Set A 与 Set B 两套和谐声学变体**，每次触发时按 `Math.random() < 0.5` 随机播放一套。

### 3. 4 大核心角色与双线后期分化（`CharacterSelect.ts` & `UIManager.ts` & `CombatSystem.ts`）
- **极简傻瓜化上手**：开局 4 选 1 职业卡片直接以大字定位徽章（`近战吸血` / `奥术追踪` / `高速影刃` / `爆破轰炸`）与双线分化预览呈现；升级 3 选 1 卡片自动根据当前分化路线高亮 **`★ 推荐`** 角标。
- **Lv.5 命途觉醒二选一（`GameState.BRANCH_SELECT` -> `renderBranchSelectModal`）**：
  1. **安东尼奥 (Antonio · 近战吸血)**：`猩红狂战士`（越残血攻速越快+血爆+击杀回血） / `圣光裁决者`（高护甲+剑气弹反回血并反击追踪圣剑）。
  2. **伊梅尔达 (Imelda · 奥术追踪)**：`永冻星灵`（冻结减速+击杀碎裂追踪冰晶） / `棱镜雷霆`（连锁天雷电弧+弹射棱镜激光大招）。
  3. **杰纳罗 (Gennaro · 高速影刃)**：`千刃幻影`（冲刺留下自动射刀的暗影分身） / `暗影处决者`（高暴击+5层印记爆破处决）。
  4. **阿尔卡 (Arca · 爆破轰炸)**：`末日爆破狂`（超大范围+火球生成持久熔岩火海） / `深渊死灵师`（击杀概率唤出自动追踪死神飞镰收割）。

---

## 六、开发、构建与部署指南

### 1. 本地开发与类型检查
在运行终端命令时，请确保 `/opt/homebrew/bin` 在 `PATH` 中：
```bash
export PATH=$PATH:/opt/homebrew/bin

# 启动本地开发服务器
npm run dev

# 运行 TypeScript 严格类型检查与生产构建（交付前必须确保 0 报错通过）
npm run build
```

### 2. 同步更新至永久在线链接 (`https://jack07240618-lang.github.io/bloodyberry/`)
项目配置了 `.github/workflows/deploy.yml` 自动部署工作流，同时维护了 `gh-pages` 分支。每次完成代码修改并通过 `npm run build` 后，执行以下命令即可同步更新线上版本：

```bash
export PATH=$PATH:/opt/homebrew/bin
npm run build

# 1. 提交源码并推送到 master 分支（触发 GitHub Actions Pages 部署）
git add -A
git commit -m "feat: your commit message"
git push origin master

# 2. 同步构建产物 dist/ 至 gh-pages 分支
TMP_DIR=$(mktemp -d)
cp -R dist/* "$TMP_DIR/"
git checkout gh-pages
rm -rf assets index.html
cp -R "$TMP_DIR/"* .
rm -rf "$TMP_DIR"
git add -A
git commit -m "Deploy updated build to gh-pages" || true
git push origin gh-pages
git checkout master
```
