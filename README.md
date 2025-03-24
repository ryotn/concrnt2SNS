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
THREADS_ENABLE="true" or "false"
THREADS_ACCESS_TOKEN="Threads User Access Tokens"
NOSTR_ENABLE="true" or "false"
NOSTR_PRIVATE_KEY="Nostrのプライベートキー"
NOSTR_RELAYS="wss://から始まるリレーサーバーのURL、複数指定する場合はカンマで区切る 例:wss://relay1.com,wss://relay2.com,wss://relay3.com"
CC_SUBKEY="コンカレのサブキー"
LISTEN_TIMELINE="ホーム以外のタイムラインを指定したい場合はID@host形式で1つ指定"

// Option（使わない場合は入れないこと）
TW_WEBHOOK_URL="メディアなしのTweetをIFTTT経由で行う場合のWebHookURL"
TW_WEBHOOK_IMAGE_URL="1枚だけ画像ありのTweetをIFTTT経由で行う場合のWebHookURL"
```

4. `npm start`で多分動く！！

## Threads User Access Tokensについて

> 【超簡単】PythonでThreads APIを使って遊んでみた #初心者 - Qiita
> [https://qiita.com/Naoya_pro/items/c8f06bdfcb4be3817036](https://qiita.com/Naoya_pro/items/c8f06bdfcb4be3817036)

こちらを参考に`Threads User Access Tokens`を発行してください。  
`Threads User Access Tokens`は公開アカウントじゃないと作成できないので、非公開の場合は一旦公開にしてください。  
発行後に非公開にしても問題ありません。  

## その他

pm2とかでデーモン化するといいかも  
https://pm2.keymetrics.io/  

## `TW_WEBHOOK_URL`や`TW_WEBHOOK_IMAGE_URL`について

Twitterの無料APIの制限がキツイので、メディアなしのTweetをIFTTT経由で行えるようにしました。  
IFTTTでこいういうAppletを作ってWebHookのURLを`TW_WEBHOOK_URL`と`TW_WEBHOOK_IMAGE_URL`にセットしてください。  
※IFTTT Pro以上必須です。

### メディアなしのTweet用 (TW_WEBHOOK_URL)

![image](https://github.com/user-attachments/assets/6350bd08-b941-4108-8b13-fda947bdd655)
![image](https://github.com/user-attachments/assets/3c4b34ca-4412-458a-9342-d0b537f7cc6e)

### 1枚だけ画像ありのTweet用 (TW_WEBHOOK_IMAGE_URL)

![image](https://github.com/user-attachments/assets/6271c892-2db6-4bf5-8c17-f7f7bb56e33c)
![image](https://github.com/user-attachments/assets/27ed9a51-d20b-4786-b3ac-5354b4aa76c7)
