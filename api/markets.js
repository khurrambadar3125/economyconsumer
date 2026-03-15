export const config = { runtime: 'edge' };

export default async function handler(req) {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: cors });

  const symbols = [
    { id: 'dow',  sym: '%5EDJI' },
    { id: 'sp',   sym: '%5EGSPC' },
    { id: 'nq',   sym: '%5EIXIC' },
    { id: 'ftse', sym: '%5EFTSE' },
    { id: 'gold', sym: 'GC%3DF',  prefix: '$' },
    { id: 'oil',  sym: 'CL%3DF',  prefix: '$' },
    { id: 'btc',  sym: 'BTC-USD', prefix: '$' },
    { id: 'eur',  sym: 'EURUSD%3DX' },
  ];

  const results = {};

  await Promise.all(symbols.map(async ({ id, sym, prefix = '' }) => {
    try {
      const r = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`,
        { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }
      );
      if (!r.ok) return;
      const d = await r.json();
      const meta = d?.chart?.result?.[0]?.meta;
      if (!meta) return;
      const price = meta.regularMarketPrice ?? meta.previousClose;
      const prev  = meta.chartPreviousClose ?? meta.previousClose;
      if (!price) return;
      const chgPct = prev ? ((price - prev) / prev) * 100 : 0;
      const fmt = price >= 1000
        ? price.toLocaleString('en-US', { maximumFractionDigits: 0 })
        : price.toFixed(2);
      results[id] = {
        val: prefix + fmt,
        chg: (chgPct >= 0 ? '+' : '') + chgPct.toFixed(2) + '%',
      };
    } catch (_) {}
  }));

  return new Response(JSON.stringify(results), { headers: cors });
}
