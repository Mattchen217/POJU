Phase 3 — Final Engineering Contract & Acceptance Specification
最终工程契约与验收规范 · 设计定稿草案

项目： POJU / Eastern OS
仓库： Mattchen217/POJU
工程基准： 96cf819d26bbbb7a1eb174848fb0366c1eebfe9f
适用阶段： Phase 3 — Opening Seed、Call A Hypothesis、Call B DIR
当前状态： 规范编写中；尚未批准实施。
0. 文件效力与基本原则
本文件的目标是一次性定义 Phase 3 的完整工程行为，使开发人员能够据此编写实施方案，使验收方能够依据同一组规则独立判断实现是否正确。

本文件优先遵守已经锁定的 A+B SoT、Phase 1/2 已验收行为，以及 Phase 3 已经确定的范围。不得为了方便实现而改变 Decision Context 的事实规则、Hypothesis/DIR 语义、Freeze 机制或 Stage 4 边界。

本文件中的要求分为三类：
- MUST： 强制要求。违反即验收 FAIL。
- MUST NOT： 明确禁止。违反即验收 FAIL。
- SHOULD： 推荐要求。若不采用，实施方案必须说明原因和等价保障。
凡是现有源码尚未实现、尚未核实或缺少必要基础设施的内容，均视为待实现或待核实，不得在实施方案中写成“已经支持”。

重要：本文件是设计与验收规范，不是代码实施授权。 当前不授权开发人员修改代码、创建实施 PR、合并或部署。
1. 范围、基准与禁止扩展
1.1 Phase 3 必须完成的内容
1. Opening 阶段将用户明确提供的信息转化为 Decision Context Draft。
2. Call A 将 breakthrough_core 中符合规则的模型判断转化为正式 Hypotheses。
3. Call B 将 Agenda 转化为正式 DIR。
4. 上述正式数据通过统一 C1 持久化边界提交。
5. 生成任务支持幂等、并发保护、失败回滚、Reload 恢复和结果重放。
6. ControlPlane 与正式 Decision Context 的权威边界明确。
7. Fact / Constraint 用户确认事件具有可验证的来源和目标。
8. 提供覆盖正常流程、并发流程、失败流程和恢复流程的自动化测试。
1.2 明确不属于 Phase 3 的工作
以下工作不在本阶段授权范围内：
- Stage 3 Collecting、Agenda 动态扩展和决策充分性判断的重新设计；
- Gate、Freeze、Stage 4 的实现或重构；
- PageFeed、BookJudgment、Lab、04、SoT16；
- 报告页面、报告内容和报告生成链路；
- 新数据库或服务端分布式事务架构；
- 修改 A+B SoT 的业务语义；
- 与本阶段无关的 UI 或产品功能重构。
1.3 基准约束
所有实现必须以指定 commit 为基准：

96cf819d26bbbb7a1eb174848fb0366c1eebfe9f

如果实际实施分支与该基准存在差异，必须先列出差异及其影响。不得直接将新分支现状当成已批准的 Phase 3 基准。
2. 基准源码现状与设计边界
本节区分“基准源码已经存在的能力”和“本规范要求新增或改造的能力”。后者不能被当作现有能力。
2.1 已核实的基准源码事实
在指定 commit 的源码中，已确认：
位置	基准现状	对 Phase 3 的影响
decision-context/persist.ts	ControlPlaneSlice 是 Record<string, unknown>	缺少正式运行时字段契约
decision-context/persist.ts	beginPersistTransaction() 在发现已完成 idempotency key 时直接返回 null	Generation collision 检查不能简单放在普通 C1 流程之后
decision-context/persist.ts	commitPersistTransaction() 再次执行 key-only skip 检查	Generation guarded 提交必须有独立、明确的提交路径
decision-context/persist.ts	session_id 缺失时回退到 __anon__	正式生产路径必须取消匿名回退
decision-context/persist.ts	extractDcSessionSlice() 主要抽取 current_phase	不能认为完整 ControlPlane 已进入 C1
session-manager.ts	mergeDcPersistSliceIntoSession() 只把 current_phase 合并回 agent_v2	ControlPlane 正式存储和恢复需要重新定义
session-manager.ts	savePOJUSessionCore() 对 Session 加密后，在 Dexie 事务内更新 Session row 和周期索引	已有 C1 基础，但没有 Revision CAS
session-manager.ts	Session row 更新检查 update() === 1	缺失行会抛错，但这不等于并发版本保护
POJUSessionState	已有 DC、DC versions、DC idempotency keys	尚无正式 control_plane、双 Revision、Generation Registry 和 TaskContext 字段
POJUSessionRecord	已有 encrypted_data 和 iv	尚无 session_revision、dc_write_revision
POJUMessage	已有可选 client_id	可作为消息稳定标识，但不能直接把普通消息 ID 当成 Opening Anchor
opening-seed.ts	仍使用 user_confirmed_event?: boolean	必须改成目标明确的 Confirmation Event
opening-seed.ts	Constraint 直接构造，未调用 Fact/Constraint 合法组合校验函数	Constraint 必须补齐运行时合法性校验
hypothesis-from-core.ts	Call A Mapper 读取特定 BreakthroughCore 字段	Fingerprint 必须覆盖全部实际影响 Mapper 输出的字段
dir-from-agenda.ts	默认以 dir_${agendaItem.id} 生成 DIR ID；同 ID 会进入 Map 合并	新契约要求重复 Agenda ID 明确失败，不允许静默合并

2.2 由此得出的工程结论
Phase 3 不能仅在现有 commitDecisionContextChange() 外面增加几个调用。

必须先建立新的 Generation guarded 提交入口，并在 Session 持久化层实现双 Revision CAS。原有普通 C1 API 可以保留给兼容场景，但不能成为 Generation 事务的最终一致性保障。

任何现有入口只要能够写入 POJUSessionRecord.encrypted_data，就必须纳入统一 CAS 写入体系。不能只改 savePOJUSessionCore()，而保留其他绕过 CAS 的写入路径。

3. 全局数据权威与数据结构契约
3.1 数据权威层级
必须严格区分四类数据：
数据	唯一权威位置	说明
Definition、RealityFacts、Constraints、Hypotheses、DIRs、Conflicts	decision_context	正式决策数据
Agenda、Agent Phase、Opening Gate 状态	control_plane	流程控制数据
Generation Registry、Operation Binding、TaskContext	Session 正式持久化字段	异步任务身份和提交记录
agent_v2	兼容镜像 / 临时模型 I/O	不得覆盖正式 DC 或 ControlPlane

agent_v2 不得再作为正式 ControlPlane 的唯一存储位置。
3.2 正式 Session 字段
Phase 3 实施后，POJUSessionState 至少需要具备以下正式字段：
interface POJUSessionState {
  session_id: string;

  // Mirrors the POJUSessionRecord row.
  session_revision: number;
  dc_write_revision: number;

  // Formal process state.
  control_plane: Phase3ControlPlane;

  // Formal DC authority.
  decision_context?: DecisionContext | null;
  decision_context_versions?: DecisionContext[];
  decision_context_idempotency_keys: string[];

  // Async generation state.
  generation_task_contexts: GenerationTaskContext[];
  generation_registry: GenerationRegistryEntry[];
  generation_operation_bindings: GenerationOperationBinding[];

  // Append-only provenance.
  confirmation_events: ConfirmationEvent[];

  // Opening anchor history.
  opening_confirm_history: OpeningConfirmHistoryEntry[];
}


这是目标数据契约，不代表基准源码已经存在这些字段。

POJUSessionRecord 必须同时持有 session_revision 和 dc_write_revision，并与解密后的 Session blob 对应字段一致。
3.3 Revision 字段规则
session_revision：
- 每次成功写入 encrypted_data 必须递增 1。
- 不论是否修改 DC，只要 Session blob 改变，就必须递增。
- row 和 blob 必须写入相同的新值。
dc_write_revision：
- 只有正式 DC 内容发生实质变化时才递增 1。
- 普通聊天消息、UI 状态、TaskContext 状态、Registry、Binding 或 Path C 幂等标记的变化，不得递增该值。
- row 和 blob 必须写入相同的新值。
两个 Revision 都必须是非负安全整数，禁止倒退、跳号或由不同写入层各自计算。
3.4 Revision 一致性
必须满足：
POJUSessionRecord.session_revision
  === decryptedSession.session_revision

