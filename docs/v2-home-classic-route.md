# V2 首页 + Classic 固定入口

## 路由
| URL | 内容 |
|-----|------|
| `/` | V2 落地页（iframe → `/v2-landing`）→ CTA 进 `/app?tab=*` |
| `/classic` | 原版营销落地页（`DsHomePage`），暂留，后续统一删除 |
| `/app?tab=atmos\|poju\|match\|syncro\|glyph` | 工作台对应板块 |

## 兼容
- `/?ui=classic` → 客户端重定向到 `/classic`
- 右下角开关：Classic → `/classic`；Workspace → `/`

## V2 CTA
场景区 / Ready to begin / Privacy 等原先 `href="#"` 已改为工作台或 `/privacy`（三份 HTML 同步）。
