# Bloodyberry — 美术风格与视觉规范基线 (Art Style Bible)

> **约束说明**：本文档沉淀了 **Bloodyberry（血色圣果）** 当前已确立并验证通过的完整美术风格与光影规范。**凡未明确要求同步或修改美术风格时，所有后续开发与迭代必须严格参照本文档执行**，不得擅自破坏现有视觉语言。

---

## 一、核心美术定位（Core Identity）

- **题材基调**：暗黑哥特极大主义圣殿（Dark Gothic Maximalist Cathedral）× 教堂大花窗雕饰（Cathedral Filigree & Rose Window）× 高对比体积光影（Volumetric Chiaroscuro）。
- **渲染约束**：**100% 纯原生 HTML5 Canvas 2D 程序化矢量、大马士革暗纹缓存、与多层渐变合成**，零外部 PNG/贴图依赖；UI/角色/环境通过 [`GothicOrnament.ts`](src/ui/GothicOrnament.ts) 提供统一的高精细度哥特雕花原语与材质规范。
- **精细化极繁准则**：保留中央战斗区域的干净辨识度，同时在圣物框体、教堂四周建筑边界、64x64 多帧 2.5D 英雄像素、圣物面板、血条与飘字上全面贯彻**黑曜石切角石板 + 烫金卷草花边 + 蜡封徽章 + 尖券神龛 + 教堂玫瑰花窗**的极大主义暗黑美学。

---

## 二、光影与压迫感法则（Lighting & Atmosphere）

### 1. 压迫感源于光影对比，而非浮夸 UI
- **禁止**在屏幕顶部绘制臃肿的巨型全屏 Boss 血条，**禁止**在 Boss 降临时弹出遮挡视野的大字横幅。
- **Boss 全程聚光灯与深渊蚀变**：
  - Boss 在场时，全局环境暗角（`bossEclipseFactor: 0.85 ~ 1.25`）动态加深，周边环绕深渊暗影环；
  - 每个 Boss 全程沐浴在**斜射天顶聚光灯柱（Overhead Eclipse Spotlight）**与**高对比度边缘体积辉光（Rim-Light Halo）**中，脚下带有吞噬地面光线的暗影池；
  - Boss 降临瞬间仅通过 [`UIManager.renderBossEclipseLightingPulse`](src/ui/UIManager.ts) 产生 1.8s 的深渊暗角呼吸脉动。

### 2. 逻辑自洽的场景光源
- **壁挂哥特铸铁提灯（`RoomManager.renderWallLanternSconce`）**：房间四周的亮光均由四壁石墙上的铸铁壁挂提灯提供物理来源（锻铁支架 + 菱形玻璃灯笼 + 多层跳动火苗 + 向室内投射的扇形暖光锥）。
- **辅助动态点光源**：
  - 玩家周身双层护灯柔光（外圈暖金漫反射 + 内圈冷青微光）；
  - 哥特火盆摇曳暖橙点光源（`#fef08a -> #fb923c -> #b91c1c`）；
  - 北侧传送门体积点光源（封印态绯红警戒光 / 开启态紫金圣光）。

### 3. 穹顶三束丁达尔体积光（Ceiling God-Rays）
- **羽化约束**：严禁绘制生硬的梯形/多边形光柱！必须使用 `ctx.scale(rx, ry)` 配合 `createRadialGradient` 二维高斯椭圆径向衰减，实现四面边缘 100% 羽化融合。
- **双层结构**：
  - **地面焦散层（`renderFloorGodRayCaustics`，位于实体脚下）**：宽幅地面漫反射光池 + 3 块哥特高窗三联窗棂柔化光印；
  - **空中体积光层（`renderCeilingGodRaysOverlay`，位于实体上方）**：外层大气散射光幕 + 4 缕粗细错落的窗棂分束光丝 + 屋顶入射源头柔光晕 + 内部随气流起伏闪烁的丁达尔微尘颗粒。
- **对称随机方向**：每次进入新关卡时，`currentRayDirSign` 随机在 `-1`（左上向右下斜射）与 `+1`（右上向左下斜射）之间对称切换。

---

## 三、色彩体系与五大生态主题（Color Palette & Biomes）

### 1. 统一语义色彩规范
- **深空黑曜底色**：`#04060c`、`#080c17`、`#0f172a`、`#131c2e`
- **圣金 / 暴击 / 推荐**：`#fbbf24`、`#fde047`、`#d97706`
- **剑气弹反（Parry）翡翠金**：`#34d399`、`#10b981`
- **敌方弹幕 / 危险 / 猩红血色**：`#ef4444`、`#dc2626`、`#7f1d1d`、`#450a0a`
- **奥术 / 虚空 / 奇点**：`#a855f7`、`#c084fc`、`#e879f9`
- **冰霜 / 护盾 / 信息提示**：`#38bdf8`、`#bae6fd`

### 2. 五大主题生态场景轮转（`biomeIndex: 0..4`）
| 序号 | 生态名称 | 体积光顶部/中部色相 (`rayTop` / `rayMid`) | 氛围基调 |
| :--- | :--- | :--- | :--- |
| `0` | **绯红地牢** | 清冷月华 `224,242,254` / 圣金余晖 `251,191,36` | 古典哥特主圣殿 |
| `1` | **极寒冰渊** | 极光冰蓝 `224,242,254` / `56,189,248` | 凛冽幽蓝冰窟 |
| `2` | **翡翠腐林** | 幽林翠光 `220,252,231` / `52,211,153` | 潮湿诡谲密林 |
| `3` | **炼狱熔炉** | 炽金火光 `254,240,138` / `249,115,22` | 炽热暗金熔岩 |
| `4` | **星界虚空** | 星云紫晶 `243,232,255` / `192,132,252` | 深邃虚空祭坛 |