POJUSessionRecord.dc_write_revision
  === decryptedSession.dc_write_revision


不一致时必须停止写入并报告 REVISION_MIRROR_MISMATCH。

不得通过“取较大值”“取较小值”或自动覆盖来修复不一致。

对历史数据：
- row 和 blob 都没有 Revision：可按明确的迁移规则视为初始值 0；
- 两者只有一方存在：FAIL；
- 值存在但类型或范围不合法：FAIL；
- Revision 初始化必须通过统一 CAS 写入完成，不能在普通读取时静默修改。

4. Generation 身份体系
4.1 身份字段定义
字段	作用	生成规则
session_id	Session 身份	必须是有效、不可变的 Session ID
client_task_id	本地任务身份	任务第一次持久化前生成；重试、Reload 不变
generation_type	生成类型	call_a_hypothesis / call_b_dir
generation_id	远程或同步生成身份	正常任务使用服务端 job ID；Call A 明确同步路径使用 sync task ID
job_id	服务端任务 ID	服务端创建成功后绑定；Call B 必须存在
sync_task_id	本地同步任务 ID	仅允许明确声明的 Call A sync/recovery 路径
fingerprint	输入语义指纹	从规范化后的实际 Mapper 输入计算
fingerprint_version	指纹算法版本	固定版本号，例如 poju-generation-fp-v1
generation_base_revision	生成任务的 DC 基准	任务启动时固定的 dc_write_revision
idempotency_key	单次提交操作身份	同一次提交重试必须保持不变

4.2 Session ID 校验
正式生产 API 必须拒绝：
- 缺失或空白 session_id；
- 长度小于 8 或大于 128 的 ID；
- 不符合项目统一字符规则的 ID；
- Working Copy 与原始 Session 的 session_id 不一致；
- 从一个 Session 复制到另一个 Session 的任务记录。
__anon__ 不允许出现在生产持久化路径。

所有 begin、apply、commit、hydrate、restore、extract、Generation Registry 和 TaskContext API 都必须执行 Session 身份校验，不能只依赖上层调用者。
4.3 Generation 身份唯一性
Generation 的唯一键：
(session_id, generation_type, generation_id)


同一个唯一键只能绑定一个：
client_task_id
generation_base_revision
fingerprint
fingerprint_version


一旦任务进入 running，以上身份字段不可修改。

job_id 或 sync_task_id 一经绑定不可替换。远程 Job 重建必须创建新任务身份，不得把新 Job 填进旧任务记录。
4.4 不允许身份降级
以下行为均为硬失败：
- 正常 Call A 因缺少 job_id 而自动改用随机 ID；
- Call B 缺少服务端 job_id；
- 同一 generation_id 对应不同 client_task_id；
- 同一 client_task_id 对应不同 generation_id；
- 同一任务身份对应不同 fingerprint；
- 已完成任务被改成新的 base revision；
- Reload 后重新生成一个新的 client_task_id 代替原任务。

5. Generation Registry 与 Operation Binding
5.1 Generation Registry
Registry 是持久化的历史生成身份登记表，不是内存缓存。

建议结构：
interface GenerationRegistryEntry {
  session_id: string;
  generation_type: "call_a_hypothesis" | "call_b_dir";
  generation_id: string;
  client_task_id: string;

  generation_base_revision: number;
  fingerprint: string;
  fingerprint_version: string;

  job_id: string | null;
  sync_task_id: string | null;

  status: "completed";
  result_marker: string;
  committed_session_revision: number;
  committed_dc_write_revision: number;
  committed_context_id: string;
  committed_context_version: number;
  committed_context_hash: string | null;

  completed_at: string;
}


只有正式提交成功后，Registry 才能登记为 completed。

失败、未绑定 Job、仅收到结果但尚未提交的任务，不得伪装成已完成 Registry 记录。
5.2 Operation Binding
每一个 idempotency_key 必须有明确的持久化绑定：
interface GenerationOperationBinding {
  session_id: string;
  idempotency_key: string;

  generation_type: "call_a_hypothesis" | "call_b_dir";
  generation_id: string;
  client_task_id: string;

  generation_base_revision: number;
  fingerprint: string;
  fingerprint_version: string;

  result_marker: string;
  committed_dc_write_revision: number;
  committed_at: string;
}


同一个幂等键不能绑定不同任务、不同 Generation 或不同 fingerprint。

Registry 与 Operation Binding 必须在同一次 C1 提交中写入。
5.3 Collision 检查顺序
Generation guarded 流程不得调用普通 beginPersistTransaction() 的 key-only skip 作为第一步。

正确顺序必须是：
1. 校验 Session 身份。
2. 校验任务身份字段完整性。
3. 读取 Registry。
4. 检查 Generation ID collision。
5. 检查 client_task_id 一致性。
6. 检查 fingerprint 和 fingerprint version。
7. 检查 generation base revision。
8. 检查 Operation Binding。
9. 判断 Path A、Path B 或 Path C。
10. 进入对应的 Revision CAS 提交路径。
任何 collision 检查必须先于幂等 skip。

6. Generation TaskContext 状态机
6.1 正式结构
interface GenerationTaskContext {
  session_id: string;
  client_task_id: string;

  generation_type: "call_a_hypothesis" | "call_b_dir";
  generation_id: string | null;

  generation_base_revision: number;
  fingerprint: string;
  fingerprint_version: string;

  job_id: string | null;
  sync_task_id: string | null;

  status:
    | "pending_create"
    | "running"
    | "result_received"
    | "committing"
    | "completed"
    | "failed_retryable"
    | "failed_terminal"
    | "recovery_required"
    | "abandoned";

  created_at: string;
  updated_at: string;
  completed_at: string | null;
  error_code: string | null;
}


6.2 合法状态转换
pending_create
    |
    | remote job created and locally bound
    v
  running
    |
    | successful result received
    v
result_received
    |
    | commit begins
    v
 committing
    |
    | C1 transaction succeeds
    v
 completed


失败分支：
pending_create -> failed_retryable
pending_create -> recovery_required
running        -> failed_retryable
running        -> failed_terminal
result_received -> failed_retryable
committing     -> recovery_required


abandoned 只能用于能够确认远程任务不存在、已经终止或明确不可恢复的情况。

不得仅因为本地超时就把远程 Job 标记为不存在。
6.3 创建远程 Job 的两阶段流程
第一阶段：本地预登记
1. 读取最新 Session。
2. 校验 row/blob Revision 一致。
3. 固定 generation_base_revision = dc_write_revision。
4. 生成 client_task_id。
5. 计算并保存 fingerprint。
6. 保存 pending_create TaskContext。
7. 使用 Session CAS 提交，Session Revision +1，DC Revision 不变。
8. 提交时再次检查 row 的 dc_write_revision 仍等于任务 base。
如果 DC 已经变化，不允许启动旧基准任务。

第二阶段：远程创建和本地绑定
1. 使用已持久化的 client_task_id 创建远程 Job。
2. 在服务端 metadata 中尽可能写入 client_task_id、session_id、generation_type 和 fingerprint version。
3. 获得 job_id 后，重新读取最新 Session。
4. 通过 CAS 将 job_id 绑定到原 TaskContext。
5. TaskContext 进入 running。
如果远程创建成功、本地绑定失败：
- 不得创建一个新的 client_task_id；
- 不得直接重复创建新的 Job；
- 必须优先通过远程任务查询或 metadata 反查原 Job；
- 找到原 Job 后补绑；
- 暂时无法确认时进入 recovery_required；
- 不允许把不确定状态当成 failed_terminal。
如果现有远程 Job 服务不支持按 metadata 查询，实施方案必须明确说明这一限制及其恢复策略，不能假设该能力存在。
6.4 Reload 恢复
Reload 后必须从持久化 TaskContext 恢复原任务：
- 保留原 client_task_id；
- 保留原 generation_base_revision；
- 保留原 fingerprint 和 version；
- 保留已有 job_id 或 sync_task_id；
- 不得重新计算任务基准；
- 不得把旧任务结果合并到新的 DC Revision。
pending_segment2_job_id 可以作为旧 UI 兼容镜像，但不得成为 Generation 身份的唯一来源。

