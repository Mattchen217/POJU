#!/usr/bin/env node
/**
 * Oracle 签数据 MD → JSON 转换脚本
 * 
 * 用途：
 *   把观音灵签的中英文混合 Markdown 数据,
 *   转换为 POJU 项目使用的标准 JSON 格式
 * 
 * 输入：
 *   public/oracle/data/signs.md   (你的 MD 数据源文件)
 * 
 * 输出:
 *   public/oracle/data/signs.json  (Cursor 项目使用的 JSON 数据)
 * 
 * 用法:
 *   node scripts/parse-signs-md-to-json.js
 *
 * 调试模式(只解析前 N 个签,详细打印):
 *   node scripts/parse-signs-md-to-json.js --debug --limit 3
 */

const fs = require('fs');
const path = require('path');

// ──────────────────────────────────────────────────────────
// 配置
// ──────────────────────────────────────────────────────────

const INPUT_PATH = path.join(__dirname, '..', 'public', 'oracle', 'data', 'signs.md');
const OUTPUT_PATH = path.join(__dirname, '..', 'public', 'oracle', 'data', 'signs.json');

// 命令行参数
const args = process.argv.slice(2);
const DEBUG = args.includes('--debug');
const LIMIT_INDEX = args.indexOf('--limit');
const LIMIT = LIMIT_INDEX !== -1 ? parseInt(args[LIMIT_INDEX + 1], 10) : null;

// ──────────────────────────────────────────────────────────
// 中文等级 → 英文等级映射
// ──────────────────────────────────────────────────────────

// 12 地支宫位元信息表 (给 LLM 解读用的五行/季节/象征对照)
const PALACE_META = {
  '子': { element: 'water', season: 'winter / midnight',         symbol: 'hidden, gestating, beginning' },
  '丑': { element: 'earth', season: 'winter / deep night',       symbol: 'storing, accumulating, transformation' },
  '寅': { element: 'wood',  season: 'spring / dawn',             symbol: 'sprouting, breakthrough, vitality' },
  '卯': { element: 'wood',  season: 'spring / morning',          symbol: 'growth, expansion, opening upward' },
  '辰': { element: 'earth', season: 'late spring',               symbol: 'containing, transitioning, stabilizing' },
  '巳': { element: 'fire',  season: 'summer / late morning',     symbol: 'manifesting, insight, lively change' },
  '午': { element: 'fire',  season: 'summer / midday',           symbol: 'peak, outward radiance, flourishing' },
  '未': { element: 'earth', season: 'late summer',               symbol: 'settling, savoring, internalizing' },
  '申': { element: 'metal', season: 'autumn / afternoon',        symbol: 'harvest, decisive cut, judgment' },
  '酉': { element: 'metal', season: 'autumn / dusk',             symbol: 'completion, clarity, finalizing' },
  '戌': { element: 'earth', season: 'late autumn',               symbol: 'guarding, loyalty, gathering inward' },
  '亥': { element: 'water', season: 'winter / night',            symbol: 'submerging, returning, accumulating depth' },
};

/**
 * 把 MD 中的中文等级关键词映射到 5 个英文等级之一
 * 
 * 映射规则(按优先级,从最具体到最一般):
 *   上上 → divine_tailwind (5%)
 *   上中/上吉 → fair_sky    (25%)
 *   中签/中吉 → still_water (40%, 最常见)
 *   中下/中平 → crosswind   (25%)
 *   下下 → eye_of_storm     (5%)
 *   
 * 单纯的"上签"或"下签",根据上下文推断:
 *   上签 → divine_tailwind (传统观音灵签里"上"独立出现极少)
 *   下签 → crosswind        (一般是"中下"的一种)
 */
