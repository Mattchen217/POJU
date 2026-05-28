# pojulife 出生地必填 + 全站文案对齐

> **任务范围**:
> 1. 在所有八字采集表单中添加【出生地点】字段(必填)
> 2. 全站文案违禁词清理(品牌纪律)
>
> **前提**:
> - PWA 全局 first-time location 检测(GPS/IP)
> - 真太阳时计算服务已经存在(参考 Syncro_TrueSolarTime_Final.md)
>
> **执行原则**:每个 Step 完成后等用户确认才进入下一步

---

# 第 1 部分:Step 1 - 全局首次定位组件

## Step 1.1: FirstTimeLocation 组件

文件:`components/global/FirstTimeLocation.tsx`(新建)

```typescript
'use client';

import { useEffect } from 'react';

const CACHE_KEY = 'pojulife_user_location';
const CACHE_TTL_HOURS = 24;

export interface UserLocation {
  city: string;
  state?: string;
  country: string;
  longitude: number;
  latitude: number;
  source: 'gps' | 'ip' | 'fallback';
  cached_at: number;
}

export function FirstTimeLocation() {
  useEffect(() => {
    detectAndCacheLocation();
  }, []);
  return null;
}

async function detectAndCacheLocation() {
  // 检查缓存
  const cached = loadCached();
  if (cached && isValid(cached)) return;
  
  // 优先 GPS
  if ('geolocation' in navigator) {
    try {
      const pos = await getGeolocation();
      const loc = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      cache({ ...loc, source: 'gps' });
      return;
    } catch {
      // GPS 失败,继续 IP
    }
  }
  
  // Fallback: IP
  try {
    const loc = await ipLocate();
    cache({ ...loc, source: 'ip' });
    return;
  } catch {
    // 都失败,不缓存
  }
}

function getGeolocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 3600_000
    });
  });
}

async function reverseGeocode(lat: number, lng: number): Promise<UserLocation> {
  const res = await fetch(`/api/location/reverse-geocode?lat=${lat}&lng=${lng}`);
  const data = await res.json();
  return {
    city: data.city,
    state: data.state,
    country: data.country,
    longitude: lng,
    latitude: lat,
    source: 'gps',
    cached_at: Date.now()
  };
}

async function ipLocate(): Promise<UserLocation> {
  const res = await fetch('/api/location/ip-locate');
  const data = await res.json();
  return {
    city: data.city,
    state: data.region,
    country: data.country_name,
    longitude: data.longitude,
    latitude: data.latitude,
    source: 'ip',
    cached_at: Date.now()
  };
}

function loadCached(): UserLocation | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function cache(loc: UserLocation) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(loc));
  } catch {}
}

function isValid(loc: UserLocation): boolean {
  const ageHours = (Date.now() - loc.cached_at) / 3600_000;
  return ageHours < CACHE_TTL_HOURS;
}

export function getCurrentLocation(): UserLocation | null {
  return loadCached();
}
```

## Step 1.2: 后端 API 路由

文件:`app/api/location/reverse-geocode/route.ts`(新建)

```typescript
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  
  if (!lat || !lng) {
    return NextResponse.json({ error: 'missing_coords' }, { status: 400 });
  }
  
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?` +
    `lat=${lat}&lon=${lng}&format=json&accept-language=en`,
    { headers: { 'User-Agent': 'pojulife/1.0' } }
  );
  
  const data = await res.json();
  const addr = data.address || {};
  
  return NextResponse.json({
    city: addr.city || addr.town || addr.village || addr.county,
    state: addr.state,
    country: addr.country
  });
}
```

文件:`app/api/location/ip-locate/route.ts`(新建)

```typescript
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const userIp = 
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '';
  
  const url = userIp 
    ? `https://ipapi.co/${userIp}/json/`
    : 'https://ipapi.co/json/';
  
  const res = await fetch(url);
  const data = await res.json();
  
  return NextResponse.json({
    city: data.city,
    region: data.region,
    country_name: data.country_name,
    latitude: data.latitude,
    longitude: data.longitude
  });
}
```

## Step 1.3: 集成到 root layout

文件:`app/[locale]/layout.tsx`(修改)

```tsx
import { FirstTimeLocation } from '@/components/global/FirstTimeLocation';

