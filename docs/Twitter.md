# Twitter - Twitterクライアント

## 概要

`Twitter`は、Twitter（現X）へ投稿するためのクライアントクラスです。`twitter-api-v2`ライブラリを使用してツイート投稿、メディアアップロード、センシティブメディア警告の設定などを行います。また、IFTTTのWebHookを使用した投稿にも対応しています。

## 機能

- ✅ テキストツイートの投稿
- ✅ メディア（画像・動画）付きツイートの投稿
- ✅ センシティブメディア警告の設定
- ✅ メディアアップロードの自動リトライ（最大3回）
- ✅ IFTTTのWebHook経由での投稿
- ✅ YouTube MusicのURL自動変換

## 使用方法

```javascript
import Twitter from './src/Clients/Twitter.js';

// 初期化
const twitterClient = new Twitter(
  apiKey,
  apiKeySecret,
  accessToken,
  accessTokenSecret,
  webhookURL,        // オプション: テキスト投稿用WebHook URL
  webhookImageURL    // オプション: 画像1枚投稿用WebHook URL
);

// ツイート投稿
await twitterClient.tweet(text, filesBuffer);
```

## コンストラクタ

```javascript
new Twitter(apiKey, apiKeySecret, token, tokenSecret, webhookURL?, webhookURLImage?)
```

**パラメータ:**
- `apiKey` (string): TwitterのAPI Key
- `apiKeySecret` (string): TwitterのAPI Key Secret
- `token` (string): Access Token
- `tokenSecret` (string): Access Token Secret
- `webhookURL` (string, optional): メディアなしツイート用のIFTTT WebHook URL
- `webhookURLImage` (string, optional): 画像1枚ツイート用のIFTTT WebHook URL

## メソッド

### tweet(text, filesBuffer)

ツイートを投稿します。メディアの有無やWebHookの設定に応じて最適な方法で投稿します。

**投稿方法の判定:**
1. 画像1枚 + WebHook画像URL設定あり → WebHook経由で投稿
2. メディアあり → メディアをアップロードしてAPIで投稿
3. メディアなし + WebHook URL設定あり → WebHook経由で投稿
4. その他 → Twitter APIで投稿

**パラメータ:**
- `text` (string): ツイート本文
- `filesBuffer` (Array): メディアファイルの配列

**filesBufferの形式:**
```javascript
Array<{
  buffer: Buffer,     // ファイルのバッファ
  type: string,       // MIMEタイプ（"image/jpeg" または "video/mp4"）
  flag?: string,      // センシティブメディアフラグ
  url?: string        // 元のURL（WebHook投稿時に使用）
}>
```

**特別な処理:**
- YouTube MusicのURL（`https://music.youtube.com/watch`）を通常のYouTube URL（`https://youtube.com/watch`）に自動変換

### uploadMedia(filesBuffer)

メディアファイルをTwitterにアップロードします。

**機能:**
- 最大3回までの自動リトライ
- 動画は長時間動画（longVideo）オプションを有効化
- センシティブメディア警告の自動設定

**パラメータ:**
- `filesBuffer` (Array): メディアファイルの配列

**戻り値:**
- `Promise<Array<string>>`: アップロードされたメディアIDの配列（失敗したものは除外）

### tweetAtWebHook(url, text, imageURL?)

IFTTTのWebHook経由でツイートを投稿します。

**パラメータ:**
- `url` (string): WebHook URL
- `text` (string): ツイート本文
- `imageURL` (string, optional): 画像URL

**送信データ:**
```javascript
{
  "value1": text,      // ツイート本文
  "value2": imageURL   // 画像URL（オプション）
}
```

## センシティブメディア警告

Concrntのセンシティブメディアフラグ（`flag`）をTwitterの警告ラベルに変換します。

**フラグマッピング:**
```javascript
{
  'porn': 'adult_content',      // アダルトコンテンツ
  'hard': 'graphic_violence',   // グラフィックな暴力
  'nude': 'adult_content',      // ヌード（アダルトコンテンツとして扱う）
  'warn': 'other'               // その他
}
```

**注意:**
- フラグ付きメディアが1つでもある場合、すべてのメディアに警告が表示されます
- 動画のみの投稿の場合、APIの制限によりフラグ設定ができません

## IFTTTとの連携

Twitter APIの無料版は制限が厳しいため、IFTTTのWebHookを経由してツイートすることができます。

### 必要なもの
- IFTTT Pro以上のアカウント
- WebHook Applet（README参照）

### 使用例

**メディアなしツイート:**
```javascript
const twitterClient = new Twitter(
  apiKey,
  apiKeySecret,
  accessToken,
  accessTokenSecret,
  'https://maker.ifttt.com/trigger/tweet/with/key/YOUR_KEY'
);

await twitterClient.tweet('Hello World!', []);
// WebHook経由で投稿される
```

**画像1枚ツイート:**
```javascript
const twitterClient = new Twitter(
  apiKey,
  apiKeySecret,
  accessToken,
  accessTokenSecret,
  undefined,
  'https://maker.ifttt.com/trigger/tweet_image/with/key/YOUR_KEY'
);

const filesBuffer = [{
  buffer: imageBuffer,
  type: 'image/jpeg',
  url: 'https://example.com/image.jpg'
}];

await twitterClient.tweet('画像付きツイート', filesBuffer);
// WebHook経由で投稿される
```

## エラーハンドリング

- すべてのエラーはコンソールに出力されます
- メディアアップロードは最大3回まで自動でリトライされます
- リトライ間隔: 1秒
- WebHook投稿が失敗した場合、エラーをスローします

## 依存関係

- `twitter-api-v2` - Twitter API v2 クライアント
- `axios` - HTTP リクエスト（WebHook用）

## 使用例

```javascript
import Twitter from './src/Clients/Twitter.js';
import Media from './src/Utils/Media.js';

const twitter = new Twitter(
  process.env.TW_API_KEY,
  process.env.TW_API_KEY_SECRET,
  process.env.TW_ACCESS_TOKEN,
  process.env.TW_ACCESS_TOKEN_SECRET,
  process.env.TW_WEBHOOK_URL,
  process.env.TW_WEBHOOK_IMAGE_URL
);

// テキストのみ
await twitter.tweet('こんにちは！', []);

// 画像付き
const media = new Media();
const files = await media.downloader([
  { url: 'https://example.com/image.jpg', type: 'image' }
]);
await twitter.tweet('画像付きツイート', files);

// センシティブメディア付き
const sensitiveFiles = await media.downloader([
  { url: 'https://example.com/image.jpg', type: 'image', flag: 'porn' }
]);
await twitter.tweet('センシティブな画像', sensitiveFiles);
```

## 注意事項

- Twitter APIの利用には制限があります（レート制限など）
- 動画のアップロードは時間がかかる場合があります
- センシティブメディア警告は動画のみの投稿では設定できません
- IFTTTのWebHookはIFTTT Pro以上が必要です
- YouTube MusicのURLは自動的に通常のYouTube URLに変換されます（OGP取得のため）
