# CloudDock Mini 项目工作流

## 任务列表

| 任务ID | 描述 | 状态 |
|--------|------|------|
| mini-task-001 | 添加 tabBar 图标资源（home/tunnel/device/profile） | done |
| mini-task-002 | 实现页面下拉刷新功能 | pending |
| mini-task-003 | 添加加载状态骨架屏 | pending |
| mini-task-004 | 优化网络错误重试机制 | pending |
| mini-task-005 | 添加单元测试（api/client.ts, stores/*） | pending |

## 说明

- `pending` - 待分配
- `in_progress` - 进行中
- `done` - 已完成

## 已完成任务

- **mini-task-001** - 添加 tabBar 图标资源（home/tunnel/device/profile）
  - 图标已放置于 `src/assets/icons/`
  - 已配置 `app.json` tabBar 使用这些图标
  - 包含 4 组图标：home、tunnel、device、profile（每组含默认/激活状态）