export default function LocaleLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <FirstTimeLocation />
        {/* 现有内容 */}
        {children}
      </body>
    </html>
  );
}
```

## 验证清单 - Step 1

```
□ FirstTimeLocation 组件实现
□ 后端两个 API 路由
□ 集成到 root layout
□ 测试:
  - 手机首次访问 → GPS 权限请求 → 缓存城市
  - PC 首次访问 → IP 定位 → 缓存城市
  - 24h 内不重复请求

🛑 等用户确认进入 Step 2
```

---

# 第 1 部分:Step 2 - BirthLocationField 组件

## Step 2.1: 城市搜索组件

文件:`components/forms/BirthCitySearchInput.tsx`(新建)

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';

interface CitySuggestion {
  name: string;        // "Shanghai, China"
  city: string;
  state?: string;
  country: string;
  longitude: number;
  latitude: number;
}

interface Props {
  value: CitySuggestion | null;
  placeholder?: { city: string; state?: string; country: string };
  onChange: (city: CitySuggestion) => void;
}

export function BirthCitySearchInput({ value, placeholder, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CitySuggestion[]>([]);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<any>(null);
  
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => searchCity(query), 300);
  }, [query]);
  
  async function searchCity(q: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/location/search-city?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }
  
  function handleSelect(city: CitySuggestion) {
    onChange(city);
    setActive(false);
    setQuery('');
    setResults([]);
  }
  
  // 显示状态:已选定
  if (value && !active) {
    return (
      <div className="birth-city-input" onClick={() => setActive(true)}>
        <span className="city-selected">
          {value.city}{value.state ? `, ${value.state}` : ''}, {value.country}
        </span>
      </div>
    );
  }
  
  // 默认状态:显示 placeholder(灰色)
  if (!active) {
    return (
      <div className="birth-city-input default" onClick={() => setActive(true)}>
        <span className="city-placeholder">
          {placeholder 
            ? `${placeholder.city}${placeholder.state ? `, ${placeholder.state}` : ''}, ${placeholder.country}`
            : 'Tap to enter your birth city'}
        </span>
      </div>
    );
  }
  
  // 搜索状态
  return (
    <div className="birth-city-input active">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search city..."
        autoFocus
      />
      
      {loading && <div className="loading">Searching...</div>}
      
      {results.length > 0 && (
        <ul className="suggestions">
          {results.map((city, idx) => (
            <li key={idx} onClick={() => handleSelect(city)}>
              <span className="suggestion-name">
                {city.city}{city.state ? `, ${city.state}` : ''}, {city.country}
              </span>
            </li>
          ))}
        </ul>
      )}
      
      <button className="cancel-btn" onClick={() => setActive(false)}>
        Cancel
      </button>
    </div>
  );
}
```

## Step 2.2: 城市搜索后端

文件:`app/api/location/search-city/route.ts`(新建)

```typescript
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }
  
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?` +
    `q=${encodeURIComponent(q)}&format=json&limit=8&` +
    `featuretype=city&accept-language=en`,
    { headers: { 'User-Agent': 'pojulife/1.0' } }
  );
  
  const data = await res.json();
  
  const results = data
    .filter((item: any) => 
      item.type === 'city' || 
      item.type === 'town' || 
      item.type === 'administrative'
    )
    .map((item: any) => {
      const parts = item.display_name.split(',').map((s: string) => s.trim());
      return {
        name: item.display_name,
        city: parts[0],
        state: parts.length > 2 ? parts[parts.length - 2] : undefined,
        country: parts[parts.length - 1],
        longitude: parseFloat(item.lon),
        latitude: parseFloat(item.lat)
      };
    });
  
  return NextResponse.json({ results });
}
```

## Step 2.3: 精度提示工具函数

文件:`lib/location/precision-hint.ts`(新建)

```typescript
/**
 * 计算真太阳时偏差(简化版,用于 UI 提示)
 */
