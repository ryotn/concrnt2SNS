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

// Option（使わない場合は入れないこと）
BUFFER_ACCESS_TOKEN="Buffer APIのアクセストークン（無料枠でTwitterのAPI制限を回避する場合に使用）"
BUFFER_TWITTER_PROFILE_ID="Bufferで連携したTwitterアカウントのProfile ID"
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

## `BUFFER_ACCESS_TOKEN`や`BUFFER_TWITTER_PROFILE_ID`について

Twitterの無料APIの制限がキツイので、一部のTweetをBuffer経由で無料で行えるようにしました。
BufferのAPIを使ってTwitterへ投稿することで、Twitter APIの無料枠の制限を回避することができます。

Buffer経由で投稿できるのは以下のとおりです：
- テキストのみ（メディア無し）
- 画像付き（4つまで）
- 動画付き（1つまで）

利用するには以下の設定を行ってください：
1. [Buffer](https://buffer.com/) に登録し、Twitterアカウントを連携させます。
2. [Bufferのデベロッパーページ](https://buffer.com/developers/apps) でアプリを作成し、`Access Token`を取得します。（これを `BUFFER_ACCESS_TOKEN` に設定します）
3. [BufferのAPI](https://buffer.com/developers/api/profiles) などを叩いて、登録したTwitterアカウントの `Profile ID` を取得します。（これを `BUFFER_TWITTER_PROFILE_ID` に設定します）

※フラグ付きメディアの場合や、画像が5枚以上の場合、画像と動画が混在している場合は自動的に通常のTwitter API経由での投稿（制限にカウントされる）にフォールバックされます。
