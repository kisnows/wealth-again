"use client";

import {
  AlertCircleIcon,
  CheckCircleIcon,
  FileTextIcon,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { notifyAsync } from "@/lib/utils/notify";

type Props = {
  title: string;
  description?: string;
  placeholder?: string;
  onSubmit: (items: unknown[]) => Promise<unknown>;
  examples?: { name: string; data: unknown[] }[];
};

export default function RulesUpsertForm({
  title,
  description,
  placeholder,
  onSubmit,
  examples = [],
}: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [validationState, setValidationState] = useState<{
    isValid: boolean;
    error?: string;
    parsedData?: unknown[];
    itemCount?: number;
  }>({ isValid: false });

  // 实时验证JSON格式
  const validateJson = (jsonText: string) => {
    if (!jsonText.trim()) {
      setValidationState({ isValid: false });
      return;
    }

    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) {
        setValidationState({
          isValid: false,
          error: "数据必须是数组格式",
        });
        return;
      }

      setValidationState({
        isValid: true,
        parsedData: parsed,
        itemCount: parsed.length,
      });
    } catch (e) {
      setValidationState({
        isValid: false,
        error: `JSON 格式错误：${(e as Error).message}`,
      });
    }
  };

  const handleTextChange = (value: string) => {
    setText(value);
    validateJson(value);
  };

  const submit = async () => {
    if (!validationState.isValid || !validationState.parsedData) {
      toast.error("请检查数据格式");
      return;
    }

    const count = validationState.itemCount ?? 0;
    try {
      setLoading(true);
      await notifyAsync(
        () => onSubmit(validationState.parsedData),
        {
          loading: "正在提交配置…",
          success: `已成功提交 ${count} 条规则配置`,
          error: (error) =>
            error instanceof Error && error.message
              ? error.message
              : "提交失败，请重试",
        },
      );
      setText("");
      setValidationState({ isValid: false });
    } catch (error) {
      console.error("rules upsert error", error);
    } finally {
      setLoading(false);
    }
  };

  const loadExample = (example: { name: string; data: unknown[] }) => {
    const jsonText = JSON.stringify(example.data, null, 2);
    setText(jsonText);
    validateJson(jsonText);
  };

  const textareaClassName = cn(
    "font-mono text-sm",
    validationState.error &&
      "border-destructive/60 focus-visible:border-destructive focus-visible:ring-destructive/30",
    validationState.isValid &&
      !validationState.error &&
      "border-primary/60 focus-visible:border-primary focus-visible:ring-primary/30",
  );
  const textareaId = "rules-upsert-json";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileTextIcon className="w-5 h-5" />
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        {examples.length > 0 && (
          <Tabs className="w-full" defaultValue="input">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="input">数据输入</TabsTrigger>
              <TabsTrigger value="examples">示例数据</TabsTrigger>
            </TabsList>

            <TabsContent className="space-y-4" value="input">
              <div className="space-y-2">
                <Label
                  className="text-sm font-medium text-muted-foreground"
                  htmlFor={textareaId}
                >
                  JSON 数据（数组格式）
                </Label>
                <Textarea
                  aria-invalid={validationState.error ? true : undefined}
                  className={textareaClassName}
                  id={textareaId}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder={placeholder}
                  rows={12}
                  value={text}
                />

                {/* 验证状态显示 */}
                <div className="flex items-center gap-2">
                  {validationState.isValid ? (
                    <div className="flex items-center gap-1 text-emerald-500">
                      <CheckCircleIcon className="w-4 h-4" />
                      <span className="text-sm">
                        JSON 格式正确，共 {validationState.itemCount} 条记录
                      </span>
                    </div>
                  ) : validationState.error ? (
                    <div className="flex items-center gap-1 text-destructive">
                      <AlertCircleIcon className="w-4 h-4" />
                      <span className="text-sm">{validationState.error}</span>
                    </div>
                  ) : text.trim() ? (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <AlertCircleIcon className="w-4 h-4" />
                      <span className="text-sm">正在验证...</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <Button
                className="w-full"
                disabled={loading || !validationState.isValid}
                onClick={submit}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    提交中...
                  </>
                ) : (
                  `提交配置 ${validationState.itemCount ? `(${validationState.itemCount} 条)` : ""}`
                )}
              </Button>
            </TabsContent>

            <TabsContent className="space-y-4" value="examples">
              <div className="mb-4 text-sm text-muted-foreground">
                选择示例数据快速填入，你可以基于示例修改后提交：
              </div>
              <div className="grid gap-3">
                {examples.map((example, index) => (
                  <Card
                    className="p-4"
                    key={example.name ? `${example.name}-${index}` : String(index)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{example.name}</h4>
                      <Button
                        onClick={() => loadExample(example)}
                        size="sm"
                        variant="outline"
                      >
                        使用此示例
                      </Button>
                    </div>
                    <pre className="max-h-32 overflow-auto rounded bg-muted/30 p-2 text-xs text-muted-foreground">
                      {JSON.stringify(example.data, null, 2)}
                    </pre>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}

        {examples.length === 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label
                className="text-sm font-medium text-muted-foreground"
                htmlFor={textareaId}
              >
                JSON 数据（数组格式）
              </Label>
              <Textarea
                aria-invalid={validationState.error ? true : undefined}
                className={textareaClassName}
                id={textareaId}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder={placeholder}
                rows={12}
                value={text}
              />

              {/* 验证状态显示 */}
              <div className="flex items-center gap-2">
                {validationState.isValid ? (
                  <div className="flex items-center gap-1 text-emerald-500">
                    <CheckCircleIcon className="w-4 h-4" />
                    <span className="text-sm">
                      JSON 格式正确，共 {validationState.itemCount} 条记录
                    </span>
                  </div>
                ) : validationState.error ? (
                  <div className="flex items-center gap-1 text-destructive">
                    <AlertCircleIcon className="w-4 h-4" />
                    <span className="text-sm">{validationState.error}</span>
                  </div>
                ) : text.trim() ? (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <AlertCircleIcon className="w-4 h-4" />
                    <span className="text-sm">正在验证...</span>
                  </div>
                ) : null}
              </div>
            </div>

            <Button
              className="w-full"
              disabled={loading || !validationState.isValid}
              onClick={submit}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  提交中...
                </>
              ) : (
                `提交配置 ${validationState.itemCount ? `(${validationState.itemCount} 条)` : ""}`
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
