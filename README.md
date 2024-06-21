# concrnt2SNS
コンカレからTwitter(現X)とBlueskyにポストするスクリプト


## Setup
1. `npm i`
2. `env.js`を作成する
3. env.jsの中身
``` javascript
exports.TW_API_KEY = "TwitterのAPI_KEY"
exports.TW_API_KEY_SECRET = "TwitterのAPI_KEY_SECRET"
exports.TW_ACCESS_TOKEN = "TwitterのACCESS_TOKEN"
exports.TW_ACCESS_TOKEN_SECRET = "TwitterのACCESS_TOKEN_SECRET"
exports.BS_IDENTIFIR = "BlueskyのIDENTIFIR"
exports.BS_APP_PASSWORD = "BlueskyのAPP_PASSWORD"
exports.BS_SERVICE = "BlueskyのサーバーURL https://bsky.social　とか"
exports.CC_SUBKEY = "コンカレのサブキー"
```
4. `node concrnt2SNS.js`で多分動く！！

## その他
foreverとかでデーモン化するといいかも  
https://www.npmjs.com/package/forever