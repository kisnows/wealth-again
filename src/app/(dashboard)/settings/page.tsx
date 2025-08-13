"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const defaultParams = {
  city: "Hangzhou",
  year: new Date().getFullYear(),
  monthlyBasicDeduction: 5000,
  brackets: [
    { threshold: 0, rate: 0.03, quickDeduction: 0 },
    { threshold: 36000, rate: 0.1, quickDeduction: 2520 },
    { threshold: 144000, rate: 0.2, quickDeduction: 16920 },
    { threshold: 300000, rate: 0.25, quickDeduction: 31920 },
    { threshold: 420000, rate: 0.3, quickDeduction: 52920 },
    { threshold: 660000, rate: 0.35, quickDeduction: 85920 },
    { threshold: 960000, rate: 0.45, quickDeduction: 181920 },
  ],
  sihfRates: { pension: 0.08, medical: 0.02, unemployment: 0.005 },
  sihfBase: { min: 5000, max: 28017 },
  specialDeductions: { children: 1000 },
};

export default function ConfigPage() {
  const [json, setJson] = useState(JSON.stringify(defaultParams, null, 2));
  const [parsedParams, setParsedParams] = useState(defaultParams);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [effectiveFrom, setEffectiveFrom] = useState<string>(new Date().toISOString().slice(0,10));

  useEffect(() => {
    // 尝试从服务器加载现有配置
    loadConfig();
  }, []);

  useEffect(() => {
    // 解析 JSON 配置以用于表格展示
    try {
      const parsed = JSON.parse(json);
      setParsedParams(parsed);
      setError("");
    } catch (err) {
      // 如果 JSON 无效，保持上一个有效的解析结果
    }
  }, [json]);

  async function loadConfig() {
    try {
      const res = await fetch(`/api/config/tax-params?city=Hangzhou&year=2025&page=${page}&pageSize=50`);
      if (res.ok) {
        const data = await res.json();
        setJson(JSON.stringify(data.params, null, 2));
        setRecords(data.records || []);
      }
    } catch (err) {
      console.log("No existing config found, using default");
    }
  }

  async function save() {
    setLoading(true);
    setError("");
    setMsg("");
    
    try {
      // 验证 JSON 格式
      const bodyObj = JSON.parse(json);
      
      const res = await fetch("/api/config/tax-params", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...bodyObj, effectiveFrom }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setMsg("配置保存成功！");
      } else {
        setError(data.error || "保存失败");
      }
    } catch (err: any) {
      if (err instanceof SyntaxError) {
        setError("JSON 格式错误，请检查语法");
      } else {
        setError(err.message || "保存失败");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>税务参数配置</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label htmlFor="config-json" className="block text-sm font-medium mb-2">
                配置参数 (JSON格式)
              </label>
              <textarea
                id="config-json"
                value={json}
                onChange={(e) => setJson(e.target.value)}
                rows={15}
                className="w-full p-2 border rounded-md font-mono text-sm"
                placeholder="请输入税务参数配置"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-2">
                <label className="text-sm">生效日期</label>
                <input type="date" className="border rounded px-2 py-1" value={effectiveFrom} onChange={(e)=>setEffectiveFrom(e.target.value)} />
              </div>
              <Button onClick={save} disabled={loading}>
                {loading ? "保存中..." : "保存配置"}
              </Button>
              <Button variant="outline" onClick={() => setJson(JSON.stringify(defaultParams, null, 2))}>
                重置为默认值
              </Button>
            </div>
            {error && (
              <div className="p-2 bg-red-100 text-red-800 rounded-md">
                错误: {error}
              </div>
            )}
            {msg && (
              <div className="p-2 bg-green-100 text-green-800 rounded-md">
                {msg}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 可视化展示区域 */}
      <Card>
        <CardHeader>
          <CardTitle>税务参数预览</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 基本信息 */}
          <div>
            <h3 className="text-lg font-medium mb-2">基本信息</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 border rounded-md">
                <p className="text-sm text-gray-500">城市</p>
                <p className="font-medium">{parsedParams.city}</p>
              </div>
              <div className="p-3 border rounded-md">
                <p className="text-sm text-gray-500">年份</p>
                <p className="font-medium">{parsedParams.year}</p>
              </div>
              <div className="p-3 border rounded-md">
                <p className="text-sm text-gray-500">月基本扣除额</p>
                <p className="font-medium">¥{parsedParams.monthlyBasicDeduction.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* 税率区间表 */}
          <div>
            <h3 className="text-lg font-medium mb-2">个人所得税率区间</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>应纳税所得额区间</TableHead>
                  <TableHead>税率</TableHead>
                  <TableHead>速算扣除数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedParams.brackets.map((bracket, index) => {
                  const nextBracket = parsedParams.brackets[index + 1];
                  return (
                    <TableRow key={index}>
                      <TableCell>
                        ¥{bracket.threshold.toLocaleString()} - {nextBracket ? `¥${(nextBracket.threshold - 1).toLocaleString()}` : "以上"}
                      </TableCell>
                      <TableCell>{(bracket.rate * 100).toFixed(1)}%</TableCell>
                      <TableCell>¥{bracket.quickDeduction.toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* 社保公积金比例 */}
          <div>
            <h3 className="text-lg font-medium mb-2">社保公积金比例</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 border rounded-md">
                <p className="text-sm text-gray-500">养老保险</p>
                <p className="font-medium">{(parsedParams.sihfRates.pension * 100).toFixed(1)}%</p>
              </div>
              <div className="p-3 border rounded-md">
                <p className="text-sm text-gray-500">医疗保险</p>
                <p className="font-medium">{(parsedParams.sihfRates.medical * 100).toFixed(1)}%</p>
              </div>
              <div className="p-3 border rounded-md">
                <p className="text-sm text-gray-500">失业保险</p>
                <p className="font-medium">{(parsedParams.sihfRates.unemployment * 100).toFixed(1)}%</p>
              </div>
            </div>
            <div className="mt-2 p-3 border rounded-md">
              <p className="text-sm text-gray-500">缴费基数范围</p>
              <p className="font-medium">¥{parsedParams.sihfBase.min.toLocaleString()} - ¥{parsedParams.sihfBase.max.toLocaleString()}</p>
            </div>
          </div>

          {/* 专项扣除 */}
          <div>
            <h3 className="text-lg font-medium mb-2">专项附加扣除</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(parsedParams.specialDeductions).map(([key, value]) => (
                <div key={key} className="p-3 border rounded-md">
                  <p className="text-sm text-gray-500">
                    {key === 'children' ? '子女教育' : key}
                  </p>
                  <p className="font-medium">¥{value.toLocaleString()}/月</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>历史与未来生效记录</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b"><th className="text-left py-2">生效日期</th><th className="text-left py-2">版本摘要</th></tr></thead>
              <tbody>
                {records.map((r:any)=> (
                  <tr key={r.id} className="border-b">
                    <td className="py-2">{new Date(r.effectiveFrom).toLocaleDateString()}</td>
                    <td className="py-2 text-sm">{r.key}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={()=>{setPage(Math.max(1,page-1)); loadConfig();}} disabled={page===1}>上一页</Button>
            <Button variant="outline" size="sm" onClick={()=>{setPage(page+1); loadConfig();}}>下一页</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