---

## 四、场景与实体细部规范

1. **2.5D 立体传送门（`renderDoorPortal` / `renderMysteryDoor`）**：
   - 多层黑曜石立体阶梯底座 + 明暗立体石柱拱门 + 地面体积漫反射光池；
   - **开启态**：多层反向旋转星云旋涡 + 符文粒子向中心汇聚；
   - **封印态**：交叉立体熔岩锻铁锁链 + 中心脉冲封印符文核。
2. **有机不规则血水渍（`MapSystem.renderOrganicBloodPuddle`）**：
   - 严禁绘制规则正圆！使用 10~14 个极坐标控制点 + **三段闭合贝塞尔曲线（Cubic Bezier）**构成自然张力水渍轮廓；
   - 配合偏心液体厚度渐变、表面湿润高光弧以及周围 3~5 颗飞溅小液滴。
3. **角色与 Boss 表现**：
   - 英雄精灵升级为 **64×64、6 帧行走序列**（`createHeroSprite`），具备多层 2.5D 暗黑哥特剪影、深墨描边轮廓与 `imageSmoothingQuality = 'high'` 锐利重采样；脚下搭载 **8 尖哥特星盘罗盘环**（大招就绪转为鎏金圣辉，Lv.5 命途觉醒切换分支主题色），头顶生命值采用共享雕刻金属玻璃槽 [`drawGothicGaugeBar`](src/ui/GothicOrnament.ts) 配合体力微导槽；
   - 双生灵体伴侣（`CompanionSystem`）沿正弦契约线分布 **5 枚菱形鎏金铸铁香炉链环**，本体为双层锯齿鎏金圣翼包裹的雕刻黄铜圣物香炉（带镂空十字格栅、琥珀香火火星与锚定八芒星旋转圣环）；
   - Boss 在保有斜射天顶聚光灯与深渊蚀变光影的同时，头顶采用 compact `76px × 6px` 雕花圣物金属槽 `drawGothicGaugeBar`（4 段铸铁分格 + 菱形钉帽 + 50% 二阶段菱形刻痕 + 白金受击延迟残影 Lag Gauge + `8.5px` `GOTHIC_DISPLAY_FONT` 首领头衔微标）。

---

## 五、UI 与交互排版规范（Dark Gothic Maximalist Reliquary UI）

- **统一哥特图腾原语库（[`src/ui/GothicOrnament.ts`](src/ui/GothicOrnament.ts)）**：
  - 所有全屏模态框（选人、升级、命途分化、宝箱、设置、结算）与 HUD 圣物面板统一调用 [`drawGothicTablet`](src/ui/GothicOrnament.ts)（八边形切角石板 + `64×64` 平铺大马士革四叶草暗纹 `applyDamaskFill` + 四角鎏金卷草镶红宝石角饰 `drawFiligreeCorner`）、[`drawPointedArchNiche`](src/ui/GothicOrnament.ts)（尖券哥特神龛图标槽）、[`drawWaxSeal`](src/ui/GothicOrnament.ts)（红金双色蜡封徽章）、[`drawGothicCrestBanner`](src/ui/GothicOrnament.ts)（双翼哥特铭牌）与 [`drawRoseWindowMandala`](src/ui/GothicOrnament.ts)（预缓存放射状哥特大玫瑰花窗背景）；
  - 全屏边角采用 [`drawScreenIronFrame`](src/ui/GothicOrnament.ts) 铸铁镂空窗框装饰，HUD 左上角为八角星盘英雄徽章（含觉醒印记）、右侧顶部为居中双翼哥特计时圣匣、底部技能栏为切角鎏金魔典槽位。
- **衬线哥特字体体系（`@fontsource/cinzel`）**：
  - 展示标题：`GOTHIC_DISPLAY_FONT`（`"Cinzel", "Noto Serif SC", "Songti SC", "STSong", Georgia, serif`）；
  - 正文说明：`GOTHIC_BODY_FONT`（`"Noto Serif SC", "Songti SC", "STSong", "PingFang SC", Georgia, serif`）；
  - 数值/倒计时/飘字：`GOTHIC_MONO_FONT`（`"Cinzel", ui-monospace, "SF Mono", "JetBrains Mono", monospace`），暴击与状态飘字采用 `GOTHIC_DISPLAY_FONT` 配合深黑曜描边轮廓与鎏金闪烁星芒。
- **高信息密度且零门槛引导**：
  - **升级模态框**：顶部搭载 **Current Reliquary Loadout Strip**（实时展示已装备主武器、被动圣物与活跃流派羁绊计数），每张魔典卡片显示尖券神龛图标、蜡封序号、**超武进化羁绊提示（Evolution Link）**、羁绊标签宝石及 **`★ 推荐`** 徽记，底部配备鎏金重随/跳过/封印按钮；
  - **选人界面与结算统计**：选人界面底部内置 `SaveManager` **Lifetime Chronicle Strip**（总击杀/最高分/金币生涯碑铭）；结算面板内置 4 座尖券神龛数据碑与共享 `drawGothicGaugeBar` 武器 DPS 计量条。
  - **四周教堂边界构筑**：[`RoomManager.renderRoomArena`](src/systems/RoomManager.ts) 与 [`MapSystem`](src/systems/MapSystem.ts) 保持中心战斗视野清澈的同时，沿着场地外围铺设双道切角回廊镶边、生态主题教堂中殿红毯、东西对称铸铁地漏格栅、三墙彩色玻璃柳叶尖窗（Stained-Glass Lancet Slits）、封锁态南侧锻铁闸门（Portcullis）与四角八边形教堂烛台碉楼（含局部暖光点光源）。
