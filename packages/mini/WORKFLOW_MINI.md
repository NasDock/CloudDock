# WORKFLOW_MINI.md - CloudDock Mini Program 开发任务

## 任务状态概览

| 任务 ID | 描述 | 状态 |
|---------|------|------|
| mini-task-001 | 项目初始化与脚手架 | done |
| mini-task-002 | 登录/注册流程（Auth） | done |
| mini-task-003 | 首页与设备管理（Dashboard + DeviceListScreen） | done |
| mini-task-004 | 隧道管理（列表/创建/详情） | pending |
| mini-task-005 | 设备绑定（扫码 + 绑定流程） | pending |
| mini-task-006 | 个人中心（Profile） | done |

---

## mini-task-003：首页与设备管理（Dashboard + DeviceListScreen）

### 状态
**done**

### 实现内容

#### 1. Dashboard 页面（`pages/tabs/index`）
- 顶部用户信息区（用户名 + 在线设备数徽章）
- 统计卡片（全部隧道 / 在线 / 离线数量）
- 需要审批的设备提示卡片（pending devices）
- 最近隧道列表（最多显示3条，点击进入详情）
- 账户信息卡片（头像 + 邮箱，点击跳转设备管理）
- 右下角 FAB 按钮（跳转创建隧道）

#### 2. 设备列表页面（`pages/tabs/devices`，又名 DeviceListScreen）
- 两个 Tab：访问控制（Access Control）和 客户端（Clients）
- **访问控制 Tab**：RequestDevice 列表，支持审批/禁止/删除操作，自动放行开关
- **客户端 Tab**：NAS 客户端设备列表，支持重命名、上线/下线、解绑操作
- 状态徽章展示（在线/离线/已下线/待审批/已允许/已禁止）
- 扫码绑定 FAB

#### 3. 设备状态展示
- `Client.status` → 在线/离线 徽章（绿色实心点 / 灰色实心点）
- `RequestDevice.status` → 待审批/已允许/已禁止 徽章
- 设备启用状态（enabled）→ 已下线徽章
- 最后在线时间展示（`formatRelativeTime` 工具函数）

### 相关文件
- `src/pages/tabs/index.ts` - Dashboard 逻辑
- `src/pages/tabs/index.wxml` - Dashboard 模板
- `src/pages/tabs/index.wxss` - Dashboard 样式
- `src/pages/tabs/devices.ts` - 设备管理逻辑
- `src/pages/tabs/devices.wxml` - 设备管理模板
- `src/pages/tabs/devices.wxss` - 设备管理样式
- `src/api/device.ts` - 客户端设备 API
- `src/api/request-device.ts` - 访问控制设备 API
- `src/stores/tunnel.ts` - 隧道状态管理

### Bug 修复
- `RequestDevice.requestDeviceId` vs `deviceId` 字段不一致：代码和模板已统一使用 `requestDeviceId`

---

## mini-task-006：个人中心（Profile）

### 状态
**done** (执行时间: 2026-04-17)

### 实现内容

#### 1. ProfileScreen (`pages/tabs/profile.ts` + `.wxml` + `.wxss`)
- 用户头像（首字母大写）、昵称、邮箱展示
- 会员计划徽章（免费版/专业版/企业版）
- **设备与隧道统计卡片**：显示在线数/总数，支持点击跳转对应 Tab
- 账号信息展示（用户ID、注册时间）
- 账户设置入口
- 关于页面入口
- 退出登录功能（清除 token + 跳转登录页）

#### 2. 设置页面 (`pages/settings/*`)
- **设置首页** (`index`)：通知设置、安全设置、关于
- **通知设置** (`notifications`)：
  - 推送通知开关
  - 设备状态提醒开关
  - 隧道状态提醒开关
  - 邮件通知开关
  - 设置自动保存到 Storage
- **安全设置** (`security`)：
  - 修改密码表单（当前密码、新密码、确认密码）
  - 前端验证（长度、一致性、不能与当前密码相同）
  - 调用 `authApi.updateMe` 修改密码
  - 成功后自动登出并跳转登录页
- **关于页面** (`about`)：
  - App Logo、名称、口号
  - 版本信息、构建日期
  - 检查更新按钮
  - 使用条款、隐私政策、开源许可入口

#### 3. 退出登录功能
- `wx.showModal` 确认弹窗
- 调用 `authStore.logout()` 清除 `accessToken` 和 `refreshToken`
- 使用 `wx.reLaunch` 跳转回登录页

### 相关文件
- `src/pages/tabs/profile.ts` - Profile 逻辑
- `src/pages/tabs/profile.wxml` - Profile 模板
- `src/pages/tabs/profile.wxss` - Profile 样式
- `src/pages/settings/index.ts` - 设置首页逻辑
- `src/pages/settings/index.wxml` - 设置首页模板
- `src/pages/settings/index.wxss` - 设置首页样式
- `src/pages/settings/notifications.ts` - 通知设置逻辑
- `src/pages/settings/notifications.wxml` - 通知设置模板
- `src/pages/settings/notifications.wxss` - 通知设置样式
- `src/pages/settings/security.ts` - 安全设置逻辑
- `src/pages/settings/security.wxml` - 安全设置模板
- `src/pages/settings/security.wxss` - 安全设置样式
- `src/pages/settings/about.ts` - 关于页面逻辑
- `src/pages/settings/about.wxml` - 关于页面模板
- `src/pages/settings/about.wxss` - 关于页面样式
- `src/stores/auth.ts` - 认证状态管理
