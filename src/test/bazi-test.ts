import { getBaziChart } from 'shunshi-bazi-core';

const chart = getBaziChart({
  year: 2016,
  month: 12,
  day: 24,
  hour: 5,
  minute: 0,
  gender: 1,      // 1 = 男
  city: '北京'     // 真太阳时校正
});

// ✅ 正确路径：都在 chart.八字 下面
console.log('四柱:', chart.八字.四柱);
console.log('日主:', chart.八字.日主);
console.log('五行:', chart.八字.五行分值);
console.log('刑冲合会:', chart.八字.刑冲合会);
console.log('起运:', chart.八字.起运);
console.log('大运:', chart.八字.大运?.filter((d: any) => d.当前));
console.log('年柱神煞:', chart.八字.柱位详细?.年柱?.神煞);