function mapLevel(zhLevel) {
  // 必须按优先级匹配,从最长最具体的开始
  if (zhLevel.includes('上上')) return 'divine_tailwind';
  if (zhLevel.includes('下下')) return 'eye_of_storm';
  if (zhLevel.includes('上中') || zhLevel.includes('上吉')) return 'fair_sky';
  if (zhLevel.includes('中下') || zhLevel.includes('中平')) return 'crosswind';
  if (zhLevel.includes('中吉') || zhLevel === '中签') return 'still_water';
  
  // 其他单字 fallback
  if (zhLevel.includes('中')) return 'still_water';
  if (zhLevel.includes('上')) return 'fair_sky';  // 单纯"上签"
  if (zhLevel.includes('下')) return 'crosswind'; // 单纯"下签"
  
  // 兜底: 抛错让用户检查数据
  throw new Error(`Unknown level format: "${zhLevel}"`);
}

/**
 * 从行文本中识别英文等级名(fallback 用)
 * 用于处理 "吉凶宫位: Fair Sky 050" 这种缺中文的特殊情况
 */
function inferLevelFromEnglish(line) {
  const englishLevels = {
    'Divine Tailwind': 'divine_tailwind',
    'Fair Sky': 'fair_sky',
    'Still Water': 'still_water',
    'Crosswind': 'crosswind',
    'Eye of Storm': 'eye_of_storm',
  };
  
  for (const [enName, levelId] of Object.entries(englishLevels)) {
    if (line.includes(enName)) {
      return levelId;
    }
  }
  return null;
}

// ──────────────────────────────────────────────────────────
// 工具函数
// ──────────────────────────────────────────────────────────

function log(...args) {
  console.log(...args);
}

function debugLog(...args) {
  if (DEBUG) console.log('[DEBUG]', ...args);
}

function warn(...args) {
  console.warn('⚠ ', ...args);
}

function error(...args) {
  console.error('✗ ', ...args);
}

// ──────────────────────────────────────────────────────────
// 核心:把整个 MD 拆分成单个签的文本块
// ──────────────────────────────────────────────────────────

/**
 * 拆分 MD 为单个签的文本块
 * 
 * 关键观察:
 *   签 1 开头:    "1 观音灵签解签1钟离成道" (无 ## 前缀)
 *   签 2-100 开头: "## 观音灵签2 观音灵签解签2" (有 ## 前缀)
 * 
 * 策略:
 *   寻找符合 /^(##\s+)?观音灵签\d+/ 的行作为分割点
 *   每个分割点之间是一个完整的签
 */
