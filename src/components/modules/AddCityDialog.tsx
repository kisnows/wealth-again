"use client";

import { MapPin, Plus, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Country {
  code: string;
  name: string;
  nameEn: string;
  currency: string;
  hasTaxSystem: boolean;
  hasSocialSecurity: boolean;
  hasHousingFund: boolean;
  description: string;
}

interface AddCityDialogProps {
  onCityAdded?: () => void;
}

export default function AddCityDialog({ onCityAdded }: AddCityDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);

  const [form, setForm] = useState({
    name: "",
    country: "",
    // 社保规则
    socialSecurity: {
      baseMin: "",
      baseMax: "",
      ratePension: "0.08",
      rateMedical: "0.02",
      rateUnemployment: "0.005",
      fixedMedicalPersonal: "",
    },
    // 公积金规则
    housingFund: {
      baseMin: "",
      baseMax: "",
      rateEmployee: "0.12",
    },
  });

  useEffect(() => {
    if (open) {
      fetch("/api/v1/countries")
        .then((res) => res.json())
        .then((data) => setCountries(data))
        .catch((error) => console.error("Failed to fetch countries:", error));
    }
  }, [open]);

  const selectedCountry = countries.find((c) => c.code === form.country);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name || !form.country) {
      toast.error("请填写城市名称和选择国家");
      return;
    }

    setLoading(true);

    try {
      const payload: any = {
        name: form.name,
        country: form.country,
      };

      // 添加社保规则（如果国家支持）
      if (selectedCountry?.hasSocialSecurity) {
        payload.socialSecurityRules = {
          startDate: new Date().toISOString(),
          baseMin: parseFloat(form.socialSecurity.baseMin) || 0,
          baseMax: parseFloat(form.socialSecurity.baseMax) || 999999,
          ratePension: parseFloat(form.socialSecurity.ratePension),
          rateMedical: parseFloat(form.socialSecurity.rateMedical),
          rateUnemployment: parseFloat(form.socialSecurity.rateUnemployment),
          fixedMedicalPersonal: form.socialSecurity.fixedMedicalPersonal
            ? parseFloat(form.socialSecurity.fixedMedicalPersonal)
            : null,
        };
      }

      // 添加公积金规则（如果国家支持）
      if (selectedCountry?.hasHousingFund) {
        payload.housingFundRules = {
          startDate: new Date().toISOString(),
          baseMin: parseFloat(form.housingFund.baseMin) || 0,
          baseMax: parseFloat(form.housingFund.baseMax) || 999999,
          rateEmployee: parseFloat(form.housingFund.rateEmployee),
        };
      }

      const response = await fetch("/api/v1/cities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "创建失败");
      }

      toast.success("城市创建成功");
      setOpen(false);
      setForm({
        name: "",
        country: "",
        socialSecurity: {
          baseMin: "",
          baseMax: "",
          ratePension: "0.08",
          rateMedical: "0.02",
          rateUnemployment: "0.005",
          fixedMedicalPersonal: "",
        },
        housingFund: {
          baseMin: "",
          baseMax: "",
          rateEmployee: "0.12",
        },
      });

      onCityAdded?.();
    } catch (error) {
      console.error("Create city error:", error);
      toast.error(error instanceof Error ? error.message : "创建失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2" variant="outline">
          <Plus className="h-4 w-4" />
          新增城市
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            新增城市
          </DialogTitle>
          <DialogDescription>
            添加新城市并配置相关的税制、社保和公积金规则
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* 基本信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cityName">城市名称 *</Label>
                  <Input
                    id="cityName"
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="如：Seattle, Tokyo"
                    required
                    value={form.name}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">所属国家 *</Label>
                  <Select
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, country: value }))
                    }
                    value={form.country}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择国家" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.name} ({country.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedCountry && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-sm font-medium mb-1">国家信息</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedCountry.description}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    货币: {selectedCountry.currency} | 税制:{" "}
                    {selectedCountry.hasTaxSystem ? "✓" : "✗"} | 社保:{" "}
                    {selectedCountry.hasSocialSecurity ? "✓" : "✗"} | 公积金:{" "}
                    {selectedCountry.hasHousingFund ? "✓" : "✗"}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 规则配置 */}
          {selectedCountry &&
            (selectedCountry.hasSocialSecurity ||
              selectedCountry.hasHousingFund) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    规则配置
                  </CardTitle>
                  <CardDescription>
                    配置该城市的社保和公积金规则，税制将自动继承国家设置
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs className="w-full" defaultValue="social">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger
                        disabled={!selectedCountry.hasSocialSecurity}
                        value="social"
                      >
                        社保规则
                      </TabsTrigger>
                      <TabsTrigger
                        disabled={!selectedCountry.hasHousingFund}
                        value="housing"
                      >
                        公积金规则
                      </TabsTrigger>
                    </TabsList>

                    {selectedCountry.hasSocialSecurity && (
                      <TabsContent className="space-y-4" value="social">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="ssBaseMin">缴费基数下限</Label>
                            <Input
                              id="ssBaseMin"
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  socialSecurity: {
                                    ...prev.socialSecurity,
                                    baseMin: e.target.value,
                                  },
                                }))
                              }
                              placeholder="如：4812"
                              type="number"
                              value={form.socialSecurity.baseMin}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="ssBaseMax">缴费基数上限</Label>
                            <Input
                              id="ssBaseMax"
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  socialSecurity: {
                                    ...prev.socialSecurity,
                                    baseMax: e.target.value,
                                  },
                                }))
                              }
                              placeholder="如：24930"
                              type="number"
                              value={form.socialSecurity.baseMax}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="ratePension">养老保险比例</Label>
                            <Input
                              id="ratePension"
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  socialSecurity: {
                                    ...prev.socialSecurity,
                                    ratePension: e.target.value,
                                  },
                                }))
                              }
                              step="0.001"
                              type="number"
                              value={form.socialSecurity.ratePension}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="rateMedical">医疗保险比例</Label>
                            <Input
                              id="rateMedical"
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  socialSecurity: {
                                    ...prev.socialSecurity,
                                    rateMedical: e.target.value,
                                  },
                                }))
                              }
                              step="0.001"
                              type="number"
                              value={form.socialSecurity.rateMedical}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="rateUnemployment">
                              失业保险比例
                            </Label>
                            <Input
                              id="rateUnemployment"
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  socialSecurity: {
                                    ...prev.socialSecurity,
                                    rateUnemployment: e.target.value,
                                  },
                                }))
                              }
                              step="0.001"
                              type="number"
                              value={form.socialSecurity.rateUnemployment}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="fixedMedical">
                            固定医疗费用（可选）
                          </Label>
                          <Input
                            id="fixedMedical"
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                socialSecurity: {
                                  ...prev.socialSecurity,
                                  fixedMedicalPersonal: e.target.value,
                                },
                              }))
                            }
                            placeholder="如：3"
                            type="number"
                            value={form.socialSecurity.fixedMedicalPersonal}
                          />
                        </div>
                      </TabsContent>
                    )}

                    {selectedCountry.hasHousingFund && (
                      <TabsContent className="space-y-4" value="housing">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="hfBaseMin">缴费基数下限</Label>
                            <Input
                              id="hfBaseMin"
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  housingFund: {
                                    ...prev.housingFund,
                                    baseMin: e.target.value,
                                  },
                                }))
                              }
                              placeholder="如：2490"
                              type="number"
                              value={form.housingFund.baseMin}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="hfBaseMax">缴费基数上限</Label>
                            <Input
                              id="hfBaseMax"
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  housingFund: {
                                    ...prev.housingFund,
                                    baseMax: e.target.value,
                                  },
                                }))
                              }
                              placeholder="如：40694"
                              type="number"
                              value={form.housingFund.baseMax}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="rateEmployee">个人缴费比例</Label>
                          <Input
                            id="rateEmployee"
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                housingFund: {
                                  ...prev.housingFund,
                                  rateEmployee: e.target.value,
                                },
                              }))
                            }
                            step="0.001"
                            type="number"
                            value={form.housingFund.rateEmployee}
                          />
                        </div>
                      </TabsContent>
                    )}
                  </Tabs>
                </CardContent>
              </Card>
            )}

          <div className="flex justify-end gap-2">
            <Button
              disabled={loading}
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              取消
            </Button>
            <Button disabled={loading} type="submit">
              {loading ? "创建中..." : "创建城市"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
