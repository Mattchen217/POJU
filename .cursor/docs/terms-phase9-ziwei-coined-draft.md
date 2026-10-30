# Phase 9 · 紫微 A 类自造词草案（非正式 SSOT）

**约束**：本稿仅供评审；**禁止**直接粘贴进 `POJU_TERMS` 直至产品闸通过。  
命名风格对齐既有 ziwei 结构层（CamelCase 西语词 · 中文「域/配置/星轨」白话 · 定义声明非定命）。

---

## A1 · 立即必要

### A1.1 十一宫具体名（命宫已有 `zw_identity_field`）

| traditional | slug（建议） | zh | en | es | de | fr | 一句话定义（zh） |
|---|---|---|---|---|---|---|---|
| 兄弟 | zw_peer_bond_field | 同辈联结域 | PeerBondField | CampoVinculoPares | PeerBindungsfeld | ChampLienPairs | 标记与同辈协作、对照与边界相关的结构领域，不预测具体人际关系事件。 |
| 夫妻 | zw_partnership_field | 伙伴关系域 | PartnershipField | CampoAsociacion | Partnerschaftsfeld | ChampPartenariat | 标记深度伙伴协作与契约张力的结构领域，不等于婚姻结果判定。 |
| 子女 | zw_continuity_field | 延续创造域 | ContinuityField | CampoContinuidad | Kontinuitaetsfeld | ChampContinuite | 标记创造、延续与后代主题相关的结构领域，不宣称生育必然。 |
| 财帛 | zw_resource_flow_field | 资源流转域 | ResourceFlowField | CampoFlujoRecursos | RessourcenflussFeld | ChampFluxRessources | 标记资源进出与配置节奏的结构领域，不是财富预测。 |
| 疾厄 | zw_resilience_field | 承压调适域 | ResilienceField | CampoResiliencia | Resilienzfeld | ChampResilience | 标记承压、修复与身体边界相关的结构领域，不构成医学诊断。 |
| 迁移 | zw_mobility_field | 流动迁移域 | MobilityField | CampoMovilidad | Mobilitaetsfeld | ChampMobilite | 标记流动、迁徙与外部场域切换的结构领域，不预言迁居事件。 |
| 仆役 | zw_collab_network_field | 协作网络域 | CollabNetworkField | CampoRedColaboracion | KollaborationsnetzFeld | ChampReseauCollaboration | 标记协作网络与支持链条的结构领域（引擎名「仆役」）；不贬低具体职位。 |
| 官禄 | zw_role_craft_field | 职分事功域 | RoleCraftField | CampoOficioRol | RollenHandwerksFeld | ChampMetierRole | 标记职分、事功与公开角色的结构领域，不是升职保证。 |
| 田宅 | zw_anchorage_field | 安顿根基域 | AnchorageField | CampoAnclaje | Verankerungsfeld | ChampAncrage | 标记安顿、居所与根基感相关的结构领域，不预测房产买卖。 |
| 福德 | zw_inner_reserve_field | 内在蓄养域 | InnerReserveField | CampoReservaInterior | innereReserveFeld | ChampReserveInterieure | 标记内在蓄养与心理资源节奏的结构领域，不是福祸判决。 |
| 父母 | zw_origin_support_field | 来源支撑域 | OriginSupportField | CampoSoporteOrigen | HerkunftsStuetzeFeld | ChampSoutienOrigine | 标记来源、长辈支撑与早期条件相关的结构领域，不定论家庭命运。 |

**定义（en 模板，评审时可细修）**：Each palace soft-label names a structural life domain in the Ziwei index; it does not predict concrete life events.

### A1.2 五行局配置值

| traditional | slug（建议） | zh | en | es | de | fr | 一句话定义（zh） |
|---|---|---|---|---|---|---|---|
| 水二局 | zw_config_water_dual | 水二配置 | WaterDualConfig | ConfigAguaDual | WasserDualKonfig | ConfigEauDuale | 排盘所用的水元素二阶配置代号，不是实测物质属性。 |
| 木三局 | zw_config_wood_triple | 木三配置 | WoodTripleConfig | ConfigMaderaTriple | HolzTripelKonfig | ConfigBoisTriple | 排盘所用的木元素三阶配置代号，不是实测物质属性。 |
| 金四局 | zw_config_metal_quad | 金四配置 | MetalQuadConfig | ConfigMetalCuatro | MetallQuadKonfig | ConfigMetalQuad | 排盘所用的金元素四阶配置代号，不是实测物质属性。 |
| 土五局 | zw_config_earth_penta | 土五配置 | EarthPentaConfig | ConfigTierraPenta | ErdePentaKonfig | ConfigTerrePenta | 排盘所用的土元素五阶配置代号，不是实测物质属性。 |
| 火六局 | zw_config_fire_hexa | 火六配置 | FireHexaConfig | ConfigFuegoHexa | FeuerHexaKonfig | ConfigFeuHexa | 排盘所用的火元素六阶配置代号，不是实测物质属性。 |

---

## A2 · 条件必要（星曜值 · 产品确认展示后再升 SSOT）

若 Baseline 继续展示「核心驱动 / 行动驱动」的星值，或命宫主星值，则需要下列软名；**否则**保持 `internal_only` 并隐藏 value 槽。

### A2.1 十四主星（结构隐喻 · 非神煞人格）

