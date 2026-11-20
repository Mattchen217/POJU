二、部署后的 DI2 验收标准
我建议把验收拆成四个层次。前两层验证系统能否真实运行，后两层验证它是否真正符合 DI2 的产品和架构要求。
A. 真实模型调用与动态问答
必须通过
验收项	通过标准
Fresh Session	创建新 Session，初始化成功，没有继承其他 Session 的状态
首轮分析	真实 OpenRouter 请求成功，模型收到正确的用户问题和个人资料
Decision Blueprint	根据用户真实问题建立调查方向，而不是套用固定模板
Adaptive Q&A	每轮回答后重新评估状态，产生与当前缺口相关的新问题
问题变化	后续问题必须体现前面回答带来的信息变化，不能机械重复
事实处理	confirmed、unknown、declined、unverified 等状态不能混淆
追问边界	遵守问题预算和单轮一个主要问题的要求
模型失败	超时、拒答、无效 JSON 或 Provider 错误不能造成虚假的状态推进

核心判断： 真实模型必须参与决策理解和问题生成。不能只是 UI 显示动态问题，底层仍然运行固定脚本。
B. Decision Understanding、Readiness 和 Freeze
必须通过
验收项	通过标准
Decision Context	用户回答能够正确写入 Context
Reality Facts	事实与假设分离，模型推断不能伪装成用户确认
Conflict	互相矛盾的信息能够保留并触发澄清
DIR	已知、未知、冲突、不适用等状态正确区分
Readiness	尚未达到交付条件时不能提前要求最终确认
User Confirmation	必须有真实用户明确确认
Freeze	只有服务端有权执行 Freeze
Freeze Receipt	生成的 Receipt 与实际 Session、Context 版本及 Hash 对应
Freeze 之后	Context 发生变化时，不能继续使用过期 Freeze 生成报告

特别注意：Agenda 已经覆盖，不等于 DIR 已经变成 known。 不适用（N/A）也不能由模型自行推断，必须满足对应的证据与授权规则。
C. 8 页报告与持久化恢复
必须通过
验收项	通过标准
Profile	正确使用用户选定的个人资料
Base Analysis	有资料时正确传入；没有资料时不能伪造
Personal Analysis	基于真实 Profile 和当前决策问题生成
报告结构	完整生成规定的 8 页
报告内容	每页与用户的实际问题相关，不是通用人生建议
报告绑定	绑定正确的 Session、Freeze、Context Hash、Profile 和 Job
Job 执行	任务中断后能够继续，不重复生成已完成内容
Refresh	刷新页面能够恢复当前 Session 和报告状态
重复请求	不重复扣费，不重复创建报告任务
最终交付	报告持久化成功后才标记为 delivered

这里有一个重要的验收要求：不能仅检查页面上是否出现 8 个页面标题。必须检查每一页的实际内容、完成状态、数据绑定和持久化结果。
D. 生产基础设施与故障恢复
必须通过
这是此前确定性测试无法完全覆盖的部分。
测试	通过标准
Hosted Redis	真实 Upstash Redis 工作，不使用 MemoryKv fallback
多实例 CAS	两个独立服务端实例同时修改同一个 Session 时，不发生静默覆盖
Session 并发	旧版本写入被正确拒绝
DC Ledger	写入、版本、Hash 与 Session 状态一致
Inngest	真实事件可以接收、执行、重试
Worker Recovery	Worker 中断后能够恢复任务
Billing	授权、扣费、拒绝、重试遵守幂等规则
API Security	浏览器不能绕过服务端权限直接推进权威状态
Profile Binding	不能通过伪造 Profile ID 使用其他档案
Report Authorization	未授权、未 Freeze 或过期的任务不能交付报告

三、真实产品验收测试顺序
建议只使用一个专门的测试账户和一份专门的真实 Profile，避免混入历史 Session。测试授权使用测试 Pass 或专门配置的测试 entitlement，不要意外产生真实客户扣费。
DI2 真实验收路线
1. 测试 1：创建全新 Session
   
   从正常 POJU 产品入口开始，不使用 Delivery Lab 替代。确认 Profile 正确绑定，Session 初始化成功。
2. 测试 2：完成真实动态问答
   
   提供一个有真实复杂度的决策问题，连续回答模型提出的问题。检查问题是否逐步深入、是否利用前面回答、是否存在重复追问。
3. 测试 3：检查 Decision Understanding
   
   检查系统是否正确理解问题、事实、约束、冲突和未知项。故意提供一条前后矛盾的信息，观察系统是否要求澄清。
4. 测试 4：Readiness 与最终确认
   
   检查未满足条件时是否继续调查；达到条件后是否要求用户明确确认。
5. 测试 5：Freeze
   
   确认 Freeze Receipt 真实产生，版本和 Hash 正确。尝试修改冻结后的 Context，确认过期状态不会继续生成报告。
6. 测试 6：生成 8 页报告
   
   让系统使用真实模型生成 Personal Analysis 和 8 页报告。检查内容是否真正回应原始决策问题。
7. 测试 7：刷新与恢复
   
   在报告生成过程中刷新页面；重新打开 Session；检查任务能否恢复，不重复扣费或重复生成。
8. 测试 8：并发与故障测试
   
   两个浏览器或两个独立服务端请求同时修改 Session；模拟任务中断、Redis 错误和模型超时，检查系统能否安全失败和恢复。

四、最终验收的 Go / No-Go 标准
我建议采用以下门槛，不要用一个简单的“Build 成功”来代表整个 DI2 已完成。
级别	判定标准
G0：部署完成	main 已更新，Vercel Production 部署成功
G1：模型可运行	真实 OpenRouter 调用成功，Profile 传递正确
G2：主路径通过	Fresh Session → 动态问答 → Understanding → Confirmation → Freeze
G3：报告通过	Personal Analysis + 8 页报告生成、绑定、持久化成功
G4：恢复通过	Refresh、Worker Recovery、幂等、并发和多实例 CAS 通过
G5：产品验收通过	完整真实用户流程稳定，内容质量符合产品要求

最终 GO 条件：G0–G5 全部通过。

以下情况一律不能判定为通过：
- 用 Mock 模型结果冒充真实调用。
- 用 MemoryKv 测试冒充 Hosted Redis 测试。
- 只有报告页面，没有真实报告持久化。
- Readiness 未完成却能 Freeze。
- Freeze 与报告的 Context Hash 不一致。
- 刷新后丢失 Session 或重复扣费。
- 模型返回错误后系统仍然显示成功。