7. 双 Revision 与统一 Session CAS
这是整个 Phase 3 最重要的持久化约束。
7.1 两种 Revision 的职责
场景	session_revision	dc_write_revision
新增聊天消息	+1	不变
修改普通 Session 字段	+1	不变
修改 Agenda / ControlPlane	+1	不变
创建或更新 TaskContext	+1	不变
写入 Generation Registry / Binding	+1	不变
Path A 首次正式写入 DC	+1	+1
Path C 新幂等键登记	+1	不变
读取 Session	不变	不变
Archive / Profile 等独立 post-commit side effect	不变	不变

一次 Session blob 提交只能产生一组明确的新 Revision，不能由不同模块分别递增。
7.2 任务基准与提交时 CAS 的区别
必须区分：
- generation_base_revision：任务开始时固定的 DC Revision，整个任务生命周期不变。
- expected_session_revision：本次提交准备写入时，从最新 Session 读取的 Revision。
- expected_dc_write_revision：本次提交准备写入时，从最新 Session 读取的 DC Revision。
例如：
任务启动：
  S0 = session_revision
  D0 = dc_write_revision

保存 pending_create：
  session_revision = S0 + 1
  dc_write_revision = D0

任务完成后：
  重新读取最新 Session
  S_expected = 最新 session_revision
  D_expected = 最新 dc_write_revision

Path A 提交要求：
  D_expected === generation_base_revision === D0
  Session CAS 要求 row.session_revision === S_expected

成功提交：
  session_revision = S_expected + 1
  dc_write_revision = D0 + 1


因此，不能在 Apply 时仍然拿任务启动时的 S0 作为 Session CAS expected。TaskContext 保存、用户聊天消息等操作可能已经让 Session Revision 前进。

但也不能因为 Session Revision 前进，就把 generation_base_revision 更新成新值。
7.3 Path A 的双重校验
Path A 必须同时通过：
1. Session CAS：row 的 session_revision 等于本次从最新 Session 读取的 expected。
2. DC Base 校验：row 的 dc_write_revision 等于任务原始 generation_base_revision。
如果 Session Revision 不匹配，可以重新读取最新 Session 并重放原始 mutation。

如果 DC Revision 不匹配，必须 HARD FAIL: GENERATION_BASE_STALE。

不得将旧 Generation 结果合并到新的 DC。
7.4 统一 CAS 写入入口
所有 POJUSessionRecord.encrypted_data 写入都必须通过统一写入入口。

禁止：
- 直接 put() 覆盖现有 Session；
- 直接 update() 替换 encrypted_data；
- 在事务外读取旧 Session、修改整包对象后无条件保存；
- 仅对 Phase 3 新代码做 CAS，却让旧聊天保存路径绕过 CAS；
- 使用 UI 中的旧 Session 快照覆盖 IndexedDB 中的最新 Session。
新建 Session 是例外：初始记录与初始加密 blob 必须在同一创建流程中初始化 Revision 为 0。
7.5 Dexie 提交步骤
Web Crypto 加密不能放在长时间打开的 IndexedDB 事务中。采用以下流程：
1. 从 IndexedDB 读取最新 Session row。
2. 解密 blob。
3. 校验 row/blob Revision 一致。
4. 对最新 Session 应用纯 mutation，生成候选 Session。
5. 计算候选 Revision。
6. 在事务外加密候选 Session。
7. 开启 Dexie rw transaction，范围至少包括 Session row 和 Phase 2 已有的核心索引表。
8. 在事务内重新读取 Session row。
9. 校验 session_revision 等于 expected。
10. 对 DC generation 提交，额外校验 dc_write_revision 等于 generation base。
11. 校验 row 仍属于相同 Session 和 owner partition。
12. 更新 encrypted blob、IV、Revision 镜像和必要索引。
13. 提交事务。
14. 事务成功后才更新 UI 内存状态和执行 post-commit side effects。
如果事务内任一校验失败，必须 abort，不能留下半写入状态。
7.6 CAS 失败后的重试规则
普通 Session mutation：
- 重新读取最新 Session；
- 解密最新 blob；
- 重新应用原始 mutation；
- 保持原 operation_id；
- 保持原消息 client_id；
- 对候选 Session 重新加密；
- 再次执行 CAS。
DC Generation mutation：
- 可以重新读取最新 Session；
- 可以用最新 Session Revision 作为 Session CAS expected；
- 但必须保留原 generation_base_revision；
- 如果最新 DC Revision 不再等于原 base，必须停止；
- 不得自动 rebase 生成结果。
重试不得重复调用外部模型、扣费、创建 Job 或触发不可逆 side effect。
7.7 Mutation 而不是旧整包快照
所有写入调用必须提供稳定的操作身份和可重放 mutation。

建议接口：
interface SessionMutation {
  operation_id: string;
  kind: "message_append" | "session_patch" | "control_plane_patch" | "dc_generation";
  apply: (latest: POJUSessionState) => POJUSessionState;
}


apply 必须是纯函数，不得在内部调用模型、网络、支付或其他外部副作用。

消息追加必须通过稳定 client_id 去重：
- 相同 client_id、相同内容：重复操作视为已应用；
- 相同 client_id、不同内容：硬失败；
- 不同 client_id：作为独立消息保留。

8. C1 原子提交边界
8.1 Path A 首次提交的原子写入集合
以下内容必须在同一个 Session blob 和同一个 Dexie 核心事务中完成：
1. 正式 decision_context；
2. decision_context_versions（如有变化）；
3. control_plane 的对应更新；
4. Generation Registry 完成记录；
5. Operation Binding；
6. decision_context_idempotency_keys；
7. GenerationTaskContext 状态变为 completed；
8. session_revision；
9. dc_write_revision；
10. Phase 2 原有核心周期索引同步（如本次操作涉及）。
其中任一失败，整个核心事务必须失败。
8.2 Path C 原子写入集合
Path C 不重复写入 DC，但必须在同一次 C1 事务中写入：
- 新 Operation Binding；
- 新幂等 key；
- 对应 Registry 的一致性检查结果或必要的登记信息；
- TaskContext 的一致状态；
- session_revision + 1；
- dc_write_revision 保持不变。
不能只在内存中标记幂等成功。
8.3 Post-commit side effects
Archive、Profile 同步和其他非核心副作用仍然遵循 Phase 2 已验收规则：
- 核心 Session 提交成功后执行；
- side effect 失败不能反向宣称核心事务回滚；
- 不得将 side effect 的成功状态冒充 DC 提交状态。
8.4 内存状态采用规则
只有 IndexedDB 核心事务成功后，才能将候选 Session 作为当前正式内存状态。

失败时：
- UI 不得展示未提交的正式 DC；
- 不得登记 completed Registry；
- 不得把 TaskContext 标记为 completed；
- 不得把幂等 key 放入已完成集合；
- 必须保留可恢复的失败信息。

