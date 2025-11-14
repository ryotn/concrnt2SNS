# AtProtocol - Blueskyクライアント

## 概要

`AtProtocol`は、Bluesky Social（AT Protocol）へ投稿するためのクライアントクラスです。`@atproto/api`ライブラリを使用してテキスト投稿、メディアアップロード、OGP画像の埋め込み、センシティブコンテンツラベルの設定などを行います。

## 機能

- ✅ テキスト投稿
- ✅ メディア（画像・動画）付き投稿
- ✅ OGP画像の埋め込み
- ✅ リンクの自動検出と埋め込み（RichText）
- ✅ センシティブコンテンツラベルの設定
- ✅ メディアアップロードの自動リトライ（最大3回）
- ✅ 動画のアップロードとジョブステータスの監視
- ✅ サービス認証（Service Auth）

## 使用方法

```javascript
import AtProtocol from './src/Clients/AtProtocol.js';

// 初期化（非同期）
const bskyClient = await AtProtocol.build(
  'https://bsky.social',
  'username.bsky.social',
  'app-password'
);

// 投稿
await bskyClient.post(text, urls, filesBuffer, ccClient);
```

## 静的メソッド

### build(service, Identifier, appPassword)

AtProtocolクライアントを初期化します。

**パラメータ:**
- `service` (string): BlueskyサーバーのURL（例: `https://bsky.social`）
- `Identifier` (string): ユーザーID（例: `username.bsky.social`）
- `appPassword` (string): アプリパスワード

**戻り値:**
- `Promise<AtProtocol>`: 初期化されたクライアントインスタンス

## メソッド

### post(text, urls, filesBuffer, ccClient?)

Blueskyに投稿します。

**パラメータ:**
- `text` (string): 投稿本文
- `urls` (Array<string>): URLの配列（OGP画像取得用）
- `filesBuffer` (Array): メディアファイルの配列
- `ccClient` (optional): Concrntクライアント（OgImage取得時に使用）

**filesBufferの形式:**
```javascript
Array<{
  uint8Array: Uint8Array,  // ファイルデータ
  type: string,            // MIMEタイプ
  flag?: string,           // センシティブメディアフラグ
  aspectRatio: {           // アスペクト比
    width: number,
    height: number
  }
}>
```

**投稿内容の優先順位:**
1. メディアがある場合 → メディアを埋め込み
2. メディアがなくURLがある場合 → OGP画像を埋め込み
3. それ以外 → テキストのみ

### uploadBlob(data, type)

バイナリデータをBlueskyにアップロードします。

**機能:**
- 最大3回までの自動リトライ
- リトライ間隔: 1秒

**パラメータ:**
- `data` (Uint8Array): アップロードするデータ
- `type` (string): MIMEタイプ

**戻り値:**
- `Promise<BlobRef>`: アップロードされたblobの参照

### uploadOgImage(ogImage)

OGP画像を外部埋め込みとしてアップロードします。

**パラメータ:**
```javascript
{
  url: string,           // 元のURL
  title: string,         // タイトル
  description: string,   // 説明
  uint8Array: Uint8Array,// 画像データ
  type: string          // MIMEタイプ
}
```

**戻り値:**
```javascript
{
  $type: "app.bsky.embed.external",
  external: {
    uri: string,
    title: string,
    description: string,
    thumb?: BlobRef    // 画像のアップロードに成功した場合
  }
}
```

### uploadMedia(filesBuffer)

メディアファイル（画像・動画）をアップロードします。

**対応メディア:**
- 画像: 複数アップロード可能
- 動画: 1つのみ、最大50MB、最大60秒

**動画の制限:**
- ファイルサイズ: 50MB以下
- 再生時間: 60秒以下
- 形式: MP4

**パラメータ:**
- `filesBuffer` (Array): メディアファイルの配列

**戻り値:**
```javascript
{
  embed: {
    $type: 'app.bsky.embed.images' | 'app.bsky.embed.video',
    images?: Array<ImageRef>,  // 画像の場合
    video?: BlobRef,          // 動画の場合
    aspectRatio: {            // 動画の場合
      width: number,
      height: number
    }
  },
  flags: Array<string>        // センシティブメディアフラグ
}
```

### uploadVideo(data)

動画をBlueskyにアップロードします。