export function calculateOffsetMinutes(longitude: number, timezone: string): number {
  // 时区中央经度
  const tzCenter = getTimezoneCenterLongitude(timezone);
  if (tzCenter === null) return 0;
  
  // 经度时差:每 1°差 = 4 分钟
  return Math.round((longitude - tzCenter) * 4);
}

function getTimezoneCenterLongitude(timezone: string): number | null {
  const tzCenters: Record<string, number> = {
    'America/New_York':     -75,
    'America/Chicago':      -90,
    'America/Denver':       -105,
    'America/Los_Angeles':  -120,
    'America/Phoenix':      -105,
    'America/Anchorage':    -135,
    'Pacific/Honolulu':     -150,
    'America/Toronto':      -75,
    'America/Vancouver':    -120,
    'Europe/London':        0,
    'Europe/Paris':         15,
    'Europe/Berlin':        15,
    'Europe/Moscow':        45,
    'Asia/Shanghai':        120,
    'Asia/Tokyo':           135,
    'Asia/Singapore':       105,
    'Asia/Seoul':           135,
    'Asia/Kolkata':         82.5,
    'Australia/Sydney':     150,
    'UTC':                  0
  };
  
  return tzCenters[timezone] ?? null;
}

export function formatOffset(minutes: number): string {
  if (minutes === 0) return '0 minutes';
  
  const sign = minutes > 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  
  if (abs < 60) {
    return `${sign}${abs} minutes`;
  }
  
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return mins > 0 
    ? `${sign}${hours}h ${mins}min`
    : `${sign}${hours}h`;
}
```

## Step 2.4: BirthLocationField 主组件

文件:`components/forms/BirthLocationField.tsx`(新建)

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { getCurrentLocation } from '@/components/global/FirstTimeLocation';
import { BirthCitySearchInput } from './BirthCitySearchInput';
import { calculateOffsetMinutes, formatOffset } from '@/lib/location/precision-hint';
import { TIMEZONE_FALLBACK_CITIES } from '@/lib/location/timezone-defaults';

export interface BirthLocation {
  city: string;
  state?: string;
  country: string;
  longitude: number;
  latitude: number;
  timezone: string;
  source: 'auto_detected' | 'manual_search' | 'fallback';
}

interface Props {
  value: BirthLocation | null;
  onChange: (loc: BirthLocation) => void;
}

export function BirthLocationField({ value, onChange }: Props) {
  const t = useTranslations('birth_form');
  const [autoDetected, setAutoDetected] = useState<any>(null);
  const [timezone, setTimezone] = useState('UTC');
  
  useEffect(() => {
    // 拿到时区
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(tz);
    
    // 拿到自动检测的位置(GPS/IP)
    const detected = getCurrentLocation();
    if (detected) {
      setAutoDetected(detected);
    } else {
      // Fallback: 用时区中央城市
      const fallback = TIMEZONE_FALLBACK_CITIES[tz] || TIMEZONE_FALLBACK_CITIES['UTC'];
      setAutoDetected({
        city: fallback.city,
        country: fallback.country,
        longitude: fallback.lng,
        latitude: fallback.lat
      });
    }
  }, []);
  
  // 用户没选,但有 autoDetected → 显示为 placeholder
  // 用户选了 → 显示选择的
  
  function handleCitySelect(city: any) {
    onChange({
      city: city.city,
      state: city.state,
      country: city.country,
      longitude: city.longitude,
      latitude: city.latitude,
      timezone,
      source: 'manual_search'
    });
  }
  
  // 计算精度偏移
  const effectiveLocation = value || (autoDetected ? {
    longitude: autoDetected.longitude || autoDetected.lng,
    city: autoDetected.city,
    country: autoDetected.country
  } : null);
  
  const offsetMinutes = effectiveLocation 
    ? calculateOffsetMinutes(effectiveLocation.longitude, timezone)
    : 0;
  
  return (
    <div className="birth-location-field">
      <label className="field-label">
        {t('birth_location')} <span className="required">*</span>
      </label>
      
      <BirthCitySearchInput
        value={value ? { 
          name: '', 
          city: value.city, 
          state: value.state, 
          country: value.country,
          longitude: value.longitude,
          latitude: value.latitude
        } : null}
        placeholder={autoDetected ? {
          city: autoDetected.city,
          state: autoDetected.state,
          country: autoDetected.country
        } : undefined}
        onChange={handleCitySelect}
      />
      
      {effectiveLocation && (
        <div className="precision-hint">
          True solar offset: {formatOffset(offsetMinutes)}
        </div>
      )}
      
      <details className="why-collapse">
        <summary>{t('why_we_ask')}</summary>
        <p>{t('why_explanation')}</p>
      </details>
    </div>
  );
}
```

