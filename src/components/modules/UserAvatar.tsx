"use client";

import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserInfo {
  id: string;
  email: string;
  name: string;
}

export default function UserAvatar() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/auth/me")
      .then((res) => {
        if (res.ok) {
          return res.json();
        }
        throw new Error("Not authenticated");
      })
      .then((data) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const handleSignOut = () => {
    signOut({ callbackUrl: "/signin" });
  };

  if (loading) {
    return (
      <div
        className="size-9 animate-pulse rounded-full bg-muted"
        data-testid="layout-ui-user-avatar-skeleton"
      />
    );
  }

  if (!user) {
    return (
      <Link data-testid="layout-ui-user-avatar-signin" href="/signin">
        <Button size="sm" variant="outline">
          登录
        </Button>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="rounded-full"
          data-testid="layout-ui-user-avatar-trigger"
          size="icon"
          variant="ghost"
        >
          <div className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {user.name?.charAt(0)?.toUpperCase() ||
              user.email.charAt(0).toUpperCase()}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-60"
        data-testid="layout-ui-user-avatar-menu"
      >
        <div className="px-3 py-2">
          <p className="text-sm font-medium text-foreground">
            {user.name || "用户"}
          </p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            className="flex items-center gap-2 cursor-pointer"
            data-testid="layout-ui-user-avatar-settings"
            href="/settings"
          >
            <Settings className="h-4 w-4" />
            设置
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="flex items-center gap-2 cursor-pointer"
          data-testid="layout-ui-user-avatar-signout"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
