# Next.js 运行时错误修复状态

## 修复时间
2026-07-16 16:08 GMT+8

## 修复清单

### 问题 1: button 嵌套 button（hydration error）✅ 已修复

**原因**: `DropdownMenuTrigger` 和 `TooltipTrigger` 使用 children 方式包裹 `<Button>` 或 `<Link>` 组件，导致 button 嵌套 button（或 button 嵌套 a），HTML 不允许。

**修改文件**:
- `src/components/layout/topbar.tsx` — 2 处 `DropdownMenuTrigger` 改为 `render` prop 方式
  - 通知按钮：`<DropdownMenuTrigger>` + children `<Button>` → `<DropdownMenuTrigger render={<Button>...} />`
  - 用户菜单：同上
- `src/components/layout/sidebar.tsx` — 1 处 `TooltipTrigger` 改为 `render` prop 方式
  - 折叠侧边栏的导航链接：`<TooltipTrigger>` + children `<Link>` → `<TooltipTrigger render={<Link>...} />`

**验证**: 其他页面文件（projects, tasks, ai, video, settings）已正确使用 `render` prop，无需修改。

### 问题 2: tasks 表查询 400 错误 ✅ 已修复

**原因**: Supabase 关联查询 `project:projects(name)` 缺少外键指定，当表有多个外键或关系不明确时返回 400。

**修改文件**:
- `src/lib/store/dashboard-store.ts` — `project:projects(name)` → `project:projects!project_id(name)`
- `src/lib/store/task-store.ts` — `project:projects(id, name)` → `project:projects!project_id(id, name)`

### 问题 3: scroll-behavior 警告 ✅ 已修复

**原因**: Next.js 检测到 `<html>` 元素上有 `scroll-behavior: smooth` 但缺少 `data-scroll-behavior` 属性。

**修改文件**:
- `src/app/layout.tsx` — `<html lang="zh-CN" suppressHydrationWarning>` → `<html lang="zh-CN" suppressHydrationWarning data-scroll-behavior="smooth">`

### 问题 4: message port closed 警告 ℹ️ 已忽略

**原因**: 浏览器扩展（如 Google Translate）引起，非项目问题。

## 构建验证
- `npm run build` ✅ 成功，17 个静态页面全部生成

## 运行时验证
- `npm run dev` ✅ 服务器正常启动
- `GET /login` → 200 ✅ 页面正常响应
