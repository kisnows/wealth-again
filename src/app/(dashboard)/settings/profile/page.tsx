"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Edit,
  Eye,
  EyeOff,
  Key,
  Mail,
  Save,
  Shield,
  User,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  baseCurrency: string;
  currentCity: string;
  createdAt: string;
  lastLoginAt: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/user/profile");
        const data = await response.json();

        if (response.ok && data.success) {
          const userProfile: UserProfile = {
            id: data.data.id,
            email: data.data.email,
            name: data.data.name,
            baseCurrency: data.data.baseCurrency,
            currentCity: "Hangzhou", // This will need to be fetched from city API
            createdAt: new Date().toISOString(), // This should come from user creation date
            lastLoginAt: new Date().toISOString(), // This should come from last login tracking
          };

          setProfile(userProfile);
          setProfileForm({
            name: userProfile.name,
            email: userProfile.email,
          });
        } else {
          setError("获取用户信息失败");
        }
      } catch (err) {
        setError("网络错误，请稍后重试");
        console.error("Error fetching profile:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleProfileSave = async () => {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          baseCurrency: profile?.baseCurrency, // Keep existing base currency for now
          // Note: Name and email updates would require additional API endpoints
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // For now, just update local state since name/email updates need more work
        if (profile) {
          setProfile({
            ...profile,
            name: profileForm.name,
            email: profileForm.email,
          });
        }
        setMessage("个人信息更新成功！");
        setEditing(false);
      } else {
        setError(data.error || "更新失败，请重试");
      }
    } catch (err) {
      setError("更新失败，请重试");
      console.error("Profile update error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setSaving(true);
    setError("");
    setMessage("");

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("新密码确认不一致");
      setSaving(false);
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setError("新密码长度不能少于6位");
      setSaving(false);
      return;
    }

    try {
      // TODO: Implement password change API endpoint
      // const response = await fetch("/api/user/password", {
      //   method: "PUT",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({
      //     currentPassword: passwordForm.currentPassword,
      //     newPassword: passwordForm.newPassword,
      //   }),
      // });

      // For now, simulate the API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setMessage("密码修改功能需要实现 /api/user/password 端点");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      setError("密码修改失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">加载中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* 页面头部 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Link href="/settings">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回设置
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">用户档案</h1>
            <p className="text-gray-600 mt-2">管理个人信息、密码和账户安全设置</p>
          </div>
        </div>
      </div>

      {/* 消息提示 */}
      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {message}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* 用户信息概览 */}
      {profile && (
        <Card>
          <CardHeader>
            <CardTitle>账户信息概览</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <div className="font-semibold text-lg">{profile.name}</div>
                  <div className="text-sm text-gray-600">{profile.email}</div>
                </div>
              </div>

              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{profile.currentCity}</div>
                <div className="text-sm text-gray-600">当前工作城市</div>
              </div>

              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{profile.baseCurrency}</div>
                <div className="text-sm text-gray-600">默认货币</div>
              </div>

              <div className="text-center">
                <div className="text-sm text-gray-600">注册时间</div>
                <div className="font-semibold">
                  {new Date(profile.createdAt).toLocaleDateString("zh-CN")}
                </div>
                <div className="text-xs text-gray-500">
                  最近登录: {new Date(profile.lastLoginAt).toLocaleString("zh-CN")}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 设置标签页 */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">个人信息</TabsTrigger>
          <TabsTrigger value="password">密码安全</TabsTrigger>
          <TabsTrigger value="account">账户设置</TabsTrigger>
        </TabsList>

        {/* 个人信息设置 */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>个人信息</CardTitle>
                {!editing && (
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    <Edit className="w-4 h-4 mr-2" />
                    编辑
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="name">姓名</Label>
                  {editing ? (
                    <Input
                      id="name"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    />
                  ) : (
                    <div className="mt-2 p-3 bg-gray-50 rounded-md">{profile?.name}</div>
                  )}
                </div>

                <div>
                  <Label htmlFor="email">邮箱地址</Label>
                  {editing ? (
                    <Input
                      id="email"
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    />
                  ) : (
                    <div className="mt-2 p-3 bg-gray-50 rounded-md">{profile?.email}</div>
                  )}
                </div>
              </div>

              {editing && (
                <div className="flex space-x-3">
                  <Button onClick={handleProfileSave} disabled={saving}>
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? "保存中..." : "保存"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditing(false);
                      setProfileForm({
                        name: profile?.name || "",
                        email: profile?.email || "",
                      });
                    }}
                  >
                    取消
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 密码安全设置 */}
        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="w-5 h-5 mr-2" />
                密码安全
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="currentPassword">当前密码</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      value={passwordForm.currentPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="newPassword">新密码</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="confirmPassword">确认新密码</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <Button onClick={handlePasswordChange} disabled={saving}>
                <Key className="w-4 h-4 mr-2" />
                {saving ? "修改中..." : "修改密码"}
              </Button>

              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <div className="font-medium mb-1">密码安全建议</div>
                    <ul className="space-y-1 text-xs">
                      <li>• 密码长度至少6位，建议8位以上</li>
                      <li>• 包含数字、字母和特殊字符</li>
                      <li>• 定期更换密码，建议3个月一次</li>
                      <li>• 不要使用常见密码或个人信息</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 账户设置 */}
        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>账户设置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium">双重认证</div>
                    <div className="text-sm text-gray-600">增强账户安全性</div>
                  </div>
                  <Button variant="outline" size="sm">
                    启用
                  </Button>
                </div>

                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium">登录通知</div>
                    <div className="text-sm text-gray-600">新设备登录时发送邮件提醒</div>
                  </div>
                  <Button variant="outline" size="sm">
                    已开启
                  </Button>
                </div>

                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium">数据导出</div>
                    <div className="text-sm text-gray-600">导出个人财务数据</div>
                  </div>
                  <Button variant="outline" size="sm">
                    导出
                  </Button>
                </div>
              </div>

              <div className="border-t pt-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <div className="font-medium text-red-800 mb-2">危险操作</div>
                      <div className="text-sm text-red-700 mb-4">
                        删除账户将永久清除所有数据，此操作不可恢复。
                      </div>
                      <Button variant="destructive" size="sm">
                        删除账户
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