9. Path A / Path B / Path C 精确定义
9.1 Path A：首次正式提交
条件：
- Registry 中不存在该 Generation 完成记录；
- Operation Binding 中不存在冲突绑定；
- Generation 身份完整；
- client_task_id 与 TaskContext 一致；
- fingerprint 和 version 一致；
- 最新 dc_write_revision 等于原始 generation base；
- Session CAS 校验成功。
操作：
- 执行对应 Mapper；
- 生成正式 Hypothesis 或 DIR；
- 更新 DC；
- 写 Registry；
- 写 Operation Binding；
- 写 completed TaskContext；
- 写幂等 key；
- Session Revision +1；
- DC Revision +1；
- 同一 C1 提交。
如果 Mapper 输出没有任何合法结果，不得伪造成功。必须返回明确的 EMPTY_GENERATION_RESULT，TaskContext 进入可恢复或终止失败状态，不能登记为 completed。
9.2 Path B：同一操作重放
条件：
- 同一个 idempotency_key 已经存在 Operation Binding；
- 绑定的 client_task_id、Generation ID、fingerprint、version、base revision 与请求完全一致；
- Registry 中存在对应 completed 记录。
行为：
- 不重复执行 Mapper；
- 不重复写 DC；
- 不重复增加 Revision；
- 不重复执行 side effects；
- 返回原始提交的结果凭据和当前 Session 快照。
返回值必须明确区分：
interface GenerationReplayResult {
  outcome: "already_committed";
  original_committed_session_revision: number;
  original_committed_dc_write_revision: number;
  original_context_id: string;
  original_context_version: number;
  original_context_hash: string | null;

  current_session_revision: number;
  current_dc_write_revision: number;
  current_context_id: string | null;
  current_context_version: number | null;
  current_context_hash: string | null;

  original_result_is_current: boolean;
}


original_result_is_current 只有在当前 DC 身份、版本和 hash 与原始提交一致时才为 true。

如果后续 DC 已经更新，Path B 仍然返回“原操作已完成”，但必须同时指出原结果不是当前 DC。不得把旧提交结果当作当前 DC 再次写入。
9.3 Path C：同一 Generation 的新幂等键
条件：
- Registry 中存在相同 Generation；
- client_task_id 完全相同；
- generation base 完全相同；
- fingerprint 和 version 完全相同；
- job_id / sync_task_id 完全相同；
- 旧 Generation 已完成；
- 新 idempotency_key 尚未绑定。
行为：
- 不重新执行 Mapper；
- 不重复写 DC；
- 新增 Operation Binding；
- 新增幂等 key；
- 保持 TaskContext 与 Registry 一致；
- Session Revision +1；
- DC Revision 不变。
Path C 的返回必须标记：
outcome = "same_generation_new_operation_key"
dc_mutation_applied = false


9.4 不允许 Path C 的情况
以下情况必须硬失败，不能降级为 Path C：
- 同一 Generation ID，但不同 client_task_id；
- 同一 Generation ID，但不同 base revision；
- 同一 Generation ID，但不同 fingerprint；
- 同一 Generation ID，但不同 fingerprint version；
- 同一任务但 job_id 不一致；
- TaskContext 与 Registry 状态冲突。
9.5 三条路径的判断优先级
身份合法性检查
    ↓
Generation Collision 检查
    ↓
TaskContext / Registry 一致性检查
    ↓
Operation Binding 检查
    ↓
Path B：已完成的同一操作
    ↓
Path C：同一任务的新操作 key
    ↓
Path A：首次正式提交


任何情况下都不允许只根据 idempotency_key 存在与否决定跳过。

10. ControlPlane 运行时契约
10.1 权威位置
POJUSessionState.control_plane 是正式 ControlPlane 唯一权威位置。

agent_v2 只允许作为兼容镜像：
- 可以从 ControlPlane 派生必要 UI 字段；
- 不得反向覆盖 ControlPlane；
- 不得从 agent_v2 恢复正式 DC；
- 不得因为 agent_v2 有旧字段而静默覆盖正式 ControlPlane。
10.2 类型要求
禁止继续使用：
type ControlPlaneSlice = Record<string, unknown>;


必须定义具体结构和枚举。

Phase 3 至少需要覆盖：
interface Phase3ControlPlane {
  current_phase: AgentPhase;

  investigation_agenda: AgendaItem[];
  active_agenda_item_id: string | null;

  opening_anchor_id: string | null;
  opening_gate_state: "not_created" | "pending" | "confirmed" | "cleared";

  last_call_a_fingerprint: string | null;
  last_call_a_fingerprint_version: string | null;

  last_call_b_fingerprint: string | null;
  last_call_b_fingerprint_version: string | null;
}


如果源码调用链还需要其他字段，必须在实施方案中逐一列明其消费者、写入者和生命周期。不得为了避免遗漏而退回 Record<string, unknown>。

AgentPhase 必须使用正式 literal union。不能只检查 typeof value === "string"。

AgendaItem 必须执行运行时结构校验，至少包括：
- id 非空且在同一 Agenda 中唯一；
- label 为字符串；
- critical 为 boolean；
- status 属于 unexplored | partial | covered；
- frame_kind、role、serves_page 等可选字段只能取合法值；
- 不能把未知字段直接扩散到正式 ControlPlane。
10.3 Runtime Whitelist
必须同时具备：
1. TypeScript 静态类型；
2. 输入 Runtime Validator；
3. 输出 Runtime Validator；
4. 明确的字段白名单；
5. 未知字段处理规则。
对未知字段：
- 不得写入正式 ControlPlane；
- 不得静默作为正式业务数据保存；
- 应返回可识别的 UNKNOWN_CONTROL_PLANE_FIELD 或记录明确的兼容性诊断。
对已知字段但类型错误：
- 必须失败；
- 不得简单丢弃后继续提交；
- 不得将错误值转成空字符串、空数组或默认状态。
10.4 ControlPlane 与 DC 的隔离
ControlPlane 中的：
- Agenda status；
- 当前 focus；
- Agent phase；
- Opening Gate 状态；
- Generation 运行状态；
均不能自动改变 DC 的事实状态。

特别是：
- Agenda covered 不等于 DIR known；
- Gate confirmed 不等于全部 RealityFacts 已确认；
- Generation completed 不等于报告可交付；
- UI 已显示成功不等于 C1 已提交。

11. Confirmation Event 契约
11.1 设计原则
Confirmation Event 必须表达一个明确的用户行为，针对一个明确的 Fact 或 Constraint。

Gate 整体确认、用户对某个事实的确认、用户对某个约束的确认，是三种不同的事件。

Opening Gate 不得批量创建 Fact Confirmation Event。
11.2 Discriminated Union
type ConfirmationEvent =
  | {
      event_id: string;
      target_type: "fact";
      fact_id: string;
      constraint_id?: never;

      source_turn_id: string;
      confirmation_turn_id: string | null;

      confirmation_action_id: string;
      event_type: "confirm_fact";

      actor: "user";
      confirmed_at: string;
      event_version: 1;
    }
  | {
      event_id: string;
      target_type: "constraint";
      constraint_id: string;
      fact_id?: never;

      source_turn_id: string;
      confirmation_turn_id: string | null;

      confirmation_action_id: string;
      event_type: "confirm_constraint";

      actor: "user";
      confirmed_at: string;
      event_version: 1;
    };


实际实施可以增加必要的 UI 交互证据字段，但不得破坏上述互斥目标结构。
11.3 字段规则
- event_id：全 Session 唯一。
- fact_id / constraint_id：目标必须存在。
- source_turn_id：必须指向原始用户陈述来源。
- confirmation_turn_id：若用户通过新消息确认，必须关联该消息；纯 UI 确认可以为 null。
- confirmation_action_id：代表一次用户确认操作，必须在 Session 内唯一。
- actor：只能为 user。
- event_type：必须与 target_type 一致。
- event_version：必须是支持的事件版本。
confirmation_action_id 重复使用时：
- 相同 action、相同目标、相同内容：幂等 skip；
- 相同 action、不同目标：硬失败；
- 相同 action、不同事件类型：硬失败。
11.4 用户操作证据
纯 UI 点击不一定产生新的聊天消息，但必须记录可验证的用户操作来源。

例如：
interface UserConfirmationAction {
  confirmation_action_id: string;
  session_id: string;
  target_type: "fact" | "constraint";
  target_id: string;
  control_id: string;
  anchor_id: string | null;
  occurred_at: string;
}


该记录必须由真实用户交互触发，不能由模型生成或由后台自动补造。
11.5 Fact / Constraint 状态规则
继续遵守 A+B SoT：
status	verification_level	合法
confirmed	user_asserted	是
confirmed	independently_verified	是
unverified	user_estimate	是
unverified	user_asserted	是
unknown	none	是
declined	none	是
not_applicable	none	是

