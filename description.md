这是一个基于 Next.js (App Router) 架构的项目。在这样的架构中，每个页面对应的代码文件通常位于 app 目录下的特定路径。

可以通过修改以下文件来更改各个页面的文字内容：

1. 首页 (Home Page)
文件位置：

app/page.tsx
主要内容：首页的欢迎语（如“本地优先的拼写训练工具”、“使用自定义单词本进行听写和复习练习”）、各项数据面板（“单词本”、“总单词数”、“待复习”）、以及一些引导按钮的文字。
2. 单词本/书库管理页面 (Books List Page)
文件位置：

app/books/page.tsx
主要内容：所有单词本的列表展示页面。例如“管理单词本”、“新建单词本”等文字提示都会在这里。
3. 单词本详情页面 (Book Details & Word Management Page)
文件位置：

app/books/[bookId]/page.tsx
主要内容：点击进入某个具体单词本后看到的页面。包含了“添加单词”、“导入”、“返回”按钮以及列表表头的文字。
4. 听写/学习页面 (Study & Dictation Page)
文件位置：

app/study/[bookId]/page.tsx
主要内容：在此页面可以修改打字听写模式下的各种提示文字（例如“输入单词拼写”、“按 Enter 提交”、“左方显示正确答案”等提示语）。由于之前进行了重构，部分内部打字界面的交互文字也可能存放在 features/study/ 目录下（如果该页面拆分了子组件的话）。
5. 复习页面 (Review Page)
文件位置：app/review/page.tsx
主要内容：用于错题和到期单词复习模块的页面。修改“开始复习”、“未找到待复习单词”等相关文本。
🌟 全局共用组件 (Global Components)
有一些界面的文字是所有页面都共享的，它们位于 components 目录下：

顶部导航栏 (Navigation Bar)：components/site-nav.tsx
如果你需要修改顶部的 “Wordspell”、“首页” (Home)、“书库” (Books)、“复习” (Review) 等导航链接文本，请修改这个文件。
空白提示状态 (Empty State)：components/empty-state.tsx
当没有单词本或者没有单词时显示的默认占位提示气泡的文字。