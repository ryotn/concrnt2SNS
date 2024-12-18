# concrnt2SNS
コンカレからTwitter(現X)とBlueskyにポストするスクリプト


## Setup
1. `npm i`
2. `.env`を作成する
3. .envの中身

```env
TW_ENABLE="true" or "false"
TW_API_KEY="TwitterのAPI_KEY"
TW_API_KEY_SECRET="TwitterのAPI_KEY_SECRET"
TW_ACCESS_TOKEN="TwitterのACCESS_TOKEN"
TW_ACCESS_TOKEN_SECRET="TwitterのACCESS_TOKEN_SECRET"
BS_ENABLE="true" or "false"
BS_IDENTIFIER="BlueskyのIDENTIFIER"
BS_APP_PASSWORD="BlueskyのAPP_PASSWORD"
BS_SERVICE="BlueskyのサーバーURL https://bsky.social　とか"
CC_SUBKEY="コンカレのサブキー"
LISTEN_TIMELINE="ホーム以外のタイムラインを指定したい場合はID@host形式で1つ指定"

// Option（使わない場合は入れないこと）
TW_WEBHOOK_URL="メディアなしのTweetをIFTTT経由で行う場合のWebHookURL"
```
4. `npm start`で多分動く！！

## その他
pm2とかでデーモン化するといいかも  
https://pm2.keymetrics.io/  

## TW_WEBHOOK_URLについて
Twitterの無料APIの制限がキツイので、メディアなしのTweetをIFTTT経由で行えるようにしました。  
IFTTTでこいういうAppletを作ってWebHookのURLをTW_WEBHOOK_URLにセットしてください。  
![image](https://github.com/user-attachments/assets/6350bd08-b941-4108-8b13-fda947bdd655)
![image](https://github.com/user-attachments/assets/3c4b34ca-4412-458a-9342-d0b537f7cc6e)

