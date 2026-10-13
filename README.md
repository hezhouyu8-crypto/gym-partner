# gym partner

面向 Android 和 iPhone 的同城健身搭子 App。暖白、珊瑚橙和深蓝灰界面。

## 当前已实现

- 邮箱与密码注册登录，手机会话使用 SecureStore 存储。
- 同城训练列表和部位筛选；明确展示场馆、训练部位、时间。
- 发布训练（未来30天）、邀请、接受、拒绝、取消。
- 接受邀约后聊天，5秒轮询；尚无后台推送。
- 删除训练、举报、双向拉黑、删除账号并级联删除数据。
- SQLite 持久化，密码 scrypt 哈希、随机会话、限流、访问权限控制。

这是开发中的 MVP 源码，并非已发布或已完成上架审核的产品。需要接入真实 HTTPS 服务器、构建签名、真机验收及发布账号，才能提供公开下载。

## 本地运行

需要 Node.js 22.13+。

```sh
cd server
npm ci
npm test
npm start
```

另开终端：

```sh
cd mobile
npm ci
cp .env.example .env
# 把 EXPO_PUBLIC_API_URL 设置为手机可访问的服务器地址
npx expo start
```

手机上的 localhost 指手机自身，不是电脑。iPhone 应使用 HTTPS 测试地址。Android 模拟器本机调试地址通常为 10.0.2.2。

可运行 `npm run typecheck` 和 `npx expo export --platform all` 验证 TypeScript 和三端资源打包。资源导出不等于 APK/IPA 已构建。

## 国内部署

在你自己的国内云服务器上安装 Docker。为 API 域名配置 DNS，根据托管与发布要求完成备案，再操作：

```sh
cd deploy
cp .env.example .env
# 设置 API_DOMAIN 和随机 ADMIN_TOKEN，勿提交 .env
 docker compose up -d --build
```

Caddy 自动申请 HTTPS 证书。放行服务器的80/443端口。SQLite 数据保存在 gp-data Docker 卷中；应定期备份，并验证恢复。当前设计是单机单实例，不要复制 API 实例访问不同数据库。此版本未接入手机短信验证码、密码找回、邮件验证、精确距离、地图或后台推送；不要在宣传中承诺这些功能。

## 安装包与发布

1. 注册 Expo：https://expo.dev/signup
2. 注册 Apple Developer：https://developer.apple.com/programs/enroll/
3. 注册国内托管账号，例如阿里云：https://www.aliyun.com/
4. 在 mobile/.env 配置真实 HTTPS API 地址。
5. `npx eas-cli login`，`npx eas-cli init` 将项目绑定到自己的 Expo 账号。
6. `npx eas-cli build --platform android --profile preview` 构建可安装 APK。
7. `npx eas-cli build --platform ios --profile production` 构建 iOS 商店版本，再通过 `npx eas-cli submit --platform ios` 上传到 App Store Connect/TestFlight。
8. Android 商店包：`npx eas-cli build --platform android --profile production`；大陆安卓商店分别申请开发者账号和上传，不以 Google Play 作为大陆默认渠道。

第一次构建会配置签名。保存好证书/密钥并归属于你本人。`app.gympartner.mobile` 是当前候选包名，首次公开发布前确定唯一性。当前图标仍是模板图标，正式发布前需更换品牌图标。

发布前需补齐主体、联系方式、隐私政策与用户协议、实际收集清单、举报处理机制、App备案资料，并开展 Android / iPhone 真机测试。不要把未审核的法律文本作为正式承诺。

官方参考：
- Expo 构建：https://docs.expo.dev/build/setup/
- Android APK：https://docs.expo.dev/build-reference/apk/
- App备案：https://help.aliyun.com/zh/icp-filing/basic-icp-service/support/basics-about-icp-filling-for-apps

## GitHub

目标仓库：https://github.com/hezhouyu8-crypto/gym-partner 。仓库已创建，当前 GitHub 集成写入请求返回403，需解决内容写权限后上传。CI 配置已备好，仓库根目录应为此目录。不要发密码或访问令牌。

## 举报运营

服务器管理员使用 ADMIN_TOKEN 请求 `/admin/reports` 查看待处理举报，POST `/admin/users/:id/suspend` 冻结违规账号；后台令牌绝不可写入手机客户端。运维需要建立处理时限与申诉渠道，当前没有图形管理后台。

## 尚待关闭的发布检查

依赖审计在 Expo 工具链的间接依赖中发现 braces 和 node-forge 公告，当前上游最新版本仍在受影响范围；uuid 的兼容升级需要验证。不能使用 npm audit fix --force（它建议降级到不兼容的 Expo 44）。这些问题需在正式发布前复核和记录处置，不声称审计已全部通过。后端当前审计为0漏洞。客户端尚未在 Android/iPhone 真机上验收。