禁止 inferred。

特别规定：
- user_estimate 即使得到用户确认，仍保持 unverified；
- 用户确认自己的估计，不等于该估计已经客观验证；
- independently_verified 不自动意味着 user_confirmed = true；
- unknown、declined、not_applicable 不得因确认事件变为 user_confirmed = true；
- Constraint 必须调用与 RealityFact 等价的合法组合校验；
- 不能通过 user_confirmed_event: boolean 代替完整事件记录。
user_confirmed 必须是派生值，不能接受模型或调用者任意赋值。
11.6 Opening Gate 的独立性
Opening Gate 的确认只表示用户确认了系统对困境的整体理解或同意继续。

它不得：
- 自动确认所有 RealityFacts；
- 自动确认所有 Constraints；
- 批量生成多个 Confirmation Event；
- 将模型填入的缓冲内容视为用户事实；
- 改变 user_estimate 的 unverified 状态。

12. Opening Anchor 与 Gate History
12.1 Anchor 必须是专用身份
普通 POJUMessage.client_id 不能自动成为 Opening Anchor。

Opening Anchor 必须同时具备：
- 当前 Session 绑定；
- 专用 anchor_id；
- 对应的 assistant 消息 client_id；
- 专用 Opening Anchor 消息标记；
- 创建时间；
- 当前状态；
- 可追溯的 Gate 历史。
12.2 正式结构
interface OpeningAnchor {
  anchor_id: string;
  session_id: string;

  message_client_id: string;
  message_role: "assistant";

  status: "pending" | "confirmed" | "cleared";

  created_at: string;
  resolved_at: string | null;
}

interface OpeningConfirmHistoryEntry {
  history_id: string;
  anchor_id: string;
  message_client_id: string;

  state: "pending" | "confirmed" | "cleared";

  created_at: string;
  resolved_at: string | null;

  confirmation_action_id: string | null;
}


12.3 创建规则
Opening Anchor 必须与对应理解卡片的首次持久化处于同一 C1 事务。

要求：
- 先确定稳定 client_id；
- 创建专用 anchor_id；
- 将消息标记为 Opening Anchor；
- 写入 Anchor；
- 写入 History；
- 更新 ControlPlane 当前 anchor；
- 同一事务提交。
不能先显示一个 Gate，之后再补建 Anchor。
12.4 唯一性规则
同一个 Session：
- anchor_id 全局唯一；
- message_client_id 必须指向实际存在的 assistant 消息；
- 普通用户消息不能作为 Anchor；
- 普通 assistant 回复不能自动成为 Anchor；
- 已 cleared 的旧 Anchor 不得重新变成 pending；
- 一个 active pending Gate 只能绑定一个当前 Anchor。
12.5 Gate Reset
Reset 必须是一次原子状态转换：
1. 当前 Anchor 从 pending 变为 cleared；
2. 原 History 记录追加 cleared 状态；
3. 创建新的 Anchor；
4. 创建新的 pending History；
5. 更新 ControlPlane 当前 anchor；
6. 同一次 C1 提交。
不得删除旧历史，不得直接覆盖旧 Anchor。
12.6 Gate Confirmation
用户确认时：
- 当前 Anchor 必须仍为 pending；
- 用户交互必须关联当前 anchor_id；
- 更新 Anchor 为 confirmed；
- 更新 History；
- 更新 ControlPlane Gate 状态；
- 不自动产生 Fact/Constraint Confirmation Event。

13. Fingerprint 与 Normalization
13.1 总原则
Fingerprint 和正式 Mapper 必须消费同一个规范化对象。

禁止：
- 用原始模型输出计算 Fingerprint；
- 再用另一套逻辑清洗数据后执行 Mapper；
- Fingerprint 忽略 Mapper 实际读取的字段；
- Mapper 读取未纳入 Fingerprint 的隐藏字段；
- 先过滤数组元素，再重新编号，造成原始位置变化。
13.2 统一规范化规则
所有参与 Mapper 的字符串字段：
1. Unicode NFC；
2. CRLF / CR 统一为 LF；
3. 去除首尾空白；
4. 连续空白折叠为一个 ASCII 空格；
5. 规范化后为空字符串时转换为 null；
6. 不允许把非字符串值强制转换成字符串。
值的规范化：
原始值	规范化结果
undefined	null
null	null
""	null
仅空白字符串	null
非空字符串	规范化字符串
合法 boolean	保持 boolean
非法类型	Runtime Validation Failure

数组：
- 必须保留原始顺序；
- 必须保留原始下标；
- 不得过滤后重新编号；
- 空位必须以明确 null 形式保留；
- 对实际 Mapper 会忽略的空元素，规范化对象仍应保留原位置，以确保后续元素的 Hypothesis slot 不改变。
对象：
- Fingerprint 序列化时使用稳定键排序；
- 不允许依赖 JavaScript 对象偶然的插入顺序；
- 不允许未定义字段在不同运行时被序列化成不同结果。
13.3 Call A 完整字段清单
Fingerprint 必须覆盖所有实际影响 hypothesesFromBreakthroughCore() 输出的字段。

根字段：
- situation_conclusion
- energy_structure
key_crossroads：
- real_fork
- path_costs
- decision_traits
- needs_validation
- structural_basis
modern_action_frames[]：
- direction
- why_fits
- needs_validation
- structural_basis
- chart_anchors[]
必须保留 modern_action_frames 原始数组下标。

primary_path：
- direction
- why_fits
- needs_validation
- structural_basis
backup_path：
- direction
- why_fits
- needs_validation
- structural_basis
energy_retune_frame：
- direction_fit
- timing_ripeness
- daily_retune
- needs_validation
- structural_basis
未被 Mapper 消费的 response、rhythm_frame、status、reality_anchors 等字段，不得在没有明确映射关系的情况下随意纳入或排除。若后续 Mapper 增加读取字段，必须升级 fingerprint version。
13.4 Call B 完整字段清单
Fingerprint 必须覆盖 dirsFromAgenda() 实际读取的字段：
- id
- label
- collection_goal
- role
- frame_kind
- supports
- serves_page
- critical
Agenda 数组顺序必须保留。

AgendaItem.status 是流程状态，不进入 DIR 内容，不得改变 DIR current_state。

captured_answer、stale_turns、unqualified_streak、frame_index 等字段如果没有被当前 Mapper 读取，不得悄悄成为生成内容依据。

如果未来 Mapper 使用这些字段，必须同步升级 Fingerprint 版本。
13.5 Fingerprint 生成
统一流程：
Raw Call Input
      ↓
Runtime Validation
      ↓
Normalize
      ↓
Normalized Object
      ├── Fingerprint
      └── Mapper


Fingerprint 建议采用：
SHA-256(
  fingerprint_version
  + canonical_json(normalized_object)
)


必须使用相同规范化对象，而不是分别调用两套转换函数。

Fingerprint Version 改变意味着新算法。不同 version 的结果不得视为同一 Fingerprint。
13.6 Mapper 输出稳定性
相同：
generation_type
fingerprint_version
fingerprint
source_ref / generation identity


必须得到相同的业务内容。

时间戳等运行元数据可以不同，但不得导致正式业务内容出现不同结果。

Hypothesis ID 必须稳定，不能因数组过滤、重排或重试发生变化。

14. Opening Seed、Call A、Call B 的业务映射规则
14.1 Opening Seed
Opening Seed 只允许创建：
- Definition；
- 初始 RealityFacts；
- 初始 Constraints。
禁止创建：
- Hypotheses；
- DIR；
- Agenda；
- 模型推断事实。
Definition 的字段来源：
DC 字段	允许来源
concrete_event	用户明确描述的困境
stakes	用户明确描述的现实利害
desired_outcome	用户表达的期望方向
decision_question	当前需要回答的决策问题
goal_priorities	用户明确提出的优先级
unacceptable_outcomes	用户明确表达的不可接受结果

模型生成的 breakthrough_core 不得作为用户事实来源。

