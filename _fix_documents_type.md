# Fix: documents 表 type CHECK 约束违反

## 日期
2026-07-16

## 问题描述
创建文档时数据库报错：`new row for relation "documents" violates check constraint "documents_type_check"`

## 根因分析
数据库 `documents` 表的 `type` 列有 CHECK 约束，原始定义（来自 `D:\oma\_backup_react\supabase-schema.sql` 第 196 行）：
```sql
type text default 'markdown' check (type in ('markdown', 'richtext', 'code'))
```

但前端代码传入了不在此列表中的值：
- `document-store.ts` 默认值：`data.type || 'doc'` → `'doc'` 不在允许列表中
- `documents/page.tsx` UI 选项：`['doc', 'note', 'template', 'PRD', 'API', '报告', '周报']` → 大部分不在允许列表中

## 修复内容

### 1. `src/lib/store/document-store.ts`
- 默认 type 值从 `'doc'` 改为 `'markdown'`（与 DB CHECK 约束兼容）

### 2. `src/app/(main)/documents/page.tsx`
- 新建文档默认 type 从 `'doc'` 改为 `'markdown'`
- UI 类型选项从 `['doc', 'note', 'template', 'PRD', 'API', '报告', '周报']` 改为 `['markdown', 'richtext', 'code', 'note', 'PRD', 'API', '报告', '周报']`
- `docTypeIcon` 映射表更新，移除 `'doc'` 和 `'template'`/`'文档'`/`'规范'`，添加 `'markdown'`/`'richtext'`/`'code'`
- 显示 fallback 从 `'doc'` 改为 `'markdown'`

### 3. `sql/fix_documents_type_check.sql`（新建迁移文件）
扩展 CHECK 约束以包含所有前端使用的类型：
```sql
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_type_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_type_check
  CHECK (type IN ('markdown', 'richtext', 'code', 'note', 'PRD', 'API', '报告', '周报'));
```

## 构建验证
`npm run build` 成功，无错误。

## 需要用户执行
在 Supabase SQL Editor 中执行 `D:\oma2\sql\fix_documents_type_check.sql` 以更新数据库约束。
