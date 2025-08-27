"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = {
  title: string;
  placeholder?: string;
  onSubmit: (items: unknown) => Promise<any>;
};

export default function RulesUpsertForm({ title, placeholder, onSubmit }: Props) {
  const [text, setText] = useState(placeholder ?? "");
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    try {
      setLoading(true);
      const json = JSON.parse(text || "[]");
      await onSubmit(json);
      toast.success("已提交配置");
    } catch (e: any) {
      toast.error(e?.message || "提交失败");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="grid gap-3">
        <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
        <Button onClick={submit} disabled={loading}>{loading ? "提交中…" : "提交"}</Button>
      </CardContent>
    </Card>
  );
}