## Step 2.5: 样式

```css
/* styles/birth-location.css */

.birth-location-field {
  margin: 24px 0;
}

.field-label {
  display: block;
  font-size: var(--pj-text-sm);
  color: var(--pj-text-secondary);
  margin-bottom: 8px;
}

.field-label .required {
  color: var(--pj-gold);
  margin-left: 2px;
}

.birth-city-input {
  padding: 14px 16px;
  background: var(--pj-bg-card);
  border-radius: var(--pj-radius-lg);
  cursor: pointer;
  min-height: 24px;
}

.city-placeholder {
  color: var(--pj-text-muted);     /* 灰色 */
  font-size: var(--pj-text-sm);
}

.city-selected {
  color: var(--pj-text-primary);    /* 白色 */
  font-size: var(--pj-text-sm);
}

.birth-city-input.active input {
  background: transparent;
  color: var(--pj-text-primary);
  font-family: inherit;
  font-size: var(--pj-text-sm);
  width: 100%;
  outline: none;
  padding: 0;
}

.suggestions {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  background: var(--pj-bg-elevated);
  border-radius: var(--pj-radius-md);
  overflow: hidden;
}

.suggestions li {
  padding: 12px 16px;
  cursor: pointer;
  font-size: var(--pj-text-sm);
  color: var(--pj-text-primary);
  transition: background var(--pj-duration-fast);
}

.suggestions li:active,
.suggestions li:hover {
  background: var(--pj-bg-card);
}

.cancel-btn {
  margin-top: 8px;
  padding: 6px 12px;
  background: transparent;
  color: var(--pj-text-tertiary);
  font-family: inherit;
  font-size: var(--pj-text-xs);
  cursor: pointer;
}

.precision-hint {
  font-size: var(--pj-text-xs);
  color: var(--pj-text-tertiary);
  margin-top: 6px;
  letter-spacing: 0.3px;
}

.why-collapse {
  margin-top: 12px;
  font-size: var(--pj-text-xs);
}

.why-collapse summary {
  color: var(--pj-text-muted);
  cursor: pointer;
  letter-spacing: 0.3px;
}

.why-collapse p {
  margin-top: 8px;
  color: var(--pj-text-tertiary);
  line-height: var(--pj-leading-normal);
}

.loading {
  padding: 12px 16px;
  font-size: var(--pj-text-xs);
  color: var(--pj-text-tertiary);
}
```

## Step 2.6: 翻译

文件:`messages/en/birth_form.json`(扩展)

```json
{
  "birth_form": {
    "birth_location": "Birth location",
    "search_city": "Search city",
    "why_we_ask": "Why we ask",
    "why_explanation": "pojulife uses true solar time for accuracy. Sun peaks vary by longitude — your birth location ensures the correct hour pillar."
  }
}
```

文件:`messages/zh/birth_form.json`

```json
{
  "birth_form": {
    "birth_location": "出生地点",
    "search_city": "搜索城市",
    "why_we_ask": "为什么需要?",
    "why_explanation": "pojulife 使用真太阳时确保精度。太阳过中天的时间随经度变化 —— 你的出生地保证时辰柱准确。"
  }
}
```

## Step 2.7: TIMEZONE_FALLBACK_CITIES

文件:`lib/location/timezone-defaults.ts`(新建)

