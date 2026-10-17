const fs = require("fs");
function read(p) { return fs.readFileSync(p, "utf8"); }
function write(p, s) { fs.writeFileSync(p, s, "utf8"); console.log("wrote", p); }

// ---------- pivot-dual-party-policy: no re-ask after intentional skip ----------
{
  const p = "lib/llm/prompts/pivot-dual-party-policy.ts";
  let s = read(p);
  const old = "- 若用户核心问的是「我们合不合 / 双人契合度」且尚无对方盘：可点明补充生辰或去 Match 看完整合盘；Pivot 仍只写【你侧】怎么走。";
  // Try flexible match if encoding differs
  if (s.includes(old)) {
    s = s.replace(
      old,
      "- 若用户核心问的是「我们合不合 / 双人契合度」且门未结案（尚无对方盘、未 skip）：可点明补充生辰或去 Match 看完整合盘；Pivot 仍只写【你侧】怎么走。\n- **已 skip / partner_bazi=absent（用户已结案）**：禁止再索要对方生辰、禁止暗示「还在等对方盘」、禁止再出收集芯片；只按当事人盘 + 自述继续。"
    );
    write(p, s);
  } else {
    // fuzzy: find the line with Match
    const lines = s.split(/\r?\n/);
    let hit = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("Match") && lines[i].includes("对方盘") && lines[i].includes("生辰")) {
        hit = i;
        break;
      }
    }
    console.log("policy Match line idx", hit);
    if (hit >= 0) {
      console.log(JSON.stringify(lines[hit]));
      lines[hit] =
        "- 若用户核心问的是「我们合不合 / 双人契合度」且门未结案（尚无对方盘、未 skip）：可点明补充生辰或去 Match 看完整合盘；Pivot 仍只写【你侧】怎么走。";
      lines.splice(
        hit + 1,
        0,
        "- **已 skip / partner_bazi=absent（用户已结案）**：禁止再索要对方生辰、禁止暗示「还在等对方盘」、禁止再出收集芯片；只按当事人盘 + 自述继续。"
      );
      write(p, lines.join("\n"));
    }
  }
}

// ---------- opening-phase-v6: strengthen closed-gate line for skip ----------
{
  const p = "lib/llm/phases/opening-phase-v6.ts";
  let s = read(p);
  const old =
    "本回合若是续开：承接原问题与期望澄清；可用结构锚轻校准边界表述，禁止合盘专章、禁止再问对方出生信息。";
  if (s.includes(old)) {
    s = s.replace(
      old,
      "本回合若是续开：承接原问题与期望澄清；可用结构锚轻校准边界表述，禁止合盘专章、禁止再问对方出生信息；path=solo / partner_bazi=absent 时禁止暗示还在等对方盘或再出收集芯片。"
    );
    write(p, s);
  } else {
    const i = s.indexOf("本回合若是续开");
    console.log("opening feed line", i, i>=0 ? JSON.stringify(s.slice(i, i+120)) : "");
  }
}

console.log("part5 policy done");
