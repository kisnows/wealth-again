"use client";

import { AlertTriangle, LogInIcon, UserPlus2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PageContainer,
  PageHeader,
  PageSection,
} from "@/components/modules/layout/PageLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAdminUsers } from "@/lib/api/user";

/**
 * 管理员用户管理页面组件
 *
 * 提供管理员专用的用户管理界面，包括：
 * - 用户清单：展示所有用户的基本信息（姓名、邮箱、城市、币种、状态）
 * - 新增用户：（待实现）创建新用户
 * - 模拟登录：（待实现）以指定用户身份登录进行调试
 *
 * 访问权限：
 * - 仅管理员可访问，非管理员将显示权限错误
 *
 * 数据来源：
 * - useAdminUsers: 用户列表（管理员接口）
 */
export default function AdminUsersPage() {
  const { data, isLoading, error } = useAdminUsers();
  const users = data?.items ?? [];

  return (
    <PageContainer
      data-testid="identity-admin-page"
      gap="lg"
      maxWidth="xl"
      padding="md"
    >
      <PageHeader
        actions={
          <div className="flex gap-2">
            <Button
              data-testid="identity-admin-action-add"
              size="sm"
              variant="secondary"
            >
              <UserPlus2Icon className="mr-2 h-4 w-4" /> 新增用户
            </Button>
            <Button
              data-testid="identity-admin-action-impersonate"
              size="sm"
              variant="outline"
            >
              <LogInIcon className="mr-2 h-4 w-4" /> 模拟登录
            </Button>
          </div>
        }
        description="管理员可在此查看用户清单、执行模拟登录与敏感操作，后续将补充审计记录提示。"
        testId="identity-admin-header"
        title="用户管理"
      />

      <PageSection
        className="space-y-4"
        contentClassName="space-y-4"
        description="页面骨架已搭建，后续接入 Identity 子系统接口以获取用户清单与详情抽屉。"
        testId="identity-admin-section"
        title="用户清单"
      >
        {error ? (
          <Card data-testid="identity-admin-error">
            <CardHeader className="flex flex-col gap-2">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                无法获取用户列表
              </CardTitle>
              <CardDescription>
                请确认当前账号具有管理员权限或稍后重试。
              </CardDescription>
            </CardHeader>
          </Card>
        ) : isLoading ? (
          <Card data-testid="identity-admin-loading">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              正在加载用户数据…
            </CardContent>
          </Card>
        ) : users.length ? (
          <div className="overflow-x-auto">
            <Table data-testid="identity-admin-table">
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>邮箱</TableHead>
                  <TableHead>当前城市</TableHead>
                  <TableHead>展示币种</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} data-testid="identity-admin-row">
                    <TableCell>{user.name ?? "—"}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {user.currentCity
                        ? `${user.currentCity.name} (${user.currentCity.country})`
                        : user.currentCityId}
                    </TableCell>
                    <TableCell>{user.displayCurrency ?? "自动"}</TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? "default" : "secondary"}>
                        {user.isActive ? "启用" : "停用"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(user.createdAt).toLocaleDateString("zh-CN", {
                        hour12: false,
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button disabled size="sm" variant="ghost">
                          <LogInIcon className="mr-1 h-4 w-4" /> 模拟登录
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Card data-testid="identity-admin-empty">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              暂无用户数据。
            </CardContent>
          </Card>
        )}
      </PageSection>
    </PageContainer>
  );
}
