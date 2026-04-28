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
TW_BUFFER_ACCESS_TOKEN="BufferのAccess Token"
TW_LISTEN_TIMELINE="Twitterに転送するタイムラインのID、LISTEN_TIMELINEと同じ形式で1つ指定"
BS_ENABLE="true" or "false"
BS_IDENTIFIER="BlueskyのIDENTIFIER"
BS_APP_PASSWORD="BlueskyのAPP_PASSWORD"
BS_SERVICE="BlueskyのサーバーURL https://bsky.social　とか"
BS_LISTEN_TIMELINE="Blueskyに転送するタイムラインのID、LISTEN_TIMELINEと同じ形式で1つ指定"
THREADS_ENABLE="true" or "false"
THREADS_ACCESS_TOKEN="Threads User Access Tokens"
THREADS_LISTEN_TIMELINE="Threadsに転送するタイムラインのID、LISTEN_TIMELINEと同じ形式で1つ指定"
NOSTR_ENABLE="true" or "false"
NOSTR_PRIVATE_KEY="Nostrのプライベートキー"
NOSTR_RELAYS="wss://から始まるリレーサーバーのURL、複数指定する場合はカンマで区切る 例:wss://relay1.com,wss://relay2.com,wss://relay3.com"
NOSTR_LISTEN_TIMELINE="Nostrに転送するタイムラインのID、LISTEN_TIMELINEと同じ形式で1つ指定"
CC_SUBKEY="コンカレのサブキー"
LISTEN_TIMELINE="ホーム以外のタイムラインを指定したい場合はID@host形式で1つ指定、このタイムラインにポストした場合はすべてのSNSに転送される（ただし、各サービスの *_LISTEN_TIMELINE が設定されている場合はそちらが優先されます）"

```

4. `npm start`で多分動く！！

## フラグ付きメディアについて

メディア投稿時にフラグを設定していると下記のような動作になります。  
markdown投稿でdetailsタグを使ったメディアも同様です。

### Twitter

一つでもフラグ付きのメディアがある場合は、メディアがすべて警告付きボカシ表示になります。  
ただし動画のみの場合はAPIの仕様によりフラグ設定が出来ないため、そのまま表示されます。

### Bluesky

一つでもフラグ付きのメディアがある場合は、メディアがすべて警告表示になります。  

### Nostr

一つでもフラグ付きのメディアがある場合は、投稿そのものが警告表示になります。  

### Threads

フラグ設定が出来ないため、そのまま表示されます。

## Threads User Access Tokensについて

> 【超簡単】PythonでThreads APIを使って遊んでみた #初心者 - Qiita
> [https://qiita.com/Naoya_pro/items/c8f06bdfcb4be3817036](https://qiita.com/Naoya_pro/items/c8f06bdfcb4be3817036)

こちらを参考に`Threads User Access Tokens`を発行してください。  
`Threads User Access Tokens`は公開アカウントじゃないと作成できないので、非公開の場合は一旦公開にしてください。  
発行後に非公開にしても問題ありません。  

## その他

pm2とかでデーモン化するといいかも  
https://pm2.keymetrics.io/  

## Twitter投稿のBuffer連携について

Twitter投稿はBuffer API経由で行います。  
`TW_BUFFER_ACCESS_TOKEN`を設定してください。  
起動時にBuffer APIからServiceがX（twitter）のChannel IDを取得して利用します。