```typescript
export const TIMEZONE_FALLBACK_CITIES: Record<string, {
  city: string;
  country: string;
  lng: number;
  lat: number;
}> = {
  // 北美(优先)
  'America/New_York':     { city: 'New York',    country: 'USA',    lng: -74.0,  lat: 40.7 },
  'America/Chicago':      { city: 'Chicago',     country: 'USA',    lng: -87.6,  lat: 41.9 },
  'America/Denver':       { city: 'Denver',      country: 'USA',    lng: -105.0, lat: 39.7 },
  'America/Los_Angeles':  { city: 'Los Angeles', country: 'USA',    lng: -118.2, lat: 34.1 },
  'America/Phoenix':      { city: 'Phoenix',     country: 'USA',    lng: -112.1, lat: 33.4 },
  'America/Anchorage':    { city: 'Anchorage',   country: 'USA',    lng: -149.9, lat: 61.2 },
  'Pacific/Honolulu':     { city: 'Honolulu',    country: 'USA',    lng: -157.9, lat: 21.3 },
  'America/Toronto':      { city: 'Toronto',     country: 'Canada', lng: -79.4,  lat: 43.7 },
  'America/Vancouver':    { city: 'Vancouver',   country: 'Canada', lng: -123.1, lat: 49.3 },
  'America/Mexico_City':  { city: 'Mexico City', country: 'Mexico', lng: -99.1,  lat: 19.4 },
  
  // 欧洲
  'Europe/London':        { city: 'London',      country: 'UK',     lng: -0.1,   lat: 51.5 },
  'Europe/Paris':         { city: 'Paris',       country: 'France', lng: 2.3,    lat: 48.9 },
  'Europe/Berlin':        { city: 'Berlin',      country: 'Germany',lng: 13.4,   lat: 52.5 },
  'Europe/Madrid':        { city: 'Madrid',      country: 'Spain',  lng: -3.7,   lat: 40.4 },
  'Europe/Rome':          { city: 'Rome',        country: 'Italy',  lng: 12.5,   lat: 41.9 },
  'Europe/Moscow':        { city: 'Moscow',      country: 'Russia', lng: 37.6,   lat: 55.8 },
  
  // 亚洲
  'Asia/Shanghai':        { city: 'Shanghai',    country: 'China',     lng: 121.5, lat: 31.2 },
  'Asia/Hong_Kong':       { city: 'Hong Kong',   country: 'Hong Kong', lng: 114.2, lat: 22.3 },
  'Asia/Taipei':          { city: 'Taipei',      country: 'Taiwan',    lng: 121.5, lat: 25.0 },
  'Asia/Tokyo':           { city: 'Tokyo',       country: 'Japan',     lng: 139.7, lat: 35.7 },
  'Asia/Seoul':           { city: 'Seoul',       country: 'South Korea', lng: 127.0, lat: 37.6 },
  'Asia/Singapore':       { city: 'Singapore',   country: 'Singapore', lng: 103.8, lat: 1.3 },
  'Asia/Kolkata':         { city: 'Mumbai',      country: 'India',     lng: 72.9,  lat: 19.1 },
  'Asia/Bangkok':         { city: 'Bangkok',     country: 'Thailand',  lng: 100.5, lat: 13.8 },
  'Asia/Dubai':           { city: 'Dubai',       country: 'UAE',       lng: 55.3,  lat: 25.2 },
  
  // 大洋洲
  'Australia/Sydney':     { city: 'Sydney',      country: 'Australia', lng: 151.2, lat: -33.9 },
  'Australia/Melbourne':  { city: 'Melbourne',   country: 'Australia', lng: 145.0, lat: -37.8 },
  'Pacific/Auckland':     { city: 'Auckland',    country: 'New Zealand', lng: 174.8, lat: -36.9 },
  
  // 南美
  'America/Sao_Paulo':    { city: 'São Paulo',   country: 'Brazil', lng: -46.6, lat: -23.5 },
  
  // 默认
  'UTC':                  { city: 'London',      country: 'UK',     lng: 0,      lat: 51.5 }
};
```

## 验证清单 - Step 2

```
□ BirthCitySearchInput 组件实现
□ search-city 后端 API
□ precision-hint 工具函数
□ BirthLocationField 主组件
□ TIMEZONE_FALLBACK_CITIES 完整
□ 翻译 EN + ZH
□ 样式实现

🛑 等用户确认进入 Step 3
```

---

