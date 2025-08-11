"use client";
import { useState } from "react";

export default function IncomePage() {
  const [city, setCity] = useState("Hangzhou");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [gross, setGross] = useState(20000);
  const [forecast, setForecast] = useState<any[]>([]);

  async function submit() {
    await fetch("/api/income/monthly", {
      method: "POST",
      body: JSON.stringify({ city, year, month, gross }),
      headers: { "Content-Type": "application/json" },
    });
    const f = await fetch(`/api/income/forecast?city=${city}&year=${year}`);
    const data = await f.json();
    setForecast(data.results || []);
  }

  return (
    <div>
      <h2>收入录入</h2>
      <div className="flex gap-2 flex-wrap items-end mb-2">
        <label>
          城市 <input value={city} onChange={(e) => setCity(e.target.value)} />
        </label>
        <label>
          年份{" "}
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>
        <label>
          月份{" "}
          <input
            type="number"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          />
        </label>
        <label>
          税前(元){" "}
          <input
            type="number"
            value={gross}
            onChange={(e) => setGross(Number(e.target.value))}
          />
        </label>
        <button onClick={submit}>保存并预测</button>
      </div>
      <h3>累计预扣结果</h3>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>月</th>
            <th>累计应税</th>
            <th>本月税</th>
            <th>累计税</th>
            <th>税后</th>
          </tr>
        </thead>
        <tbody>
          {forecast.map((r) => (
            <tr key={r.month}>
              <td>{r.month}</td>
              <td>{r.taxableCumulative}</td>
              <td>{r.taxThisMonth}</td>
              <td>{r.taxDueCumulative}</td>
              <td>{r.net}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
