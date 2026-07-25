import { redirect } from "next/navigation";

/**
 * 首页组件
 *
 * 访问根路径时自动重定向至仪表盘页面（/dashboard）。
 * 作为应用入口，不渲染任何 UI，仅执行服务端重定向。
 */
export default function Home() {
  redirect("/dashboard");
}