# 第 1 部分:Step 3 - 集成到 BirthInfoForm

## Step 3.1: 修改 BirthInfoForm

文件:`components/forms/BirthInfoForm.tsx`(修改)

```tsx
import { BirthLocationField, BirthLocation } from './BirthLocationField';

interface BirthInfoData {
  birth_date: string;
  birth_time: string;
  gender: 'M' | 'F';
  birth_location: BirthLocation;  // ⭐ 新增,必填
}

export function BirthInfoForm({ onSubmit }: Props) {
  const [birthLocation, setBirthLocation] = useState<BirthLocation | null>(null);
  // ... 其他现有 state
  
  function handleSubmit() {
    if (!birthLocation) {
      // 用 auto-detected fallback
      const detected = getCurrentLocation();
      if (!detected) {
        // 都没有,提示错误
        alert(t('errors.location_required'));
        return;
      }
      // 使用 auto-detected 作为提交值,标记 source
      onSubmit({
        birth_date,
        birth_time,
        gender,
        birth_location: {
          city: detected.city,
          state: detected.state,
          country: detected.country,
          longitude: detected.longitude,
          latitude: detected.latitude,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          source: 'auto_detected'
        }
      });
      return;
    }
    
    onSubmit({ birth_date, birth_time, gender, birth_location: birthLocation });
  }
  
  return (
    <form>
      {/* 现有字段:出生日期/时辰/性别 */}
      
      {/* ⭐ 新增:出生地 */}
      <BirthLocationField 
        value={birthLocation}
        onChange={setBirthLocation}
      />
      
      {/* 现有:时区显示 */}
      
      <button onClick={handleSubmit}>{t('submit')}</button>
    </form>
  );
}
```

## Step 3.2: 后端 generateBaseAnalysis 接收

文件:`app/api/profile/generate-base-analysis/route.ts`(修改)

```typescript
export async function POST(req: Request) {
  const body = await req.json();
  const { birth_date, birth_time, gender, birth_location } = body;
  
  // ⭐ 校验出生地
  if (!birth_location?.longitude || !birth_location?.latitude) {
    return NextResponse.json({ 
      error: 'birth_location_required' 
    }, { status: 400 });
  }
  
  // ⭐ 计算真太阳时
  const { calculateTrueSolarTime } = await import('@/lib/syncro/true-solar-time');
  const tstResult = calculateTrueSolarTime({
    localTime: new Date(`${birth_date}T${birth_time}:00`),
    longitude: birth_location.longitude,
    timezone: birth_location.timezone
  });
  
  // 用真太阳时排盘
  const chart = calculateBaZi({
    birth_datetime: tstResult.trueSolarTime,
    gender
  });
  
  // 调用 LLM 生成 base_analysis
  const analysis = await generateBaseAnalysisLLM({
    chart,
    locale: body.locale
  });
  
  // 保存 profile
  await saveStoredProfile({
    user_profile: {
      birth_date,
      birth_time,
      gender,
      birth_location,
      tst_meta: {
        original_local_time: `${birth_date} ${birth_time}`,
        true_solar_time: tstResult.trueSolarTime.toISOString(),
        diff_minutes: tstResult.diffMinutes,
        longitude_diff_minutes: tstResult.longitudeDiffMinutes,
        eq_of_time_minutes: tstResult.equationOfTimeMinutes,
        computation_version: 'v2_with_tst'
      }
    },
    base_analysis: {
      content: analysis,
      generated_at: new Date().toISOString(),
      used_true_solar_time: true
    }
  });
  
  return NextResponse.json({ success: true });
}
```

## Step 3.3: stored_profile schema 升级

文件:`lib/db/poju-db.ts`(扩展 schema)

```typescript
const SCHEMA_VERSION = 8;

db.version(SCHEMA_VERSION).stores({
  // ... 现有表
  stored_profiles: 'profile_id, user_id, created_at, last_used_at'
});

// stored_profile 数据结构:
// {
//   profile_id,
//   user_profile: {
//     birth_date, birth_time, gender,
//     birth_location: {...},        // ⭐ 新增
//     tst_meta: {...}               // ⭐ 新增
//   },
//   base_analysis: {
//     content, generated_at,
//     used_true_solar_time: true    // ⭐ 新增标记
//   }
// }
```

