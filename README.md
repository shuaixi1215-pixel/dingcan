# 云味小馆订餐网站

一个在线订餐网页项目，包含菜单浏览、购物车、起送价判断、填写配送信息、提交订单、订单记录和商家后台。当前版本已加入 Cloudflare Pages Functions API 和 D1 数据库表结构；数据库未绑定时，页面仍会自动使用浏览器本地演示数据。

## 在线地址

- Cloudflare Pages: https://dingcan.pages.dev
- 自定义域名配置中: https://www.meiqi.site

## 使用方式

直接打开 `index.html` 即可体验点餐流程。

商家后台入口：

```text
admin.html
```

演示后台密码：

```text
888888
```

## 功能

- 菜品分类浏览
- 加入购物车和数量调整
- 满起送价后提交订单
- 优先提交到云端 API，未配置数据库时回退到本地演示
- 商家后台查看订单
- 商家后台修改订单状态
- 商家后台控制菜品上下架
- 适配桌面和手机屏幕

## 云端数据库配置

Cloudflare Pages Functions 会读取名为 `DB` 的 D1 绑定。

推荐操作：

1. 在 Cloudflare 后台进入 `Workers & Pages`，打开 `dingcan` 项目。
2. 进入 `Storage & databases`，创建一个 D1 数据库，例如 `dingcan-db`。
3. 在 D1 的 Console 或 Wrangler 中执行 `schema.sql`，创建数据表。
4. 回到 Pages 项目，进入 `Settings` -> `Bindings`。
5. 添加 `D1 database` 绑定：
   - Variable name: `DB`
   - D1 database: 选择刚创建的 `dingcan-db`
6. 重新部署项目。

绑定完成后：

- 前台 `/api/dishes` 会从 D1 读取菜品，并自动初始化默认菜单。
- 前台 `/api/orders` 会把订单保存到 D1。
- 后台可以从 D1 查看订单、改订单状态、控制菜品上下架。

## 商家后台登录

后台已升级为真实账号登录：

- 首次打开 `admin.html` 时，如果数据库里还没有管理员，会进入“创建管理员账号”模式。
- 密码不会明文保存，会使用 PBKDF2 + 随机盐哈希后存入 D1。
- 登录成功后使用 HttpOnly Cookie 保存会话。
- 读取订单、修改订单状态、菜品上下架都需要已登录后台。

如果数据库已经创建过旧版表，不需要手动删库。新认证表会在访问登录接口时自动创建；也可以在 D1 Console 手动执行：

```text
migrations/2026-07-01-admin-auth.sql
```

## 下一步

下一步建议加入订单声音/微信通知、支付二维码或在线支付，以及菜品图片上传。
