"use client";
import { useState } from "react";

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
  const [msg, setMsg] = useState("");
  async function save() {
    const res = await fetch("/api/config/tax-params", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: json,
    });
    const data = await res.json();
    setMsg(JSON.stringify(data));
  }
  return (
    <div>
      <h2>税参配置</h2>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={20}
        cols={80}
      />
      <div>
        <button onClick={save}>保存</button>
      </div>
      <pre>{msg}</pre>
    </div>
  );
}