Opening Seed 创建 RealityFact 时，必须有明确用户陈述及 source_turn_id。只存在于 core_dilemma 或 desired_direction 模型缓冲中的内容，不能直接创建 RealityFact。

对于用户陈述：
- user_asserted 不代表客观验证；
- 用户估计使用 user_estimate；
- user_estimate 必须保持 unverified；
- 未确认的事实不得凭 Gate 整体确认自动变成 confirmed。
Constraints 必须单独经过合法组合校验，并保留 rigidity: hard | soft。
14.2 Call A：BreakthroughCore → Hypothesis
Call A 的输入为经过 Runtime Validation 和 Normalization 的 BreakthroughCore。

Mapper 只能创建 Hypothesis，不得创建 RealityFact 或 Constraint。

每个 Hypothesis 必须有：
- 稳定 hypothesis_id；
- statement；
- supporting_evidence；
- counter_evidence；
- validation_need；
- state；
- related_dir_ids；
- source_ref。
Mapper 必须遵守当前业务映射规则：
- situation_conclusion 有有效内容时生成 situation Hypothesis；
- key_crossroads.real_fork 有有效内容时生成 key crossroads Hypothesis；
- modern_action_frames[i].direction 有效时生成对应 action Hypothesis；
- primary_path.direction 有效时生成 primary path Hypothesis；
- backup_path.direction 有效时生成 backup path Hypothesis；
- energy_retune_frame.direction_fit 有效时生成 energy retune Hypothesis。
needs_validation 决定对应 Hypothesis 是否进入 pending_validation，不能由 Agenda 的 covered 状态替代。

重复提交同一 source_ref 时：
- 不得重复创建同 ID Hypothesis；
- 不得保留同一 source_ref 的旧结果并叠加重复结果；
- 必须按 Generation 身份与 Mapper 结果整体替换或精确复用。
14.3 Call B：Agenda → DIR
Call B 每一个 AgendaItem 对应一个 DIR，严格 1:1。
agenda_item.id = A
        ↓
dir_id = dir_A


规则：
- 一个 AgendaItem 只产生一个 DIR；
- 一个 DIR 只对应一个 AgendaItem；
- 不自动合并多个 AgendaItem；
- 不自动拆分一个 AgendaItem；
- Agenda ID 重复必须硬失败；
- 不允许静默 Map 合并。
DIR 初始状态必须为：
current_state = "unknown"
partial_satisfaction = false
id_lifecycle = "active"


Agenda 的：
unexplored / partial / covered


只能表示流程进度，不得决定 DIR 的 known / unknown / conflict / n_a。

DIR 的正式状态仍由 A+B SoT 规定的 Facts、Constraints、Conflicts 聚合逻辑决定。Phase 3 不得提前实现或模拟 Stage 3 聚合。

15. 异常、回滚与恢复契约
15.1 错误必须可分类
至少定义以下错误类别：
错误码	含义	处理
INVALID_SESSION_ID	Session 身份非法	硬失败
REVISION_MIRROR_MISMATCH	row/blob Revision 不一致	停止写入
SESSION_CAS_CONFLICT	Session Revision 已变化	Reload + mutation rebase
GENERATION_BASE_STALE	DC 已超出 Generation 原始 base	硬失败，不允许 rebase
GENERATION_ID_COLLISION	Generation 身份冲突	硬失败
GENERATION_TASK_MISMATCH	TaskContext 身份不一致	硬失败
FINGERPRINT_MISMATCH	相同 Generation 输入不一致	硬失败
FINGERPRINT_VERSION_MISMATCH	Fingerprint 算法版本不一致	硬失败
IDEMPOTENCY_BINDING_COLLISION	同幂等键绑定不同操作	硬失败
CONTROL_PLANE_VALIDATION_FAILED	ControlPlane 不符合类型契约	硬失败
CONFIRMATION_EVENT_INVALID	用户确认事件无效	硬失败
OPENING_ANCHOR_INVALID	Anchor 与 Session/消息不匹配	硬失败
EMPTY_GENERATION_RESULT	Mapper 没有产生合法内容	不得登记成功
REMOTE_JOB_BINDING_PENDING	Job 创建成功但本地尚未绑定	恢复流程
C1_COMMIT_FAILED	核心事务失败	回滚并保留恢复信息

错误消息可以附加诊断详情，但不得使用模糊的 unknown error 代替可分类错误。
15.2 事务失败
当 C1 事务失败时：
- IndexedDB 事务必须整体 abort；
- row Revision 不得改变；
- blob 不得改变；
- DC 不得改变；
- Registry 不得登记完成；
- Operation Binding 不得新增；
- 幂等 key 不得被标记完成；
- UI 内存不得采用候选 Session。
15.3 加密失败
加密发生在 Dexie 事务外。

加密失败时：
- 不得开启写事务；
- 不得改变任何 Revision；
- 不得改变正式内存状态；
- 保留原 mutation 及 operation identity，以便上层按规则重试。
15.4 事务中断与响应丢失
如果事务可能已经提交，但调用方没有收到成功响应：
1. Reload 最新 Session；
2. 检查 Operation Binding；
3. 检查 Registry；
4. 校验提交身份；
5. 如果已完成，按 Path B 返回；
6. 如果未完成，按照原任务身份继续；
7. 不得盲目再执行一次 DC 写入。
15.5 远程 Job 超时
远程 Job 超时不等于 Job 不存在。

必须区分：
- 服务端明确失败；
- 服务端仍在运行；
- 服务端结果已完成；
- 客户端未收到响应；
- 客户端无法确认服务端状态。
无法确认时进入 recovery_required，不能直接新建另一个 Job。

16. API 与调用边界
本节规定接口职责，不要求开发人员必须使用完全相同的函数名称。
16.1 Session 读取
loadPOJUSession(session_id)


必须：
- 校验 Session 身份；
- 读取 row；
- 解密 blob；
- 校验 row/blob Revision；
- 校验 Session 内部结构；
- 恢复 DC 权威；
- 恢复 TaskContext；
- 恢复 Registry / Binding；
- 恢复 Confirmation Event；
- 恢复 Opening Anchor History；
- 不允许 agent_v2 覆盖正式数据。
16.2 普通 Session Mutation
mutatePOJUSession({
  session_id,
  operation_id,
  mutation,
})


必须：
- 从最新 Session 开始；
- 使用稳定 operation ID；
- 使用 Revision CAS；
- CAS 失败时按纯 mutation 重放；
- 消息追加按 client_id 去重；
- 只有提交成功后才更新内存。
16.3 Generation Task 创建
createGenerationTask({
  session_id,
  generation_type,
  normalized_input,
  fingerprint,
  fingerprint_version,
})


必须：
- 固定 generation base；
- 生成稳定 client_task_id；
- 保存 pending_create；
- 使用 Session CAS；
- 提交时再次验证 DC base；
- 不能在没有持久化任务身份的情况下创建远程 Job。
16.4 Generation Job 绑定
bindGenerationJob({
  session_id,
  client_task_id,
  job_id,
})


必须：
- 找到唯一 TaskContext；
- 校验任务状态；
- 校验 job_id 不冲突；
- 使用 Session CAS；
- 不允许替换已有 job_id。
16.5 Generation 结果提交
commitGenerationResult({
  session_id,
  client_task_id,
  generation_id,
  idempotency_key,
  normalized_input,
  fingerprint,
  fingerprint_version,
  result,
})


必须：
- 校验任务身份；
- 重新验证 fingerprint；
- 重新计算并验证 Mapper 输入；
- 执行 Registry collision 检查；
- 判断 Path A/B/C；
- 执行对应 Revision CAS；
- 同一次 C1 提交正式数据与所有关联记录；
- 返回明确的 outcome 和 Revision 信息。
16.6 Confirmation Event
confirmFact(...)
confirmConstraint(...)


必须：
- 由真实用户操作触发；
- 有稳定 confirmation_action_id；
- 有唯一目标；
- 关联原始 source_turn_id；
- 通过合法组合校验；
- 与目标事实和事件记录同次提交；
- 幂等重放不能重复确认或更改目标。
16.7 Opening Anchor
createOpeningAnchor(...)
confirmOpeningAnchor(...)
resetOpeningAnchor(...)