| traditional | slug | zh | en | es | de | fr | 定义（zh） |
|---|---|---|---|---|---|---|---|
| 紫微 | zw_star_apex_axis | 枢轴星轨 | ApexAxisTrack | EjeApex | ApexAchsenSpur | VoieAxeSommet | 标记结构图谱中的中枢参照星轨，不代表权力地位预测。 |
| 天机 | zw_star_pattern_sense | 机微星轨 | PatternSenseTrack | ViaPatron | MusterSinnSpur | VoieSensMotifs | 标记偏好梳理节律与机微的结构星轨，不是智商测量。 |
| 太阳 | zw_star_radiant_out | 外放星轨 | RadiantOutTrack | ViaRadiante | StrahlAusSpur | VoieRayonnement | 标记外向呈现与可见输出相关的结构星轨。 |
| 武曲 | zw_star_craft_edge | 利器星轨 | CraftEdgeTrack | ViaFiloOficio | HandwerksKantenSpur | VoieTranchantMetier | 标记锋利事功与工具感相关的结构星轨。 |
| 天同 | zw_star_ease_bond | 舒契星轨 | EaseBondTrack | ViaVinculoSuave | LeichteBindungsSpur | VoieLienDoux | 标记舒缓联结与协调偏好的结构星轨。 |
| 廉贞 | zw_star_intense_edge | 烈度星轨 | IntenseEdgeTrack | ViaIntensidad | IntensKantenSpur | VoieIntensite | 标记烈度、界限与张力相关的结构星轨。 |
| 天府 | zw_star_storehouse | 府库星轨 | StorehouseTrack | ViaReserva | SpeicherSpur | VoieReserve | 标记蓄积与府库感相关的结构星轨。 |
| 太阴 | zw_star_inward_tide | 内潮星轨 | InwardTideTrack | ViaMareaInterior | InnenGezeitenSpur | VoieMareeInterieure | 标记内向潮汐与含藏节奏相关的结构星轨。 |
| 贪狼 | zw_star_desire_drive | 欲求星轨 | DesireDriveTrack | ViaDeseo | BegehrenAntriebsSpur | VoieDesir | 标记欲求驱动与探索张力相关的结构星轨，不是道德评判。 |
| 巨门 | zw_star_voice_gate | 言门星轨 | VoiceGateTrack | ViaPuertaVoz | StimmTorSpur | VoiePorteVoix | 标记言说、辨析与信息门径相关的结构星轨。 |
| 天相 | zw_star_protocol | 仪轨星轨 | ProtocolTrack | ViaProtocolo | ProtokollSpur | VoieProtocole | 标记程序、仪轨与中介角色相关的结构星轨。 |
| 天梁 | zw_star_elder_shade | 荫护星轨 | ElderShadeTrack | ViaAmparo | SchutzSchattenSpur | VoieOmbreTutelle | 标记荫护、劝诫与承托相关的结构星轨。 |
| 七杀 | zw_star_breach_force | 破局星轨 | BreachForceTrack | ViaRuptura | DurchbruchKraftSpur | VoieForceRupture | 标记破局力与锋面推进相关的结构星轨；**须 ns=ziwei**，勿与八字「七杀」十神混映射。 |
| 破军 | zw_star_reset_edge | 重整星轨 | ResetEdgeTrack | ViaReinicio | NeuordnungsSpur | VoieReinit | 标记拆解重整与边界改写相关的结构星轨。 |

### A2.2 已观测辅星（soul/body/sihua）

| traditional | slug | zh | en | es | de | fr | 定义（zh） |
|---|---|---|---|---|---|---|---|
| 文昌 | zw_star_script_clarity | 文晰星轨 | ScriptClarityTrack | ViaClaridadTexto | SchriftKlarSpur | VoieClarteEcrit | 标记表达清晰与文书取向相关的结构星轨；与神煞「文昌」分 ns。 |
| 文曲 | zw_star_lyric_flow | 文韵星轨 | LyricFlowTrack | ViaFlujoLirico | LyrikFlussSpur | VoieFluxLyrique | 标记韵律、审美表达相关的结构星轨。 |
| 左辅 | zw_star_left_support | 左辅星轨 | LeftSupportTrack | ViaApoyoIzq | LinkeStuetzSpur | VoieSoutienGauche | 标记侧翼支持与成全相关的结构星轨。 |
| 右弼 | zw_star_right_support | 右弼星轨 | RightSupportTrack | ViaApoyoDer | RechteStuetzSpur | VoieSoutienDroit | 标记另一侧翼支持与成全相关的结构星轨。 |
| 禄存 | zw_star_resource_cache | 禄存星轨 | ResourceCacheTrack | ViaCacheRecursos | RessourcenCacheSpur | VoieCacheRessources | 标记资源留存节点相关的结构星轨，不是收入预测。 |
| 火星 | zw_star_ignition | 燃点星轨 | IgnitionTrack | ViaIgnicion | ZuendSpur | VoieAllumage | 标记点燃、加速与躁动张力相关的结构星轨。 |

---

## 评审清单

- [ ] A1 宫名是否避免恐吓/定命（疾厄、仆役尤甚）  
- [ ] A1 五行局是否读作「配置代号」而非能量玄学  
- [ ] A2 是否上架，或改为镜片不展示星值  
- [ ] 七杀 / 文昌 双 ns 回归用例是否写入 Phase 10  
- [ ] 通过后方可 PR 改 `POJU_TERMS`（本 Phase 禁止）
