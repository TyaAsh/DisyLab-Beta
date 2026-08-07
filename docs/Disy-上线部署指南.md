# Disy 上线部署指南

## 1. 推荐方案

当前项目是 Vite 构建的浏览器端单页应用，推荐先使用 Netlify 发布测试版：配置简单、可提供预览网址，也可以后续连接 GitHub 实现每次推送自动部署。

项目已经加入 `netlify.toml`：

- 构建命令：`npm run build`
- 发布目录：`dist`
- 构建 Node.js：22
- 单页应用回退：任意前端路径返回 `index.html`

Netlify 官方对 Vite 的推荐同样是构建后发布 `dist` 目录。

## 2. 发布前本地检查

建议先安装 Node.js 22 LTS，然后在项目目录执行：

```bash
npm install
npm run typecheck
npm run build
npm run preview
```

构建成功后会生成 `dist/`。不要手工修改 `dist/`，它会在下次构建时重新生成。

## 3. 最快的 Netlify 手动发布

适合先发一个网址给少量朋友试用，不要求先上传 GitHub。

```bash
npm install -g netlify-cli
netlify login
npm run build
netlify init --manual
netlify deploy --dir=dist
```

最后一条会生成一个预览网址。确认预览版正常后再发布生产地址：

```bash
netlify deploy --prod --dir=dist
```

首次运行时按提示选择团队、创建站点并设置站点名称。`.netlify/` 是本地站点关联信息，不应提交到 Git。

## 4. 推荐的 GitHub 自动发布

当项目准备长期迭代时：

1. 把项目初始化为 Git 仓库并提交代码。
2. 创建 GitHub 私有仓库并推送。
3. 在 Netlify 选择“Add new project / Import an existing project”。
4. 授权并选择对应 GitHub 仓库。
5. 确认构建命令为 `npm run build`，发布目录为 `dist`。
6. 部署完成后，每次推送生产分支都会自动更新站点；其他分支和 Pull Request 可生成预览部署。

## 5. API Key 与公共体验的关键风险

当前 Disy 是浏览器端直连生成 API：

- 访问者需要在 API 设置中填写自己的连接和 API Key。
- 不要把你的私密 API Key 写入源码。
- 不要把私密 Key 写入 `VITE_API_KEY`。所有 `VITE_` 变量都会进入浏览器包，访问者可以看到。
- 目标生成服务必须支持浏览器 CORS；否则请求会被浏览器拦截。

如果希望“别人打开就能直接生成，同时消耗你的额度”，下一阶段应先增加服务端代理，至少实现：

- 服务端保存密钥。
- 用户身份或体验码。
- 每人/每 IP 速率和额度限制。
- 请求日志、内容安全和异常封禁。
- 防止任意模型和任意上游地址转发。

在这些保护完成前，建议体验版让测试者使用自己的 API Key。

## 6. 自定义域名

测试完成后，可在 Netlify 的 Domain management 中添加自定义域名，并按页面提示修改域名 DNS。HTTPS 证书通常会由平台自动申请。

域名生效前建议继续保留 Netlify 提供的默认地址作为备用。

## 7. Vercel 备用方案

Vercel 也会自动识别 Vite 项目。使用 GitHub 导入时确认：

- Framework Preset：Vite
- Build Command：`npm run build`
- Output Directory：`dist`

也可以使用 CLI：

```bash
npm install -g vercel
vercel
vercel --prod
```

## 8. 体验版上线检查单

- [ ] 首页、画布和弹窗在目标浏览器显示正常。
- [ ] 文本节点和图片节点可以创建、连接和删除。
- [ ] 文本生成、图片生成、错误提示均测试过。
- [ ] 资产库、生成历史、批量下载和画廊正常。
- [ ] 刷新页面后本地项目仍可恢复。
- [ ] 没有把私人 API Key、测试账号或受限素材提交到仓库。
- [ ] 设置体验说明：数据主要保存在访问者浏览器本地。
- [ ] 设置费用与额度限制方案。
- [ ] 准备问题反馈入口。

## 9. 官方参考

- Netlify Vite 部署：<https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/>
- Netlify 构建配置：<https://docs.netlify.com/build/configure-builds/overview/>
- Vite 静态部署：<https://vite.dev/guide/static-deploy.html>
