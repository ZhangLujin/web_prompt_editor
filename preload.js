// preload.js
const { marked } = require('marked');

window.addEventListener('DOMContentLoaded', () => {
  // 将 marked 暴露给渲染进程
  window.marked = marked;
  
  // 配置 marked 选项
  marked.setOptions({
    breaks: true,  // 将换行符转换为 <br>
    gfm: true      // 使用 GitHub 风格的 Markdown
  });
});
