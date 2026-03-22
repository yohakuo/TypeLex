# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指导。

## 仓库状态

本仓库包含一个基于 Next.js 15 App Router 的本地优先拼写练习应用 MVP，名为 Wordspell。

## 常用命令

本仓库使用 npm。

- 安装依赖：`npm install`
- 本地运行：`npm run dev`
- 构建生产版本：`npm run build`
- 构建后启动生产服务器：`npm run start`
- 运行 lint：`npm run lint`
- 运行完整测试套件：`npm run test`
- 监听模式运行测试：`npm run test:watch`
- 运行单个测试文件：`npx vitest run __tests__/answer.test.ts`

## 架构

### 主要入口

- `app/layout.tsx` - 根布局、全局样式和应用数据 provider 配置
- `app/page.tsx` - 首页/仪表盘，包含统计摘要和快速操作
- `app/books/page.tsx` - 单词本列表和创建流程
- `app/books/[bookId]/page.tsx` - 单词本详情，包含单词管理、CSV 导入/导出和编辑
- `app/study/[bookId]/page.tsx` - 沉浸式听写拼写页面，使用浏览器语音合成和键盘快捷键
- `app/review/page.tsx` - 待复习和最近拼错的单词队列

### 顶层目录结构

- `app/` - 路由文件和全局样式
- `components/` - 小型共享 UI 组件（导航、空状态等）
- `features/books/` - 单词本选择器和领域辅助函数
- `features/study/` - 答案标准化和比较逻辑
- `features/review/` - 复习调度和队列选择逻辑
- `lib/storage/` - 版本化的 localStorage 数据模型和持久化辅助函数
- `lib/speech/` - 浏览器语音合成 hook
- `lib/csv/` - CSV 解析和导出辅助函数
- `lib/types/` - 共享领域类型
- `providers/` - 客户端应用数据 context/provider
- `__tests__/` - Vitest 纯逻辑模块测试

### 数据流

- 所有应用状态存储在一个本地优先的 `AppData` 结构中，保存在 localStorage 里。
- `providers/app-data-provider.tsx` 在客户端加载数据，通过 React context 暴露 CRUD 和学习操作，并将更新持久化回 localStorage。
- 各页面从 provider 读取数据，将业务逻辑委托给纯的 feature/lib 函数。
- 听写尝试通过 `features/review/scheduling.ts` 更新复习调度。
- CSV 导入/导出完全在浏览器端处理。
- 发音使用浏览器 `speechSynthesis` API，不依赖后端或外部音频服务。

### 测试

- 纯逻辑测试位于 `__tests__/` 目录。
- 当前测试覆盖包含答案标准化、CSV 解析/导出和复习调度/选择器。

### 仓库约定

- 将仅浏览器的代码放在客户端组件或客户端 hooks 中。
- 业务逻辑优先使用纯函数，以便在 UI 之外可测试。
- 通过共享的 `AppData` 存储模块持久化新的应用数据，而非使用临时的 localStorage key。
- v1 阶段保持应用本地优先，不添加后端或账户系统，除非明确要求。