## 验证清单 - Step 3

```
□ BirthInfoForm 加入出生地字段
□ 后端接收 birth_location
□ generateBaseAnalysis 用真太阳时排盘
□ tst_meta 保存到 profile
□ 测试 3 个场景:
  - 北美土生用户(LA 出生):误差 < 10 分钟
  - 跨经度移民(上海出生,SF 当前):正确切到上海经度算
  - GPS/IP 失败(用 fallback)

🛑 等用户确认进入 Step 4
```

---

# 第 2 部分:Step 4 - 全站文案违禁词审查

## Step 4.1: 全站 grep 违禁词

```bash
# 任务:列出所有违禁词出现位置

# 英文违禁词
grep -rn "astrolog\|fortune.*tell\|divinat\|oracle\|psychic\|horoscope\|tarot\|mystic" \
  --include="*.tsx" --include="*.ts" --include="*.json" --include="*.md" \
  messages/ components/ app/ lib/llm/prompts/ \
  2>/dev/null | grep -v "node_modules"

# 中文违禁词
grep -rn "占星\|占卜\|算命\|命理\|测算\|抽签\|卜卦\|算卦\|神算\|风水" \
  --include="*.tsx" --include="*.ts" --include="*.json" --include="*.md" \
  messages/ components/ app/ lib/llm/prompts/ \
  2>/dev/null | grep -v "node_modules"

# 输出给用户审视,标注哪些是用户可见、哪些是内部代码
```

## Step 4.2: 按规则替换

```
┌──────────────────────────────────────────────────────────────┐
│ 替换规则                                                       │
├─────────────────────────────────┬────────────────────────────┤
│ 违禁词                           │ 替换为                       │
├─────────────────────────────────┼────────────────────────────┤
│ 英文                             │                             │
│   astrology / astrologer        │ pojulife / POJU / system    │
│   divination                    │ reading / analysis          │
│   oracle (作占卜用)              │ Glyph / reading             │
│   fortune telling / fortune     │ insight / guidance          │
│   psychic                       │ intuitive / insight         │
│   horoscope                     │ chart / reading             │
│   tarot                         │ Glyph / pattern             │
│   mystic / mysticism            │ Eastern wisdom / pojulife   │
│   predict (作命运用)             │ analyze / interpret         │
│   destiny / fate                │ pattern / direction         │
│                                 │                             │
│ 中文                             │                             │
│   占星(术)                       │ pojulife                    │
│   占卜                          │ 解读 / Glyph                │
│   算命                          │ 命盘解读                     │
│   命理(学)                       │ 东方智慧 / pojulife          │
│   测算                          │ 计算 / 分析                  │
│   抽签                          │ 抽一个 Glyph                 │
│   卜卦 / 算卦                    │ Glyph 解读                  │
│   神算                          │ (删除)                       │
│   预测命运                       │ 洞察方向                     │
│   风水                          │ 方位 / 空间能量              │
└─────────────────────────────────┴────────────────────────────┘

允许保留的术语(中性,无负面联想):
  英文:birth chart / hour pillar / Five Elements / Yong Shen / 
        true solar time / Day master / compatibility
  中文:命盘 / 时辰柱 / 五行 / 用神 / 真太阳时 / 日主 / 契合度
```

## Step 4.3: LLM Prompts 加输出规则

在所有 `lib/llm/prompts/` 目录的文件末尾添加:

```typescript
// 在每个 prompt builder 函数返回的字符串末尾追加:

export const POJULIFE_LANGUAGE_RULES = `

# 重要语言规则

⛔ 严格禁止以下词汇出现在你的输出中:

英文:
- astrology / astrologer
- divination / diviner
- fortune telling / fortune teller
- oracle / psychic / horoscope
- predict / prediction(用于命运,不是数据预测)
- destiny / fate
- tarot / mystic / mysticism

中文:
- 占星术 / 占卜 / 算命
- 命理学 / 测算
- 抽签 / 卜卦 / 算卦
- 神算 / 预测命运
- 风水