必须：
- 校验 Session；
- 校验专用 Anchor 身份；
- 校验消息身份和角色；
- 追加历史而不是覆盖历史；
- 与 ControlPlane 同次提交；
- 不批量确认 Facts 或 Constraints。

17. 全局不变量（Global Invariants）
以下规则优先级高于单个函数的局部实现。任何代码、测试或 UI 流程都不能破坏它们。
编号	不变量	违反后果
GI-01	正式 RealityFacts、Constraints、Hypotheses、DIRs、Conflicts 只能以 DC 为权威	FAIL
GI-02	agent_v2 不得覆盖正式 DC 或 ControlPlane	FAIL
GI-03	每次 encrypted Session blob 写入都必须经过 Session CAS	FAIL
GI-04	row/blob 的 session_revision 必须一致	FAIL
GI-05	row/blob 的 dc_write_revision 必须一致	FAIL
GI-06	Generation Base Revision 在任务生命周期中不可改变	FAIL
GI-07	Session Revision 可以随聊天和流程操作前进，但不能改变 Generation Base	FAIL
GI-08	旧 Generation 结果不能覆盖新 DC	FAIL
GI-09	Generation collision 检查必须早于幂等 skip	FAIL
GI-10	同一个 Generation 不能绑定不同 client_task_id	FAIL
GI-11	同一个幂等键不能绑定不同 Generation 操作	FAIL
GI-12	Path B 不得重复写 DC 或重复执行 side effects	FAIL
GI-13	Path C 不得重复写 DC	FAIL
GI-14	Path A 的 DC、Registry、Binding、TaskContext 和幂等记录必须同次提交	FAIL
GI-15	CAS 失败后必须对最新 Session 重放 mutation，不能写旧整包快照	FAIL
GI-16	消息通过稳定 client_id 去重，不能静默覆盖不同内容	FAIL
GI-17	Gate 整体确认不能批量确认 Facts 或 Constraints	FAIL
GI-18	user_estimate 始终保持 unverified	FAIL
GI-19	independently_verified 不自动产生 user_confirmed	FAIL
GI-20	Agenda covered 不等于 DIR known	FAIL
GI-21	Call A Mapper 不能创建 RealityFact	FAIL
GI-22	Call B 一个 AgendaItem 只能对应一个 DIR	FAIL
GI-23	Fingerprint 与 Mapper 必须消费同一个 Normalized Object	FAIL
GI-24	数组规范化不能改变原始元素身份和位置	FAIL
GI-25	Opening Anchor 必须是专用身份，不能由普通消息 ID 推断	FAIL
GI-26	Reload 不得重新生成已有任务的身份和 base	FAIL
GI-27	Job 创建成功但本地绑定失败时不得盲目创建新 Job	FAIL
GI-28	只有 C1 核心事务成功，正式内存状态才能采用候选数据	FAIL
GI-29	不增加新的数据库或服务端分布式事务系统	FAIL
GI-30	Phase 3 不得提前实现 Stage 3 Freeze 或 Stage 4	FAIL

18. 自动化验收测试矩阵
测试必须覆盖实际持久化边界，而不只是纯函数或 Map 模拟。
18.1 Revision 与 CAS
ID	测试场景	预期结果
P3-61	pending_create 已让 Session Revision +1，Apply 使用最新 Session Revision	成功；DC Base 仍为原始值
P3-62	普通 Session 写入发生 CAS 冲突	Reload 最新 Session，重放原 mutation
P3-63	两个并发聊天消息写入	两条消息都保留，按 client_id 去重
P3-64	row/blob Session Revision 不一致	硬失败，不自动修复
P3-65	row/blob DC Revision 不一致	硬失败，不自动修复
P3-66	两个 Tab 同时提交不同 Session mutation	不能互相覆盖
P3-67	两个 Tab 同时启动同一 Generation	只能有一个有效任务身份
P3-68	Path A 与聊天消息并发	消息保留；DC Base 不变时允许 Generation 提交
P3-69	Path A 期间其他操作改变 DC Revision	Generation Base Stale，硬失败
P3-70	加密失败	无任何 Revision 或 blob 变化
P3-71	Dexie 事务中途失败	blob、Revision、索引整体回滚

18.2 Generation 身份、Registry 与 Binding
ID	测试场景	预期结果
P3-72	TaskContext 与 Registry 的 client_task_id 不一致	硬失败
P3-73	同 Generation ID、不同 client_task_id	硬失败
P3-74	同 Generation ID、不同 base revision	硬失败
P3-75	同 Generation ID、不同 fingerprint	硬失败
P3-76	同 Generation ID、不同 fingerprint version	硬失败
P3-77	同一 idempotency key 被绑定到两个任务	硬失败
P3-78	Generation collision 与已完成幂等 key 同时存在	先检查 collision，不得直接 skip
P3-79	相同任务、相同 fingerprint、相同 base，使用新 key	Path C
P3-80	相同任务重复提交同一个 key	Path B
P3-81	不同 Session 使用相同 Generation ID	相互隔离
P3-82	缺少 session_id 或 session_id 非法	所有正式 API 拒绝

18.3 Path A/B/C
ID	测试场景	预期结果
P3-83	首次合法提交	Path A，DC 和 Registry 同次提交
P3-84	Path A 成功后同 key 重放	Path B，不再写入
P3-85	Path A 成功后新 key 重放	Path C，DC Revision 不变
P3-86	Path B 时当前 DC 已经前进	返回旧提交凭据，并明确 original_result_is_current=false
P3-87	Path C 连续重复执行	只登记必要的新 Binding，不重复写 DC
P3-88	Path B 响应丢失后 Reload	能够恢复原提交结果
P3-89	Path A 提交成功但 UI 未收到响应	Reload 后通过 Binding/Registry 判断已完成
P3-90	Mapper 产生空结果	不得登记 completed
P3-91	Registry 已写入但 Binding 未写入的模拟故障	整体事务失败，不留下半成品

18.4 TaskContext 与远程 Job 恢复
ID	测试场景	预期结果
P3-92	保存 pending_create 后 Reload	恢复同一 client_task_id 和 base
P3-93	远程 Job 创建成功、本地绑定成功	TaskContext 进入 running
P3-94	远程 Job 创建成功、本地绑定失败	recovery_required，不创建新身份
P3-95	Reload 后通过 metadata 找到原 Job	补绑原 job_id
P3-96	远程 Job 仍在运行	不创建第二个 Job
P3-97	服务端明确报告 Job 失败	进入失败状态，保留原身份
P3-98	任务结果返回时 DC Base 已变化	硬失败，不写旧结果
P3-99	TaskContext 标记 completed，但 Registry 不存在	状态不一致，硬失败
P3-100	Registry completed，但 TaskContext 仍 running	状态不一致，硬失败

18.5 ControlPlane
ID	测试场景	预期结果
P3-101	ControlPlane 出现未知字段	Runtime Validator 拒绝
P3-102	已知字段类型错误	拒绝，不默认转换
P3-103	AgentPhase 非法值	拒绝
P3-104	AgendaItem 重复 ID	拒绝
P3-105	agent_v2 与正式 ControlPlane 冲突	ControlPlane 权威
P3-106	Reload 恢复 ControlPlane	完整恢复，不仅恢复 current_phase

18.6 Confirmation Event 与 Opening Anchor
ID	测试场景	预期结果
P3-107	用户确认单条 RealityFact	只确认该 Fact
P3-108	Gate 整体确认	不产生批量 Fact Confirmation Event
P3-109	同 action ID 重复点击同一目标	幂等 skip
P3-110	同 action ID 用于不同目标	硬失败
P3-111	event target 与 event_type 不匹配	硬失败
P3-112	source_turn_id 不存在	硬失败
P3-113	用户估计得到确认	保持 unverified
P3-114	independently_verified 没有用户确认事件	user_confirmed=false
P3-115	Constraint 非法组合	硬失败
P3-116	普通 assistant 消息被用作 Opening Anchor	硬失败
P3-117	Opening Anchor 与 Session 不匹配	硬失败
P3-118	Gate Reset	旧 Anchor cleared，历史保留，新 Anchor 创建
P3-119	Reload 后 Gate History 恢复	状态完整且唯一
P3-120	Gate 确认后用户再次点击旧 Anchor	不重复改变状态