function splitMdIntoSigns(mdText) {
  const lines = mdText.split(/\r?\n/);
  
  const signs = [];
  let currentSignLines = [];
  let currentSignNumber = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 匹配签号开始行 - 支持 5 种格式变体:
    //   格式 A: "001 钟离成道"        (三位数 + 空格 + 人物)
    //   格式 B: "12:武吉遇师"          (数字 + 半角冒号,无空格)
    //   格式 C: "3: 董永遇仙"          (数字 + 半角冒号 + 空格)
    //   格式 D: "83:李渊登位" 或 "83:李渊登位" (全角冒号)
    //   格式 E: "签27: 刘基谏主"       ("签" 前缀 + 数字 + 冒号)
    //
    // 旧格式(向后兼容):
    //   格式 F: "## 观音灵签2 观音灵签解签2"
    //   格式 G: "1 观音灵签解签1钟离成道"
    
    let newSignNumber = null;
    
    // ========== 优先匹配旧格式 ==========
    // 格式 F: "## 观音灵签N"
    const matchOldF = line.match(/^##\s*观音灵签(\d+)/);
    if (matchOldF) {
      newSignNumber = parseInt(matchOldF[1], 10);
    }
    
    // ========== 匹配新格式 ==========
    if (newSignNumber === null) {
      // 格式 E: "签27: 刘基谏主"
      // 同时支持全角冒号 ":(U+FF1A)
      const matchE = line.match(/^签(\d+)\s*[:：]/);
      if (matchE) {
        newSignNumber = parseInt(matchE[1], 10);
      }
    }
    
    if (newSignNumber === null) {
      // 格式 B/C/D: "N:人物" 或 "N: 人物" 或 "N:人物" (全角冒号)
      // 必须是行首数字直接跟冒号(全角或半角)
      // [:：] 包含: U+003A(半角) U+FF1A(全角) U+FE55(小型)
      const matchBCD = line.match(/^(\d+)\s*[:：]\s*\S/);
      if (matchBCD) {
        newSignNumber = parseInt(matchBCD[1], 10);
      }
    }
    
    if (newSignNumber === null) {
      // 格式 A: "001 钟离成道" (三位数 + 空格 + 至少一个非数字字符)
      // 关键:必须避免误匹配数字开头的内容行
      // 三位数 + 空格 + 至少一个汉字
      const matchA = line.match(/^(\d{3})\s+[\u4e00-\u9fa5]/);
      if (matchA) {
        newSignNumber = parseInt(matchA[1], 10);
      }
    }
    
    if (newSignNumber === null) {
      // 格式 G(旧): "1 观音灵签解签1钟离成道" - 仅当尚未找到第 1 签时
      if (currentSignNumber === null) {
        const matchG = line.match(/^(\d+)\s*观音灵签解签\d+/);
        if (matchG) {
          newSignNumber = parseInt(matchG[1], 10);
        }
      }
    }
    
    // 验证签号合法性
    if (newSignNumber !== null) {
      if (newSignNumber < 1 || newSignNumber > 100) {
        // 不在 1-100 范围,可能是误匹配
        newSignNumber = null;
      } else if (currentSignNumber !== null && newSignNumber === currentSignNumber) {
        // 签号没变,可能是签内的内容行,忽略
        newSignNumber = null;
      } else if (currentSignNumber !== null && newSignNumber < currentSignNumber) {
        // 出现倒退签号(比如内容里出现了"3: ..."),忽略
        // 但允许签 100 后回到下一份文档(实际不会出现)
        newSignNumber = null;
      }
    }
    
    if (newSignNumber !== null) {
      // 找到一个新签的开始
      // 保存前一个签(如果存在)
      if (currentSignNumber !== null) {
        signs.push({
          sign_number: currentSignNumber,
          raw_lines: currentSignLines,
        });
      }
      
      currentSignNumber = newSignNumber;
      currentSignLines = [line];
    } else if (currentSignNumber !== null) {
      currentSignLines.push(line);
    }
    // 如果还没找到第一个签,忽略前面的内容
  }
  
  // 处理最后一个签
  if (currentSignNumber !== null) {
    signs.push({
      sign_number: currentSignNumber,
      raw_lines: currentSignLines,
    });
  }
  
  return signs;
}

// ──────────────────────────────────────────────────────────
// 核心:从单个签的文本块解析出结构化数据
// ──────────────────────────────────────────────────────────

/**
 * 从单个签的文本块解析结构化数据
 * 
 * 提取的字段:
 *   - sign_number          签号
 *   - level                英文等级(divine_tailwind/fair_sky/...)
 *   - jixiong_zh           中文吉凶判断("上上"/"中下"/"下下" 等)
 *   - palace_zh            中文地支宫位("子"/"丑"/.../"亥")
 *   - jixiong_palace_full  吉凶+宫位完整原文(如"下下签丑宫")
 *   - palace_meta          地支宫位的五行/季节/象征(给 LLM 用)
 *   - story_figure         典故人物(如"钟离成道"/"苏娘走难")
 *   - verse_lines_en       4 行英文签诗
 *   - summary_line_en      1 句英文签语
 *   - raw_md_content       完整 MD 内容(给 LLM 用)
 */
