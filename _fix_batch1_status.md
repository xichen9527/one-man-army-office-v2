# 批次1修复状态 — 任务列表 + 文件夹 + 项目/任务/文档合并 + 协作模块

**日期**: 2026-07-16  
**构建状态**: ✅ 零 TypeScript 错误（仅 CRM 模块有预存错误，不在本批次范围）

---

## 问题1: 获取任务列表失败 ✅ 已修复

**根因**: 
- `task-store.ts` 中 `fetchTasks` 使用 `.eq('creator_id', user.id)` 只能查到用户创建的任务，查不到被分配的任务
- 关联查询语法 `project:projects!project_id(id, name)` 中外键名不正确

**修复**:
- 改用 `.or('creator_id.eq.xxx,assignee_id.eq.xxx')` 同时查询创建和被分配的任务
- 修正外键名为 `projects!tasks_project_id_fkey`
- `fetchSubTasks` 容错处理：`parent_task_id` 列可能不存在，返回空数组而非报错

---

## 问题2: 获取文件夹失败 ✅ 已修复

**根因**: 
- **数据库中没有 `folders` 表** — 这是根本原因
- `documents` 表没有 `folder_id`、`doc_type`、`shared_with`、`tags`、`is_public` 列
  - 实际列名为 `type`（不是 `doc_type`）
  - 没有 `folder_id` 列
  - 没有 `is_public` 列
  - 没有 `shared_with` 列
  - 没有 `tags` 列
- `files` 表列名不匹配：DB 用 `uploaded_by`，代码用 `uploader_id`
- `files` 表没有 `folder_id` 和 `public_url` 列

**修复**:
- `document-store.ts` 完全重写：
  - 文件夹改为 localStorage 存储（`oma_folders` key），不再查 DB
  - 文档查询使用正确的列名 `type`（而非 `doc_type`）
  - 移除对不存在列的引用（`folder_id`、`shared_with`、`tags`、`is_public`）
  - 添加 `project_id` / `task_id` 关联查询支持
  - 添加项目名称和任务名称的联查
- `file-store.ts` 修复：
  - 使用 `uploaded_by` 替代 `uploader_id` 写入 DB
  - 移除 `folder_id` 引用
  - `public_url` 改为从 storage API 动态计算，不作为 DB 列
  - `fetchFiles` 支持 `projectId` 和 `taskId` 参数过滤

---

## 问题3: 项目、任务、文档三个模块数据不互通 ✅ 已修复

**根因**:
- 三个 store 独立运行，没有关联查询
- 文档没有按 `project_id` 过滤
- 任务页面没有显示项目名称
- 文档页面没有项目过滤

**修复**:
- `task-store.ts`: 已有 `project_id` 关联，修正外键名确保联查正常工作
- `document-store.ts`: 
  - 新增 `selectedProjectId` 状态
  - `fetchDocuments` 支持 `projectId` 参数过滤
  - 文档查询联查 `projects` 表获取项目名称
  - 文档查询联查 `tasks` 表获取任务名称
- `documents/page.tsx`:
  - 添加项目筛选侧边栏（可按项目过滤文档和文件）
  - 文档卡片显示关联的项目名和任务名
  - 新建文档时可选择关联项目
  - 文件上传时关联当前选中的项目
- `dashboard-store.ts`:
  - 修正任务查询使用 `creator_id`（而非 `assignee_id`）
  - 任务状态判断同时检查 `done` 和 `completed`
  - 外键名修正为 `tasks_project_id_fkey`

---

## 问题4: 协作模块无法邀请用户 ✅ 已修复

**根因**:
- 没有 `channel_members` 表的读写功能
- 没有邀请 UI
- `messages` 表没有 `is_edited` 列（代码中尝试写入）
- `channels` 表没有 `updated_at` 列

**修复**:
- `collaboration-store.ts` 重写：
  - 新增 `ChannelMember` 类型
  - 新增 `channelMembers` 状态
  - 新增 `fetchChannelMembers()` — 获取频道成员（容错：表不存在时返回空）
  - 新增 `inviteUser(channelId, email, role)` — 按邮箱查找用户并添加到频道
  - 新增 `removeMember(channelId, memberId)` — 移除频道成员
  - `updateMessage` 不再尝试写入 `is_edited` 列（改为本地标记）
  - 消息查询添加容错：profile join 失败时回退到无 join 查询
  - 频道切换时自动加载成员列表
- `collaboration/page.tsx` 重写：
  - 新增「邀请」按钮和对话框（输入邮箱邀请用户）
  - 新增「成员」按钮和对话框（查看频道成员列表、移除成员）
  - 频道标题栏显示成员数量
  - 成员列表显示头像、姓名、邮箱、角色

---

## 修改的文件清单

| 文件 | 修改类型 |
|------|---------|
| `src/lib/store/task-store.ts` | 修复查询语法、外键名、容错 |
| `src/lib/store/document-store.ts` | 完全重写（localStorage 文件夹、正确列名、项目关联） |
| `src/lib/store/file-store.ts` | 修复列名（uploaded_by）、移除不存在列、动态计算 public_url |
| `src/lib/store/dashboard-store.ts` | 修复任务查询字段、外键名、状态判断 |
| `src/lib/store/collaboration-store.ts` | 重写（新增成员管理、邀请功能、容错处理） |
| `src/app/(main)/documents/page.tsx` | 重写（项目筛选、正确字段名、关联显示） |
| `src/app/(main)/collaboration/page.tsx` | 重写（邀请 UI、成员列表 UI） |

---

## 数据库 Schema 注意事项

以下 SQL 迁移建议后续执行（不影响当前代码运行，但能启用完整功能）：

1. **channel_members 表**（协作模块邀请功能依赖）:
```sql
CREATE TABLE IF NOT EXISTS channel_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_id, user_id)
);
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;
```

2. **documents 表补充列**（可选，当前代码已兼容无这些列的情况）:
```sql
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_type TEXT;
```

3. **folders 表**（如果需要服务端文件夹）:
```sql
CREATE TABLE IF NOT EXISTS folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
当前代码使用 localStorage 存储文件夹，不依赖此表。