18.7 Normalization 与 Mapper
ID	测试场景	预期结果
P3-121	NFC 等价字符串	Fingerprint 一致
P3-122	前后空白差异	按规范化规则得到一致结果
P3-123	undefined / null / 空字符串	规范化结果一致
P3-124	数组元素顺序变化	Fingerprint 变化
P3-125	modern_action_frames 前置空元素	后续 Hypothesis slot 保留原始位置
P3-126	chart_anchors 顺序变化	Fingerprint 变化
P3-127	Mapper 使用字段变化但 fingerprint 未升级	测试失败
P3-128	同一 Normalized Object 输入 Mapper 和 Fingerprint	结果一致且稳定
P3-129	Call B Agenda 重复 ID	硬失败，不合并
P3-130	Agenda covered 状态变化	不得改变 DIR current_state

18.8 必须通过的核心测试
以下测试是 Phase 3 的最低阻断集合：

P3-61、62、63、67、68、69、72、73、74、78、80、86、87、94、98、101、107、110、113、116、118、121、125、128、129、130

任何一项失败，Phase 3 不得验收通过。

19. 测试执行与验收证据
19.1 测试层级
必须具备三层测试：

第一层：纯逻辑测试

覆盖：
- Normalization；
- Fingerprint；
- Mapper；
- Registry 判断；
- Path A/B/C 判定；
- Confirmation Event 合法性；
- ControlPlane Runtime Validator。
第二层：真实 IndexedDB 集成测试

必须使用 fake-indexeddb 或等价的真实 IndexedDB 兼容实现，覆盖：
- Dexie transaction；
- Revision CAS；
- 同事务多表写入；
- 事务失败回滚；
- Reload；
- 多 Session 隔离；
- 同一 Session 的并发写入。
纯 Map 模拟不能代替这一层。

第三层：端到端控制流测试

覆盖：
- Opening Anchor 创建与确认；
- Call A 任务创建、Job 绑定、结果提交；
- Call B 任务创建、Job 绑定、结果提交；
- Reload 恢复；
- Path A/B/C；
- 失败和重试。
19.2 测试报告必须包含
开发人员提交时必须提供：
1. 测试命令；
2. 实际执行结果；
3. 每组测试通过数量；
4. 失败数量；
5. 测试源码路径；
6. 测试覆盖的具体行为；
7. tsc 实际执行结果；
8. 与基准 commit 的差异；
9. CI workflow run 链接或可验证记录。
不能仅在 PR 描述中写“测试通过”。

没有实际运行证据的测试只能标记为“已编写，未执行”。
19.3 CI 要求
Phase 3 专项测试必须由 CI 实际执行。

Vercel Preview Success 不能代替专项测试 CI。

GitHub Actions 中不存在对应测试运行记录时，不能声称专项 CI 已通过。

20. 实施前必须交付的工程材料
开发人员在获得实施授权前，必须先根据本文件提交实施方案。

方案至少包含：
材料	必须回答的问题
文件变更清单	每个新增、修改文件的职责
写入入口清单	所有写入 encrypted_data 的代码路径
Session Revision 迁移	旧 Session 如何安全初始化 Revision
CAS 实现设计	Dexie transaction 中如何读取、比较、写入
Mutation 设计	如何避免旧整包 Session 覆盖
Generation 状态机	每个状态的创建者、转换条件和失败行为
Registry / Binding	存储位置、唯一性、碰撞检查顺序
TaskContext	Reload、远程 Job 绑定失败和恢复策略
ControlPlane	完整类型、Runtime Validator 和兼容策略
Confirmation Event	Fact / Constraint 目标和用户操作证据
Opening Anchor	消息标记、唯一性和 History 转换
Normalization	同一个 Normalized Object 如何供 Mapper 和 Fingerprint 使用
测试矩阵	对应本文件每一个测试 ID 的测试文件和执行命令
数据迁移	旧 Session 和历史字段如何处理，不丢失已有数据

实施方案必须明确列出尚未解决的问题，不能把“以后补充”当成已满足本规范。

21. 最终验收标准与变更控制
21.1 验收 PASS
只有同时满足以下条件，Phase 3 才能通过：
1. 实际实现符合本文件全部 MUST / MUST NOT 条款；
2. 全局不变量全部成立；
3. 核心测试矩阵全部通过；
4. IndexedDB 集成测试通过；
5. 端到端控制流测试通过；
6. TypeScript 检查通过；
7. 没有未解决的 P0/P1 阻断问题；
8. 数据迁移不会破坏既有 Session；
9. PR diff 与批准的实施方案一致；
10. 未越过 Phase 3 的范围边界。
21.2 验收 FAIL
以下情况直接 FAIL：
- 任何核心 Revision/CAS 规则不成立；
- 任何 Generation collision 可以绕过；
- 任何旧 Generation 结果可能覆盖新 DC；
- Registry、Binding、TaskContext 可能产生不一致；
- 任何正式事实可能由模型或 Gate 自动确认；
- Fingerprint 与 Mapper 输入不一致；
- 有 Session blob 写入入口绕过 CAS；
- 测试只模拟内存而没有验证 IndexedDB 事务；
- 关键测试缺失或没有实际执行证据。
21.3 设计变更控制
本文件定稿后：
- 不得因实现困难自行降低 MUST 条款；
- 不得用“先上线再修”绕过核心一致性规则；
- 不得在实施 PR 中悄悄改变 A+B SoT；
- 不得擅自扩大 Phase 3 范围；
- 如发现本文件内部存在逻辑矛盾，必须先提交书面变更请求；
- 变更请求必须说明原规则、矛盾证据、影响范围、替代方案和测试变化。
新发现的问题必须归类为：
1. 本文件已有规则未实现；
2. 本文件规则实现不完整；
3. 本文件内部存在矛盾；
4. 基准源码与本文件假设不符；
5. 真正超出本阶段范围的新需求。
不能把已经明确规定的内容再次作为“新发现”提出，也不能因为某个测试尚未写出，就认为对应工程规则已经满足。
21.4 授权边界
本文件的完成、审核通过或被开发人员接受，均不自动构成代码实施授权。

后续必须依次取得：
1. 用户批准本工程契约；
2. 用户批准开发人员的实施方案；
3. 用户批准代码实施；
4. 用户单独决定是否合并；
5. 用户单独决定是否部署生产。

22. 本次定稿的明确限制
有两项实施前仍须通过真实代码和运行环境核实，不能凭设计文件假设：
1. 远程 Job 恢复能力： 必须确认当前 OpenRouter/任务服务是否能够通过 metadata 或其他可靠方式查询 client_task_id 对应的既有 Job。如果不能，开发人员必须提出可验证的恢复方案。
2. 全部 Session 写入入口： 必须在实施阶段完成仓库级搜索，列出所有 POJUSessionRecord.encrypted_data 写入路径，并证明没有 CAS 绕过路径。当前核对的 savePOJUSessionCore() 不能代表整个仓库的所有写入入口。
这两项不是允许跳过的要求，而是实施方案必须提供证据的前置条件。

23. 定稿结论
等待用户审阅
本规范已经把 Phase 3 的主要工程问题统一到一套规则中：
- 双 Revision 与 CAS；
- Session mutation 和并发写入；
- Generation 身份与历史 Registry；
- TaskContext 生命周期与 Reload 恢复；
- Path A/B/C；
- C1 原子提交；
- ControlPlane 权威与 Runtime Validator；
- Fact / Constraint Confirmation Event；
- Opening Anchor；
- Call A/B Normalization、Fingerprint 和 Mapper；
- 异常处理、测试矩阵和验收规则。