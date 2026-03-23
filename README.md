# TypeLex

一个基于 Next.js 15 App Router 的本地优先英语听写与拼写练习应用。

TypeLex 面向听写、章节化练习和错题复习场景，所有数据默认保存在浏览器本地，无需后端服务或账号系统。

## 功能概览

- 本地创建和管理单词本
- 手动添加、编辑、删除单词
- 支持 CSV / TXT 批量导入单词
- 兼容带 `translate`、`phonetic`、`example_translate`、`chapter` 等字段的词表 CSV
- 支持按固定每章大小或按源数据章节分组开始听写练习
- 自动记录每章学习进度，并支持下次继续
- 显示整本与分章完成度
- 自动记录听写结果并生成复习队列
- 支持收集今日错题到“错词本”
- 浏览器内发音播放与重播

## 技术栈

- Next.js 15
- React 19
- TypeScript
- Vitest
- localStorage（本地持久化）

## 适用场景

- 学校英语单词听写
- 考试词汇分章练习
- 个人错词回顾与复习
- 离线/本地优先的轻量学习工具

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 启动生产服务

```bash
npm run start
```

### 运行测试

```bash
npm run test
```

### 监听模式运行测试

```bash
npm run test:watch
```

### 运行 lint

```bash
npm run lint
```

### 清理 CSV 数据

```bash
npm run clean:data -- "雅思听力S4.csv"
```

该命令会：

- 读取原始 CSV
- 复用应用内同一套字段清理与去重规则
- 输出同目录下的 `*.clean.csv`
- 在终端打印保留数、跳过数、重复词数等摘要

## 使用说明

### 1. 创建单词本

进入“管理单词本”页面后，可以创建自己的单词本，并设置每章单词数。

### 2. 导入单词

支持两种格式：

#### CSV

支持两类 CSV：

**1. 标准格式**

```csv
word,meaning,example,notes
```

**2. 扩展格式**

```csv
word,translate,phonetic,example,example_translate,chapter,notes
```

字段说明：

- `word` 必填
- `meaning` 或 `translate` 二选一即可，都会映射为词义
- `phonetic` 选填
- `example` 选填
- `example_translate` 选填，会保存为例句翻译
- `chapter` 选填，用于按源章节分组学习
- `notes` 选填

说明：

- 如果 CSV 中包含 `chapter` 字段，学习页会优先按源章节分组
- 如果没有 `chapter` 字段，则继续按“每章单词数”自动分章
- 当前仍以 CSV / TXT 为主要导入方式，暂未新增 JSON 上传入口
- CSV 解析支持带引号字段、字段内换行、UTF-8 BOM 和 `""` 转义引号

导入前建议先执行清理脚本，尤其是来源复杂、包含多行释义或格式不完全统一的词表。

```bash
npm run clean:data -- "你的词表.csv"
```

清理后的输出文件会采用统一 schema：

```csv
chapter,word,meaning,phonetic,example,exampleTranslate,notes
```

清理与导入共享同一套规则：

- `word` 会先 trim
- 其它字段 trim 后，空串会转为未填写
- 按 `word.toLowerCase()` 去重
- 空 `word` 行会被跳过

导入后会自动去重并忽略空行。

映射关系如下：

- `translate -> meaning`
- `example_translate -> exampleTranslate`
- `chapter -> chapter`
- `phonetic -> phonetic`

标准格式中的 `meaning`、`example`、`notes` 仍保持兼容。


#### TXT

每行一个单词，单词和释义之间使用 Tab 或多个空格分隔，例如：

```txt
emperor   /ˈempərə(r)/ n. 皇帝；君主
```

TXT 导入会将分隔后的后半部分整体作为 `meaning` 保存，适合快速导入简单词表；如果你需要保留 `phonetic`、`chapter`、`example_translate` 等结构化字段，建议使用 CSV。

### 3. 开始听写

选择单词本后，先进入章节列表，再选择具体章节进入听写。

章节页会显示：

- 整本完成进度
- 每章完成数量与百分比
- 是否可以从上次位置继续
- 源章节名（如 `C4`、`Lesson 2`），如果导入数据中提供了 `chapter`

章节规则如下：

- 有显式 `chapter`：按源章节分组
- 无显式 `chapter`：按单词本设置的“每章单词数”自动切分

### 4. 继续上次进度

应用会自动按章节保存学习进度。对于固定分章单词本，进度会结合“单词本 + 章节 + 每章大小”进行区分；对于带显式 `chapter` 的单词本，则会按对应章节分组保存。

当你再次进入同一章节时：

- 未完成章节：从上次停留位置继续
- 已完成章节：默认从头重新练习，但会保留完成标记

### 5. 复习模式

复习页会显示：

- 已到期的待复习单词
- 最近拼错的单词
- 错词本入口（如果存在）

首页还支持将“今日错题”收集到单独的“错词本”中。





## 目录结构

```text
app/                路由页面
components/         共享 UI 组件
features/books/     单词本相关选择器与逻辑
features/study/     听写答案判断逻辑
features/review/    复习调度与选择逻辑
lib/storage/        本地存储与数据模型
lib/speech/         发音播放 hook
lib/csv/            CSV 解析与导出
lib/types/          共享领域类型
providers/          应用数据 Provider
__tests__/          Vitest 纯逻辑测试
```

## 关键页面

- `app/page.tsx`：首页 / 统计概览 / 快捷入口
- `app/books/page.tsx`：单词本列表
- `app/books/[bookId]/page.tsx`：单词本编辑与导入
- `app/study/[bookId]/page.tsx`：章节选择与进度展示
- `app/study/[bookId]/run/page.tsx`：听写运行页
- `app/review/page.tsx`：复习队列与最近错词


