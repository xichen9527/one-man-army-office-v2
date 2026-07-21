# 修复批次2状态报告

## 修复时间
2026-07-16 16:27 GMT+8

## 问题5: CRM无法创建新客户 ✅ 已修复

### 根因
1. **字段名不匹配**: `crm-store.ts` 使用 `assigned_to`，但数据库表 `customers` 使用 `owner_id`
2. **联系人字段不匹配**: 代码使用 `contact_name`/`contact_email`/`contact_phone`，数据库使用 `email`/`phone`/`company`
3. **状态值不匹配**: 代码使用中文值 ('潜在','活跃','跟进中','已流失')，数据库使用英文值 ('new','contacted','qualified','proposal','negotiation','won','lost')
4. **商机阶段不匹配**: 代码使用中文值，数据库使用英文值 ('prospecting','qualification','proposal','negotiation','closed_won','closed_lost')
5. **商机金额字段**: 代码使用 `value`，数据库使用 `amount`

### 修复内容
- `crm-store.ts`:
  - `Customer` 接口: `assigned_to` → `owner_id`, `contact_name/email/phone` → `email/phone/company`
  - `SalesOpportunity` 接口: `assigned_to` → `owner_id`, `value` → `amount`
  - `createCustomer`: insert 使用 `owner_id: user.id`
  - `fetchCustomers`: 查询使用 `.eq('owner_id', user.id)`
  - `createOpportunity`: insert 使用 `owner_id: user.id`
  - `fetchOpportunities`: 查询使用 `.eq('owner_id', user.id)`
  - `fetchSalesFunnelStats`: 使用英文阶段值和 `amount` 字段
  - `SalesFunnelStats`: `totalValue` → `totalAmount`
- `crm/page.tsx`:
  - 添加中英文映射常量: `STAGE_LABELS`, `STATUS_LABELS`, `STATUS_OPTIONS`
  - 表单字段: 移除 `contact_name`，添加 `company`/`notes`
  - 所有 UI 显示使用中文 label 映射
  - 筛选按钮使用英文值 + 中文显示
  - 统计卡片使用 `amount`/`closedAmount`

## 问题6: AI对话空回复 ✅ 已修复

### 根因
1. **缺少 `feature_type` 字段**: `ai_conversations` 表要求 `feature_type NOT NULL`（默认 'chat'），但 `createConversation` 未传该字段
2. **SSE 解析不完整**: 未处理跨 chunk 的部分行（buffer 丢失数据）
3. **无降级逻辑**: 流式请求失败时没有非流式 fallback
4. **DB 错误阻断响应**: 用户消息保存失败会中断整个流程

### 修复内容
- `ai-store.ts`:
  - `createConversation`: 添加 `feature_type: 'chat'` 字段
  - `sendMessage` 重写:
    - DB 保存用户消息失败时降级继续（不中断 AI 响应）
    - SSE 解析添加 buffer 处理跨 chunk 的不完整行
    - 支持 `delta.content` 和 `message.content` 两种格式
    - 流式失败后自动降级为非流式请求
    - 流式和非流式都失败时显示错误消息
    - DB 保存 AI 回复失败不阻断 UI 显示
    - 限制上下文消息为最近 20 条

## 问题7: 社媒无法发布帖子 ✅ 已修复

### 根因
1. **account_id 空字符串**: `addPost` 在找不到账号时传 `account_id: ''`，违反 FK 约束
2. **social_accounts 字段名不匹配**: 代码使用 `account_name`/`account_id`，数据库使用 `username`/`platform_user_id`
3. **status 覆盖**: `addPost` 忽略调用方传入的 `status`，强制覆盖

### 修复内容
- `social-store.ts`:
  - `addPost`:
    - 不再传空字符串 `account_id`，改为仅在有时包含
    - 保留调用方传入的 `status`，仅在其未设置时使用默认值
    - 构建明确的 `insertPayload` 对象
  - `addAccount`:
    - 映射接口字段到数据库列名: `account_name` → `username`, `account_id` → `platform_user_id`
    - 构建明确的 `insertData` 对象，避免传递不存在的列
  - `fetchAccounts`:
    - 将数据库返回的 `username`/`platform_user_id` 映射回接口的 `account_name`/`account_id`

## 构建验证
```
npm run build → 成功（零 TypeScript 错误）
```

## 修改文件清单
1. `src/lib/store/crm-store.ts` — 类型定义、字段名、查询条件修复
2. `src/app/(main)/crm/page.tsx` — UI 字段名、状态映射、表单修复
3. `src/lib/store/ai-store.ts` — feature_type、SSE 缓冲、非流式降级、DB 错误处理
4. `src/lib/store/social-store.ts` — addPost account_id 处理、addAccount 字段映射、fetchAccounts 字段映射
