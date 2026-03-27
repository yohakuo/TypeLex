# TypeLex

TypeLex 面向听写、章节化练习和错题复习场景，所有数据默认保存在浏览器本地，也可以自行配置同步方案。

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

### 技术栈

- Next.js 15
- React 19
- TypeScript
- Vitest
- localStorage（本地持久化）



## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
npm run dev
```

## 同步方案
使用轻量数据库 [Supabase](https://supabase.com/dashboard/project/xkfmrnoixutdzjhjsqvy/branches)。

首先需要在项目根目录手动创建环境变量文件。
1. 在 `D:\Projects\TypeLex` 新建 `.env.local`
2. 填入 Supabase 项目公开配置：
```  
NEXT_PUBLIC_SUPABASE_URL= https://你的-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的-anon-key
```
这两个值在 [Supabase](https://supabase.com/dashboard/project/xkfmrnoixutdzjhjsqvy/branches) 对应项目（点击项目名）的主页里找：
在项目名下有一个链接，鼠标移到上面会悬浮显示Project URL 和 Publishable Key

---

接下来在左侧打开 SQL Editor，新建一个 query，粘贴并执行这段 SQL：
> [!note]- 
> ```
> create table if not exists public.user_app_snapshots (   
>     user_id uuid primary key references auth.users(id) on  
>   delete cascade,
>     snapshot jsonb not null,
>     schema_version integer not null,
>     updated_at timestamptz not null default timezone('utc',   now()),
>     updated_by_device_id text
>   );
> 
>   alter table public.user_app_snapshots enable row level   
>   security;
> 
>   drop policy if exists "users can read own snapshot" on   
>   public.user_app_snapshots;
>   create policy "users can read own snapshot"
>   on public.user_app_snapshots
>   for select
>   to authenticated
>   using (auth.uid() = user_id);
> 
>   drop policy if exists "users can insert own snapshot" on 
>   public.user_app_snapshots;
>   create policy "users can insert own snapshot"
>   on public.user_app_snapshots
>   for insert
>   to authenticated
>   with check (auth.uid() = user_id);
> 
>   drop policy if exists "users can update own snapshot" on 
>   public.user_app_snapshots;
>   create policy "users can update own snapshot"
>   on public.user_app_snapshots
>   for update
>   to authenticated
>   using (auth.uid() = user_id)
>   with check (auth.uid() = user_id);
> 
>   create or replace function
>   public.set_user_app_snapshots_updated_at()
>   returns trigger
>   language plpgsql
>   as $$
>   begin
>     new.updated_at = timezone('utc', now());
>     return new;
>   end;
>   $$;
> 
>   drop trigger if exists set_user_app_snapshots_updated_at 
>   on public.user_app_snapshots;
>   create trigger set_user_app_snapshots_updated_at
>   before update on public.user_app_snapshots
>   for each row
>   execute function
>   public.set_user_app_snapshots_updated_at();
> ```


---

接着在左侧打开 Authentication，确保 Email 登录是开启的
  - Sign In / Providers → Email  

配置站点 URL / Redirect URL
- Authentication → URL Configuration
  - Site URL 
    http://localhost:3000
  - Redirect URLs
    http://localhost:3000/settings
    http://127.0.0.1:3000/settings

最后重启开发服务器 `npm run dev`。