function parseSign(signNumber, lines) {
  const result = {
    sign_number: signNumber,
    level: null,
    jixiong_zh: null,
    palace_zh: null,
    jixiong_palace_full: null,
    palace_meta: null,
    story_figure: null,
    verse_lines_en: [],
    summary_line_en: null,
    raw_md_content: lines.join('\n').trim(),
  };
  
  // ────────────────────────────────────────
  // 1. 提取典故人物 (从首行)
  // 支持多种格式:
  //   "001 钟离成道"        → "钟离成道"
  //   "002 苏秦不第"        → "苏秦不第"
  //   "7: 苏娘走难"         → "苏娘走难"
  //   "12:武吉遇师"          → "武吉遇师"
  //   "83:李渊登位"          → "李渊登位"
  //   "签27: 刘基谏主"      → "刘基谏主"
  //   "1 观音灵签解签1钟离成道" (旧格式) → "钟离成道"
  // ────────────────────────────────────────
  for (const line of lines) {
    let storyMatch = null;
    
    // 旧格式优先: "N 观音灵签解签N: 人物" 或 "N 观音灵签解签N人物"
    storyMatch = line.match(/^\d+\s*观音灵签解签\d+\s*[:：]?\s*(.+)$/);
    if (storyMatch) {
      result.story_figure = storyMatch[1].trim();
      break;
    }
    
    // 新格式: 行首数字 + 冒号(全/半角) + 可选空格 + 人物
    //   "7: 苏娘走难"  /  "12:武吉遇师"  /  "83:李渊登位"
    storyMatch = line.match(/^\d+\s*[:：]\s*(.+?)\s*$/);
    if (storyMatch) {
      result.story_figure = storyMatch[1].trim();
      break;
    }
    
    // 新格式: "签N: 人物"
    storyMatch = line.match(/^签\d+\s*[:：]\s*(.+?)\s*$/);
    if (storyMatch) {
      result.story_figure = storyMatch[1].trim();
      break;
    }
    
    // 新格式: 三位数 + 空格 + 人物
    //   "001 钟离成道" / "002 苏秦不第"
    storyMatch = line.match(/^\d{3}\s+([\u4e00-\u9fa5].+?)\s*$/);
    if (storyMatch) {
      result.story_figure = storyMatch[1].trim();
      break;
    }
  }
  
  // ────────────────────────────────────────
  // 2. 提取吉凶宫位 → 拆分为吉凶 + 宫位 + 完整原文 + 五行元信息
  // 例如:
  //   "吉凶宫位: 上上签子宫 Divine Tailwind 001"
  //     → jixiong_zh: "上上"
  //     → palace_zh: "子"
  //     → jixiong_palace_full: "上上签子宫"
  //     → palace_meta: {element:"water", season:..., symbol:...}
  //   "吉凶宫位: 中下签子宫 Crosswind 002"
  //     → jixiong_zh: "中下"
  //     → palace_zh: "子"
  //     → jixiong_palace_full: "中下签子宫"
  //
  // 特殊情况:
  //   - 部分签的 MD 写作 "吉凶宫位: Fair Sky 050"(中文部分缺失)
  //     → 直接从英文部分识别 level,jixiong_zh/palace_zh 留 null
  //   - 部分签的 MD 写作 "吉凶宫位: 下签未宫"(无英文部分)
  //     → 通过 jixiong 映射 level
  // ────────────────────────────────────────
  for (const line of lines) {
    if (!line.includes('吉凶宫位')) continue;
    
    // 优先匹配中文 "<吉凶>签<宫位>宫"
    // 例如: "上上签子宫" / "中下签子宫" / "下下签丑宫"
    // 容错: "已宫"是"巳宫"的常见错别字 (U+5DF2 vs U+5DF3)
    const matchZh = line.match(/吉凶宫位\s*[:：]?\s*(\S+?)签([子丑寅卯辰巳已午未申酉戌亥])宫/);
    if (matchZh) {
      result.jixiong_zh = matchZh[1].trim();
      
      // 修正错别字: 已 → 巳
      let palace = matchZh[2].trim();
      if (palace === '已') palace = '巳';
      result.palace_zh = palace;
      
      result.jixiong_palace_full = `${result.jixiong_zh}签${result.palace_zh}宫`;
      result.palace_meta = PALACE_META[result.palace_zh] || null;
      
      // 通过吉凶映射 level
      try {
        result.level = mapLevel(result.jixiong_zh);
      } catch (e) {
        // 如果中文吉凶无法映射,尝试从英文识别
        result.level = inferLevelFromEnglish(line);
        if (!result.level) {
          throw new Error(`Sign ${signNumber}: ${e.message}`);
        }
      }
      break;
    }
    
    // Fallback: 中文部分缺失,直接从英文部分识别
    // 例如 "吉凶宫位: Fair Sky 050"
    const enLevel = inferLevelFromEnglish(line);
    if (enLevel) {
      result.level = enLevel;
      // jixiong_zh / palace_zh / jixiong_palace_full / palace_meta 保持 null
    }
    break;
  }
  
  // ────────────────────────────────────────
  // 3. 提取 4 行英文签诗
  // 在 "吉凶宫位" 行之后,空行隔开,
  // 中文签诗 → 空行 → 4 行英文签诗 → 空行 → "观音灵签: 诗意"
  // 
  // 策略:
  //   找到中文签诗(包含;的中文行)之后,
  //   收集连续的英文行(只要不到下一个空行)
  // ────────────────────────────────────────
  let inEnglishVerseSection = false;
  let foundChineseVerse = false;
  let verseLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 跳过签号行和吉凶宫位行
    if (line.match(/^(##\s*)?观音灵签\d+/) || line.match(/^\d+\s*观音灵签解签/)) continue;
    if (line.includes('吉凶宫位')) continue;
    
    // 找到中文签诗(包含中文标点和;)
    if (!foundChineseVerse && /[;；]/.test(line) && /[\u4e00-\u9fa5]/.test(line)) {
      foundChineseVerse = true;
      continue;
    }
    
    // 中文签诗找到后,空行→开始英文签诗段
    if (foundChineseVerse && !inEnglishVerseSection) {
      if (line === '') continue;
      // 检测到英文(包含拉丁字母且不含中文)
      if (/[a-zA-Z]/.test(line) && !/[\u4e00-\u9fa5]/.test(line)) {
        inEnglishVerseSection = true;
        verseLines.push(line);
        continue;
      }
    }
    
    // 在英文签诗段内
    if (inEnglishVerseSection) {
      // 空行 = 英文签诗结束
      if (line === '') {
        break;
      }
      // 遇到下一个段落标题(如 "观音灵签: 诗意")
      if (line.includes('观音灵签')) {
        break;
      }
      // 否则收集为英文签诗一行
      if (/[a-zA-Z]/.test(line)) {
        verseLines.push(line);
      }
    }
  }
  
  result.verse_lines_en = verseLines;
  
  // ────────────────────────────────────────
  // 4. 提取 1 句英文签语 (诗意部分的英文)
  // 在 "观音灵签: 诗意" 之后,
  // 中文诗意 → 英文诗意(双引号包裹)
  // 例如:
  //   观音灵签: 诗意
  //   此卦盘古初开天地之象。诸事皆吉也。
  //   "A universe is being born from your choices. ..."
  // 
  // 容错: 部分签的 MD 写作 "诗意"(缺"观音灵签:"前缀),
  //       或不同的全/半角冒号
  // ────────────────────────────────────────
  let inPoetrySection = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 检测"诗意"段落开始(支持 3 种变体):
    //   "观音灵签: 诗意"
    //   "观音灵签:诗意"  
    //   "观音灵签:诗意" (全角冒号)
    //   "诗意" (无前缀,签 83 的特殊情况)
    const isPoetrySectionStart = 
      (line.includes('观音灵签') && line.includes('诗意')) ||
      line === '诗意';
    
    if (isPoetrySectionStart) {
      inPoetrySection = true;
      continue;
    }
    
    if (inPoetrySection) {
      // 遇到下一个段落 = 结束
      // 也支持没有"观音灵签:"前缀的简写形式
      if ((line.includes('观音灵签') && (line.includes('解曰') || line.includes('仙机') || line.includes('整体'))) ||
          line === '解曰' || line === '仙机' || line === '整体解译') {
        break;
      }
      
      // 找到英文(以引号开头或包含拉丁字母且不含中文)
      if (/^["""]/.test(line) || (/[a-zA-Z]/.test(line) && !/[\u4e00-\u9fa5]/.test(line) && line.length > 20)) {
        // 去除前后引号(各种引号都处理)
        result.summary_line_en = line
          .replace(/^["""""]+/, '')
          .replace(/["""""]+$/, '')
          .trim();
        break;
      }
    }
  }
  
  return result;
}

// ──────────────────────────────────────────────────────────
// 验证单个签的数据完整性
// ──────────────────────────────────────────────────────────

function validateSign(sign) {
  const errors = [];
  
  if (!sign.sign_number || sign.sign_number < 1 || sign.sign_number > 100) {
    errors.push(`Invalid sign_number: ${sign.sign_number}`);
  }
  
  if (!sign.level) {
    errors.push(`Missing level (吉凶宫位 was: "${sign.jixiong_palace_full || '(not extracted)'}")`);
  }
  
  if (!sign.story_figure) {
    errors.push(`Missing story_figure (典故人物未提取)`);
  }
  
  // 警告级别的:吉凶宫位中文部分缺失(部分签的 MD 数据本身缺中文)
  if (sign.level && !sign.jixiong_palace_full) {
    errors.push(`Warning: 吉凶宫位 中文部分缺失,palace_meta 也将为 null`);
  }
  
  if (!sign.verse_lines_en || sign.verse_lines_en.length === 0) {
    errors.push(`No English verse lines extracted`);
  } else if (sign.verse_lines_en.length !== 4) {
    errors.push(`Expected 4 verse lines, got ${sign.verse_lines_en.length}: ${JSON.stringify(sign.verse_lines_en)}`);
  }
  
  if (!sign.summary_line_en) {
    errors.push(`No English summary line extracted`);
  }
  
  if (!sign.raw_md_content || sign.raw_md_content.length < 100) {
    errors.push(`raw_md_content too short`);
  }
  
  return errors;
}

// ──────────────────────────────────────────────────────────
// 主流程
// ──────────────────────────────────────────────────────────

function main() {
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('  POJU Oracle Signs · MD → JSON Parser');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('');
  
  // 1. 检查输入文件
  if (!fs.existsSync(INPUT_PATH)) {
    error(`Input file not found: ${INPUT_PATH}`);
    error(`Expected MD file at: public/oracle/data/signs.md`);
    process.exit(1);
  }
  
  log(`📖 Reading: ${INPUT_PATH}`);
  const mdText = fs.readFileSync(INPUT_PATH, 'utf-8');
  log(`   File size: ${(mdText.length / 1024).toFixed(1)} KB`);
  log('');
  
  // 2. 拆分签
  log('✂️  Splitting MD into individual signs...');
  const rawSigns = splitMdIntoSigns(mdText);
  log(`   Found ${rawSigns.length} sign blocks`);
  
  if (rawSigns.length === 0) {
    error('No sign blocks found! Check that your MD file has the correct format:');
    error('  Sign 1 should start with: "1 观音灵签解签1..."');
    error('  Other signs should start with: "## 观音灵签N 观音灵签解签N"');
    process.exit(1);
  }
  
  log('');
  
  // 3. 解析每个签
  log('📝 Parsing each sign...');
  const signs = [];
  const allErrors = [];
  const limit = LIMIT || rawSigns.length;
  
  for (let i = 0; i < Math.min(rawSigns.length, limit); i++) {
    const raw = rawSigns[i];
    
    try {
      const parsed = parseSign(raw.sign_number, raw.raw_lines);
      const errors = validateSign(parsed);
      
      if (errors.length > 0) {
        allErrors.push({
          sign_number: raw.sign_number,
          errors,
        });
      }
      
      signs.push(parsed);
      
      if (DEBUG) {
        debugLog(`Sign ${parsed.sign_number}:`);
        debugLog(`  level: ${parsed.level}`);
        debugLog(`  jixiong_palace_full: ${parsed.jixiong_palace_full}`);
        debugLog(`  palace_zh: ${parsed.palace_zh} (${parsed.palace_meta?.element || 'n/a'} | ${parsed.palace_meta?.symbol || 'n/a'})`);
        debugLog(`  story: ${parsed.story_figure}`);
        debugLog(`  verse_lines: ${parsed.verse_lines_en.length}`);
        debugLog(`  summary: ${parsed.summary_line_en?.slice(0, 60)}...`);
        if (errors.length > 0) {
          errors.forEach(e => debugLog(`  ⚠ ${e}`));
        }
        debugLog('');
      } else {
        const status = errors.length === 0 ? '✓' : '⚠';
        process.stdout.write(`   ${status} #${String(parsed.sign_number).padStart(3, '0')} `);
        if ((i + 1) % 10 === 0) process.stdout.write('\n');
      }
    } catch (e) {
      error(`\nFailed to parse sign ${raw.sign_number}: ${e.message}`);
      allErrors.push({
        sign_number: raw.sign_number,
        errors: [e.message],
      });
    }
  }
  
  if (!DEBUG) log('\n');
  
  // 4. 报告解析结果
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log(`📊 Parsed ${signs.length} signs total`);
  
  // 等级分布统计
  const distribution = {
    divine_tailwind: 0,
    fair_sky: 0,
    still_water: 0,
    crosswind: 0,
    eye_of_storm: 0,
  };
  
  signs.forEach(s => {
    if (s.level) distribution[s.level]++;
  });
  
  log('');
  log('📈 Level distribution:');
  Object.entries(distribution).forEach(([level, count]) => {
    const percentage = signs.length > 0 ? ((count / signs.length) * 100).toFixed(0) : 0;
    log(`   ${level.padEnd(20)} ${String(count).padStart(3)} (${percentage}%)`);
  });
  
  // 5. 报告错误
  log('');
  if (allErrors.length > 0) {
    log(`⚠️  ${allErrors.length} signs have validation issues:`);
    allErrors.slice(0, 20).forEach(item => {
      log(`   Sign #${item.sign_number}:`);
      item.errors.forEach(e => log(`     - ${e}`));
    });
    if (allErrors.length > 20) {
      log(`   ... and ${allErrors.length - 20} more`);
    }
  } else {
    log('✅ All signs validated successfully');
  }
  
  log('');
  
  // 6. 写入 JSON
  if (signs.length === 0) {
    error('No signs were parsed. Output file not written.');
    process.exit(1);
  }
  
  // 确保输出目录存在
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // 按签号排序
  signs.sort((a, b) => a.sign_number - b.sign_number);
  
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(signs, null, 2), 'utf-8');
  
  const fileSize = fs.statSync(OUTPUT_PATH).size;
  log(`💾 Wrote: ${OUTPUT_PATH}`);
  log(`   Size: ${(fileSize / 1024).toFixed(1)} KB`);
  log('');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (allErrors.length > 0) {
    log('⚠️  Done with warnings. Please review the issues above.');
    log('   Run with --debug for detailed output.');
  } else {
    log('✨ Done!');
  }
}

// ──────────────────────────────────────────────────────────
// 执行
// ──────────────────────────────────────────────────────────

try {
  main();
} catch (e) {
  error('Unexpected error:');
  error(e.stack || e.message);
  process.exit(1);
}