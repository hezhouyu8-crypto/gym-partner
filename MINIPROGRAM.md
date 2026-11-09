# gym partner 微信小程序

当前第一版改为微信原生小程序 + 微信云开发，无需部署阿里云、运行 Express 或构建 Expo 安装包。`mobile/` 和 `server/` 保留为以后独立 App 的基础。

## 已实现

暖白、珊瑚橙和深蓝灰界面，包含找搭子、发布、约练、我的四个入口。支持微信身份识别、自填昵称与城市、训练场馆和部位、未来30天训练时间、部位筛选、邀约接受/婉拒/取消、双方聊天、举报、双向拉黑、删除训练、删除账号及关联数据。聊天仅在页面可见时每10秒刷新，显示最近100条。没有假用户或假匹配；未连接云环境时明确显示配置状态。

小程序代码已编写并通过本地业务测试，尚未连接真实微信云环境，也未在微信开发者工具编译或真机验收；不能声称已上线。

## 注册与导入

1. 在 https://mp.weixin.qq.com/ 注册并登录“小程序”账号。按真实业务选择服务类目与主体；同城搭子、用户发帖与聊天是否可用，以平台实际资质和审核要求为准，不能仅按“工具”类目绕过审核。
2. 从 https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html 安装官方微信开发者工具，扫码登录。
3. 导入本仓库根目录，使用你的小程序 AppID 替换 `project.config.json` 的 `touristappid`。
4. 开通云开发环境，将环境 ID 填入 `miniprogram/config.js`。AppID 和环境 ID 不是密码；不要将 AppSecret 写入源码。
5. 在云数据库创建下面的集合，每个集合均设置为“仅管理员可读写”，或使用自定义规则 `{"read":false,"write":false}`。客户端只通过云函数访问。

集合：`users`、`workouts`、`invites`、`messages`、`blocks`、`reports`、`rateLimits`。

## 索引与云函数

按控制台提示创建下列复合索引（含 `_id` 作为稳定排序字段）：

- workouts：city 升序、starts 升序、_id 升序。
- invites：sender 升序、created 降序、_id 降序；receiver 升序、created 降序、_id 降序。
- messages：inviteId 升序、created 降序、_id 降序。
- rateLimits：expiresAt 的 TTL 索引，过期时间0秒，自动清理限流计数。

在开发者工具中右键 `cloudfunctions/gymApi`，选择“上传并部署：云端安装依赖”。云函数采用平台支持的 Node.js 运行时，配置适当超时（建议60秒，实际以套餐支持为准）；删除账号数据多时需要重试，最后才删除用户档案。

`config.json` 声明 `security.msgSecCheck` 权限。发布训练、昵称和聊天调用微信内容安全接口；失败时阻止写入，不绕过检查。需要真实 AppID、关联云环境与平台授权后联调。

## 验证与运营

```sh
cd cloudfunctions/gymApi
npm ci
npm test
```

使用两个不同微信账号测试：保存名片 → 发布场馆与部位 → 发出邀约 → 接受 → 聊天 → 拉黑/举报 → 删除账号。第三人不得读取聊天。删除账号会删除双方在该账号邀约中的聊天记录。

管理员在云控制台查看 reports，以 users 文档的 suspended=true 冻结账号。正式发布前需配置运营联系方式、隐私政策、用户协议、举报处理与申诉流程，完成平台要求的备案、类目资质和审核。上述文本尚未作为正式法律文件编制。

云开发不等于永久免费。开通前检查控制台实际试用期限、额度、停服策略和付费规则；本项目不自动购买资源或开启自动续费。

## 官方参考

- 微信开发者工具：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
- 云函数微信身份：https://docs.cloudbase.net/en/recipes/add-cloud-function-wechat-miniprogram
- 数据库安全规则：https://cloud.tencent.cn/document/product/876/41802
- 事务限制：https://docs.cloudbase.net/en/database/transaction

依赖审计：当前 wx-server-sdk 4.0.2 的间接依赖仍有 axios、lodash.set/unset 公告。兼容范围内修复后仍未全部关闭；不能通过强制降级 SDK 来宣称解决，需在正式发布前复核上游修复和实际影响。