**処理:**
1. Service Authを取得
2. `video.bsky.app`にアップロード
3. ジョブIDを返す

**パラメータ:**
- `data` (Uint8Array): 動画データ

**戻り値:**
```javascript
{
  jobId: string  // ジョブID（ステータス確認用）
}
```

**エラーコード:**
- `409`: 同じ動画が既にアップロード済み（再利用可能）
- `400`: ファイルサイズが50MB以上、または60秒以上

### getVideoJobStatus(jobId)

動画アップロードジョブのステータスを取得します。

**パラメータ:**
- `jobId` (string): ジョブID

**戻り値:**
```javascript
{
  jobStatus: {
    state: 'JOB_STATE_COMPLETED' | 'JOB_STATE_FAILED' | ...,
    blob?: BlobRef  // 完了時
  }
}
```

### getServiceAuth(aud, lxm)

サービス認証トークンを取得します。

**パラメータ:**
- `aud` (string): Audience（JWT（JSON Web Token）の標準クレーム。例: `did:web:video.bsky.app`）
- `lxm` (string): Lexicon method（例: `app.bsky.video.uploadVideo`）

**戻り値:**
```javascript
{
  success: boolean,
  token: string
}
```

## センシティブコンテンツラベル

Concrntのセンシティブメディアフラグ（`flag`）をBlueskyのラベルに変換します。

**フラグマッピング:**
```javascript
{
  'porn': 'porn',            // ポルノ
  'hard': 'sexual',          // 性的コンテンツ
  'nude': 'nudity',          // ヌード
  'warn': 'graphic-media'    // グラフィックメディア（グロ・事故・戦争・災害等）
}
```

**適用:**
- フラグ付きメディアが1つでもある場合、すべてのメディアに警告が表示されます
- 自己ラベル（Self Labels）として投稿に付与されます

## RichText

Blueskyの`RichText`機能を使用してリンクやメンションを自動検出します。

```javascript
const rt = new RichText({ text: text });
await rt.detectFacets(this.agent);

// 投稿に facets を含める
record.facets = rt.facets;
```

## 動画アップロードの流れ

1. `uploadVideo()`で動画をアップロード → ジョブIDを取得
2. `getVideoJobStatus()`でジョブのステータスを確認
3. `JOB_STATE_COMPLETED`になるまでポーリング（1秒間隔）
4. 完了したらblobを取得して投稿に埋め込む

**リトライ:**
- `JOB_STATE_FAILED`の場合、最大3回までリトライ

## 依存関係

- `@atproto/api` - AT Protocol クライアント
- `axios` - HTTP リクエスト（動画アップロード用）
- `OgImage` - OGP画像取得

## 使用例

```javascript
import AtProtocol from './src/Clients/AtProtocol.js';
import Media from './src/Utils/Media.js';
import CCMsgAnalysis from './src/Utils/ConcrntMessageAnalysis.js';

// 初期化
const bskyClient = await AtProtocol.build(
  'https://bsky.social',
  'username.bsky.social',
  'app-password'
);

const media = new Media();
const ccMsgAnalysis = new CCMsgAnalysis();

// メッセージの解析
const messageBody = 'こんにちは！ https://example.com ![画像](https://example.com/image.jpg)';
const plainText = ccMsgAnalysis.getPlaneText(messageBody);
const urls = ccMsgAnalysis.getURLs(messageBody);
const mediaFiles = ccMsgAnalysis.getMediaFiles(messageBody);

// メディアのダウンロード
const filesBuffer = await media.downloader(mediaFiles);

// 投稿
await bskyClient.post(plainText, urls, filesBuffer);
```

## エラーハンドリング

- すべてのエラーはコンソールに出力されます
- メディアアップロードは最大3回まで自動でリトライされます
- 動画処理が失敗した場合も最大3回までリトライされます
- アップロードに失敗したメディアは除外されます

## 注意事項

- Blueskyのアカウントが必要です
- アプリパスワードを使用してください（メインパスワードではありません）
- 動画アップロードは時間がかかる場合があります（処理完了まで待機）
- 動画は1つのみアップロード可能です（複数の場合は最初の1つのみ）
- 画像は複数アップロード可能です
- OGP画像の埋め込みは、メディアがない場合にのみ行われます
- `aud`の取得方法が完璧ではない可能性があります（JWTのパース）
