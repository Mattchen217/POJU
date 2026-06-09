# POJU 聊天页重建指令(给 Cursor)

> 目标:把 POJU 聊天页换成 Claude 规格的 UI(PC + PWA),保留全部现有功能。
> 原则:**UI / CSS / 布局直接用给定的两个文件,你只接数据,不要改样式、不要"优化"尺寸。**
> 给定文件:`poju-chat.css` + `PojuChat.tsx`(已写好,照放)。

---

## ⛑ 背景(为什么重建)

之前 10+ 轮改不好,根因有二:
1. 旧 CSS 多文件互相覆盖(poju-chat-pwa.css / browser-desktop.css / Tailwind 工具类),patch 被吃掉。
2. 消息文本被 **Tailwind `prose` 类的 `max-width: 65ch`(≈540px)** 锁死,改外层容器无效。

新方案:独立作用域 `.pchat` + 独立 CSS + 自定义文本渲染(**不用 prose**),关键尺寸加 `!important`,彻底甩开旧规则。

---

## 第 1 步:自查并记录(先做,贴报告)

报告以下内容,**不要改任何代码**:

1. **现有聊天页功能清单**(逐条):会话列表 / 新建会话 / 切换 / 删除 / 用户消息 / AI 消息 / 流式输出 / THINKING 显示 / 分析报告分段渲染 / 复制 / 朗读 / 输入框 / 附件 / 语音 / 发送 / 保存 Archive / profile(八字)上下文 …… 实际有哪些。
2. **数据结构**:现有的 Session、Message 类型定义(字段名)。
3. **数据来源**:会话列表、当前会话消息从哪个 store / hook / API 拿(文件 + 函数名)。
4. **发送消息**:走哪个函数 / API?是否流式?流式文本怎么拿到?
5. **新建 / 切换 / 删除会话**:对应函数名。
6. **保存 Archive**:在哪触发、调用什么。
7. **现有聊天页相关文件清单**:组件文件 + CSS 文件(poju-chat-pwa.css / browser-desktop.css 等)+ 路由页面文件,全部列出,标注哪些只服务聊天页(可删)、哪些被别处共用(不可删)。

---

## 第 2 步:删除 / 停用旧文件(基于第 1 步)

- 删除或停用**只服务聊天页**的旧组件 + 旧 CSS(poju-chat-pwa.css 里管聊天页排版的部分;browser-desktop.css 若只管聊天页)。
- 被别处(Glyph/Match)共用的不要删,只把对聊天页的引用移除。
- 路由页面(如 `app/poju/session/[id]/page.tsx` 或现有聊天页路由)清空旧 UI,准备渲染新组件。

---

## 第 3 步:放入新代码(照抄,不改)

1. 把 `poju-chat.css` 放到聊天页目录(如 `components/poju/poju-chat.css`)。
2. 把 `PojuChat.tsx` 放到同目录(`components/poju/PojuChat.tsx`)。
3. **一个字都不要改样式 / 尺寸**。尺寸已写死(侧栏 280 / 内容 768 / 字 16 / 输入框圆角 24),且加了 `!important`。

---

## 第 4 步:接数据(你唯一要"思考"的地方)

在聊天页路由里渲染 `<PojuChat />`,把第 1 步记录的现有数据 / 函数接到 props:

```tsx
import PojuChat, { type PojuMessage, type PojuSession } from "@/components/poju/PojuChat";

export default function PojuChatRoute() {
  // ↓↓↓ 用现有的 store / hook / api 填充,不要新建逻辑 ↓↓↓
  const sessions = /* 现有会话列表，映射成 {id,title} */;
  const currentSessionId = /* 现有当前会话 id */;
  const messages = /* 现有消息，映射成 {id,role:"user"|"assistant",content} */;
  const isStreaming = /* 现有流式状态 */;
  const streamingText = /* 现有正在流式的正文 */;
  const thinkingText = /* 现有 THINKING 文本(没有就传 undefined)*/;

  return (
    <PojuChat
      sessions={sessions}
      currentSessionId={currentSessionId}
      messages={messages}
      isStreaming={isStreaming}
      streamingText={streamingText}
      thinkingText={thinkingText}
      onSend={(text) => {/* 调现有发送/流式 api */}}
      onNewSession={() => {/* 调现有新建会话 */}}
      onSelectSession={(id) => {/* 调现有切换会话 */}}
      onDeleteSession={(id) => {/* 调现有删除会话 */}}
      onCopy={(text) => navigator.clipboard.writeText(text)}
      onSpeak={(text) => {/* 调现有朗读 */}}
    />
  );
}
```

要点:
- **数据映射**:把现有 Message/Session 字段映射成组件要的 `{id,role,content}` / `{id,title}`。role 用 `"user"` / `"assistant"`。
- **Archive 保存**:在现有 `onSend` 完成 / 会话结束的逻辑里继续调用现有的 Archive 保存(组件不管这个,你在 onSend 回调里保留现有逻辑)。
- **图标**:组件里用 emoji 占位(📎🎤↑⧉🔊☰),可替换成现有图标库(lucide-react 等),但**不要改尺寸 class**。
- **PWA**:`html.pwa-mode` 已在 CSS 里处理安全区,不用额外做。

---

## 第 5 步:验证(必须用 devtools 量,贴数字)

打开聊天页,F12 → Computed,量并贴出实际值:

| 元素 | 期望值 | 实测 |
|---|---|---|
| `.pchat__sidebar` width | 280px | ? |
| `.pchat__messages` max-width | 768px | ? |
| `.pchat__ai` font-size | 16px | ? |
| `.pchat__ai` 实际渲染宽度(不被 540 限制) | ~720px(768-padding) | ? |
| 输入框图标垂直居中 | 是 | ? |

再贴三张截图:
1. **PC 宽窗**:侧栏 280 + 消息居中 768 + 字 16 + 输入框图标居中
2. **窄窗(<768px)**:抽屉侧栏 + 全宽 + 贴底输入框
3. **功能验证**:发一条消息能流式输出、能切换会话、能存 Archive

---

## 关键提醒(给 Cursor 划重点)

1. **样式不要动**:`poju-chat.css` 照放,尺寸已写死 + `!important`。你改了就前功尽弃。
2. **不用 prose**:组件自己渲染 AI 文本(renderAiContent),不要套 `prose` / `typography` 类(那是 540px 真凶)。
3. **必须删旧 CSS 引用**:否则旧规则可能残留打架(虽然新的有 `!important`,但删干净最稳)。
4. **你只接数据**:UI 100% 由给定文件控制,你把现有 store/api 接到 props,别新建 UI 逻辑。
5. **验证用 devtools 量数字**,不是"我改好了"——量出 768 / 280 / 16 才算成。
