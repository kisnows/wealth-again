import { redirect } from "next/navigation";

/**
 * 新建账户页面组件
 *
 * 访问 /accounts/new 时重定向至账户列表页面。
 * 新建账户功能通过 AccountsPage 中的弹窗实现。
 */
export default function NewAccountPage() {
  redirect("/accounts");
}
