"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";

type Tx = {
  id: string;
  type: string;
  tradeDate: string;
  cashAmount?: string;
  currency: string;
};

export default function AccountDetail({ accountId, baseCurrency }: { accountId: string; baseCurrency: string }) {
  const [tab, setTab] = useState<"cash" | "trades" | "snapshots" | "performance">("cash");
  const [cashDate, setCashDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [cashType, setCashType] = useState<"CASH_IN" | "CASH_OUT">("CASH_IN");
  const [snapDate, setSnapDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [snapValue, setSnapValue] = useState<number>(0);
  const [cashflows, setCashflows] = useState<Tx[]>([]);
  const [trades, setTrades] = useState<Tx[]>([]);
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferTo, setTransferTo] = useState<string>("");
  const [accounts, setAccounts] = useState<{id:string; name:string}[]>([]);
  const [perf, setPerf] = useState<any | null>(null);
  const [series, setSeries] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [snapPage, setSnapPage] = useState(1);
  const [snapTotal, setSnapTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [txTotal, setTxTotal] = useState(0);

  async function load() {
    const [tradeRes, perfRes, snapRes] = await Promise.all([
      fetch(`/api/transactions?accountId=${accountId}&page=${txPage}&pageSize=50`).then((r) => r.json()),
      fetch(`/api/accounts/${accountId}/performance`).then((r) => r.json()),
      fetch(`/api/accounts/${accountId}/snapshots?page=${snapPage}&pageSize=50`).then((r) => r.json()),
    ]);
    const allTx = tradeRes.transactions || [];
    setCashflows(allTx.filter((t: Tx) => t.type === "CASH_IN" || t.type === "CASH_OUT"));
    setTrades(tradesFrom(allTx));
    setTxTotal(tradeRes.total || 0);
    setPerf(perfRes.performance || null);
    setSeries(perfRes.series || []);
    setSnapshots(snapRes.snapshots || []);
    setSnapTotal(snapRes.total || 0);
  }

  async function transfer() {
    if (!transferTo || transferAmount <= 0) return;
    await fetch(`/api/transactions/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromAccountId: accountId,
        toAccountId: transferTo,
        amount: transferAmount,
        date: new Date().toISOString().slice(0, 10),
        currency: baseCurrency,
      }),
    });
    setTransferAmount(0);
    setTransferTo("");
    await load();
  }

  useEffect(() => {
    load();
    fetch("/api/accounts").then(r=>r.json()).then(d=> setAccounts((d.accounts||[]).map((a:any)=>({id:a.id, name:a.name}))));
  }, [accountId, txPage, snapPage]);

  function tradesFrom(arr: any[]): Tx[] {
    return (arr || []).filter((t) => t.type !== "CASH_IN" && t.type !== "CASH_OUT");
  }

  async function addCashflow() {
    const amt = cashType === "CASH_IN" ? Math.abs(cashAmount) : -Math.abs(cashAmount);
    await fetch(`/api/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId,
        type: cashType,
        tradeDate: cashDate,
        cashAmount: Math.abs(amt),
        currency: baseCurrency,
      }),
    });
    setCashAmount(0);
    await load();
  }

  async function addSnapshot() {
    await fetch(`/api/valuations/snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, asOf: snapDate, totalValue: snapValue }),
    });
    setSnapValue(0);
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b pb-2">
        {[
          { k: "cash", n: "现金流" },
          { k: "trades", n: "交易" },
          { k: "snapshots", n: "估值快照" },
          { k: "performance", n: "绩效" },
        ].map((t) => (
          <Button key={t.k} variant={tab === (t.k as any) ? "default" : "outline"} size="sm" onClick={() => setTab(t.k as any)}>
            {t.n}
          </Button>
        ))}
      </div>

      {tab === "cash" && (
        <Card>
          <CardHeader>
            <CardTitle>新增现金流</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <Label>日期</Label>
                <Input type="date" value={cashDate} onChange={(e) => setCashDate(e.target.value)} />
              </div>
              <div>
                <Label>类型</Label>
                <select className="border rounded px-2 py-2 w-full" value={cashType} onChange={(e) => setCashType(e.target.value as any)}>
                  <option value="CASH_IN">注资</option>
                  <option value="CASH_OUT">提现</option>
                </select>
              </div>
              <div>
                <Label>金额</Label>
                <Input type="number" value={cashAmount} onChange={(e) => setCashAmount(Number(e.target.value))} />
              </div>
              <div>
                <Button onClick={addCashflow}>保存</Button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="md:col-span-4"><strong>账户间转账</strong></div>
              <div>
                <Label>目标账户</Label>
                <select className="border rounded px-2 py-2 w-full" value={transferTo} onChange={(e)=>setTransferTo(e.target.value)}>
                  <option value="">选择账户</option>
                  {accounts.filter(a=>a.id!==accountId).map(a=> (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>金额</Label>
                <Input type="number" value={transferAmount} onChange={(e)=>setTransferAmount(Number(e.target.value))} />
              </div>
              <div>
                <Button onClick={transfer}>转账</Button>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">日期</th>
                    <th className="text-left py-2">类型</th>
                    <th className="text-left py-2">金额</th>
                  </tr>
                </thead>
                <tbody>
                  {[...cashflows].sort((a,b)=> new Date(a.tradeDate).getTime()-new Date(b.tradeDate).getTime()).map((c) => (
                    <tr key={c.id} className="border-b">
                      <td className="py-2">{new Date(c.tradeDate).toLocaleDateString()}</td>
                      <td className="py-2">{c.type === "CASH_IN" ? "注资" : "提现"}</td>
                      <td className="py-2">{formatCurrency(Number(c.cashAmount || 0), baseCurrency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTxPage(Math.max(1, txPage - 1))}
                  disabled={txPage === 1}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTxPage(txPage + 1)}
                  disabled={txPage * 50 >= txTotal}
                >
                  下一页
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "trades" && (
        <Card>
          <CardHeader>
            <CardTitle>交易列表</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">日期</th>
                    <th className="text-left py-2">类型</th>
                    <th className="text-left py-2">金额</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t) => (
                    <tr key={t.id} className="border-b">
                      <td className="py-2">{new Date(t.tradeDate).toLocaleDateString()}</td>
                      <td className="py-2">{t.type}</td>
                      <td className="py-2">{t.cashAmount ? formatCurrency(Number(t.cashAmount), baseCurrency) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "snapshots" && (
        <Card>
          <CardHeader>
            <CardTitle>新增估值快照</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <Label>日期</Label>
                <Input type="date" value={snapDate} onChange={(e) => setSnapDate(e.target.value)} />
              </div>
              <div>
                <Label>总市值</Label>
                <Input type="number" value={snapValue} onChange={(e) => setSnapValue(Number(e.target.value))} />
              </div>
              <div>
                <Button onClick={addSnapshot}>保存</Button>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">日期</th>
                    <th className="text-left py-2">总市值</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((s: any) => (
                    <tr key={s.id} className="border-b">
                      <td className="py-2">{new Date(s.asOf).toLocaleDateString()}</td>
                      <td className="py-2">{formatCurrency(Number(s.totalValue), baseCurrency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSnapPage(Math.max(1, snapPage - 1))} disabled={snapPage === 1}>上一页</Button>
                <Button variant="outline" size="sm" onClick={() => setSnapPage(snapPage + 1)} disabled={snapshots.length < 50 || (snapPage * 50) >= snapTotal}>下一页</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "performance" && (
        <Card>
          <CardHeader>
            <CardTitle>绩效</CardTitle>
          </CardHeader>
          <CardContent>
            {perf ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-500">起始市值</div>
                  <div className="text-xl font-semibold">{formatCurrency(perf.startValue, baseCurrency)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">期末市值</div>
                  <div className="text-xl font-semibold">{formatCurrency(perf.endValue, baseCurrency)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">净入金</div>
                  <div className="text-xl font-semibold">{formatCurrency(perf.netContribution, baseCurrency)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">收益额</div>
                  <div className="text-xl font-semibold">{formatCurrency(perf.pnl, baseCurrency)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">TWR</div>
                  <div className="text-xl font-semibold">{(perf.twr * 100).toFixed(2)}%</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">XIRR</div>
                  <div className="text-xl font-semibold">{(perf.xirr * 100).toFixed(2)}%</div>
                </div>
              </div>
            ) : (
              <div className="text-gray-500">暂无绩效数据</div>
            )}
            {series.length > 0 && (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">日期</th>
                      <th className="text-left py-2">总市值</th>
                      <th className="text-left py-2">净入金累计</th>
                      <th className="text-left py-2">累计TWR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {series.map((pt) => (
                      <tr key={pt.date} className="border-b">
                        <td className="py-2">{new Date(pt.date).toLocaleDateString()}</td>
                        <td className="py-2">{formatCurrency(pt.value, baseCurrency)}</td>
                        <td className="py-2">{formatCurrency(pt.cumulativeNetContribution, baseCurrency)}</td>
                        <td className="py-2">{(pt.twrCumulative * 100).toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}