✓ 用以下替代:
- pojulife / POJU / Glyph / Syncro / Match (品牌/工具名)
- reading / analysis / reflection / insight / guidance
- 解读 / 分析 / 反思 / 洞察 / 指引

原因:
pojulife 是面向现代北美用户的【生活智慧工具】,
不是算命/占卜网站。语言必须现代、专业、中性。
任何让用户感觉是"算命软件"的词汇都必须避免。
`;
```

然后在每个 phase 的 prompt builder 中:

```typescript
// 例:lib/llm/phases/collecting-phase.ts

import { POJULIFE_LANGUAGE_RULES } from '@/lib/llm/prompts/language-rules';

const system = `${ORIENTAL_COUNSELOR_BASE}
... (现有内容)
${POJULIFE_LANGUAGE_RULES}
`;
```

涉及文件(全部加 POJULIFE_LANGUAGE_RULES):

```
□ lib/llm/prompts/oriental-counselor-base.ts
□ lib/llm/prompts/glyph-prompt.ts  (或类似)
□ lib/llm/prompts/match-prompt.ts
□ lib/llm/prompts/syncro-batch-prompt.ts
□ lib/llm/phases/opening-phase.ts
□ lib/llm/phases/collecting-phase.ts
□ lib/llm/phases/confirmation-phase.ts
□ lib/llm/phases/delivery-phase.ts
□ lib/llm/phases/tracking-phase.ts
□ 任何其他 LLM 调用
```

## Step 4.4: 真太阳时文案确认

确保所有真太阳时相关文案使用以下版本:

```
英文(用户可见):
✓ "pojulife uses true solar time for accuracy. Sun peaks 
   vary by longitude — your birth location ensures the 
   correct hour pillar."

✓ 简短版:
"Your birth location enables true solar time — essential 
 for an accurate chart."

✓ 精度提示:
"True solar offset: +6 minutes"
"True solar offset: -2h 10min"

中文(用户可见):
✓ "pojulife 使用真太阳时确保精度。太阳过中天的时间随经度变化 ——
   你的出生地保证时辰柱准确。"

⛔ 不要使用:
- "Astrology requires true solar time..."
- "占星术需要真太阳时..."
- 提到具体地区如"北京"/"中国"/"Beijing"
```

## Step 4.5: 测试 LLM 输出

```
任务:测试 LLM 输出是否还有违禁词

1. 模拟 5 个真实对话场景:
   □ POJU 用户:"我和老婆经常吵架"
   □ Glyph 用户:"我不知道为什么不开心"
   □ Syncro 用户:"明天面试"
   □ Match 用户:输入双方信息
   □ POJU 推荐 Glyph 场景

2. 拿到 LLM 输出后,grep 违禁词:
   echo "$LLM_OUTPUT" | grep -E "astrolog|divinat|fortune|占星|占卜|算命|抽签"

3. 如果还有违禁词:
   → 加强 prompt 的 POJULIFE_LANGUAGE_RULES
   → 或在 prompt 中加入 few-shot 反例

4. 重复测试直到 LLM 输出干净
```

## 验证清单 - Step 4

```
□ 全站 grep 违禁词,生成报告
□ 用户审视报告
□ 按替换规则修改所有匹配
□ 所有 LLM prompts 加入 POJULIFE_LANGUAGE_RULES
□ 真太阳时文案统一
□ 5 个 LLM 场景测试,无违禁词出现

🛑 等用户最终确认

报告内容应包括:
  - 修改前后对照
  - LLM 输出测试结果(贴 5 个对话的实际输出)
```

---

# 总结

```
本任务的两个主要交付:

✅ Part 1(Step 1-3): 出生地必填
  - 全局首次定位(GPS/IP)
  - prepare 表单加 BirthLocationField
  - 后端用真太阳时排盘
  - stored_profile 保存 birth_location + tst_meta

✅ Part 2(Step 4): 全站文案对齐
  - 违禁词审查 + 替换
  - LLM prompts 加输出规则
  - 真太阳时文案统一
  - 端到端测试

每个 Step 完成后,贴出修改对照 + 测试结果,等用户确认才进入下一步。
```
