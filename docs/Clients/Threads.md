# Threads - Threadsクライアント

## 概要

`Threads`は、Meta Threadsへ投稿するためのクライアントクラスです。Threads Graph APIを使用してテキスト投稿、画像・動画付き投稿、カルーセル投稿などを行います。アクセストークンの自動更新機能も実装しています。

## 機能

- ✅ テキスト投稿
- ✅ シングルメディア投稿（画像・動画）
- ✅ カルーセル投稿（複数メディア）
- ✅ アクセストークンの自動更新
- ✅ アクセストークンのファイル永続化
- ✅ コンテナステータスの監視
- ✅ トークンの有効性チェック

## 使用方法

```javascript
import Threads from './src/Clients/Threads.js';

// 初期化（非同期）
const threadsClient = await Threads.create(accessToken);

// 投稿
await threadsClient.post(text, fileBuffer);

// クリーンアップ（終了時）
threadsClient.destroy();
```

## 静的メソッド

### create(accessToken)

Threadsクライアントを初期化します。

**処理内容:**
1. 保存されたトークンを読み込む（なければ引数のトークンを使用）
2. トークンの有効性をチェック
3. トークンの有効期限が30日以内の場合、自動更新
4. ユーザーIDを取得
5. 自動更新タイマーを開始

**パラメータ:**
- `accessToken` (string): Threads User Access Token

**戻り値:**
- `Promise<Threads | false>`: 初期化されたクライアント、または失敗時は`false`

### getTokenInfo(accessToken)

アクセストークンの情報を取得します。

**パラメータ:**
- `accessToken` (string): アクセストークン

**戻り値:**
```javascript
{
  is_valid: boolean,    // トークンが有効かどうか
  expires_at: number,   // 有効期限（Unixタイムスタンプ）
  // その他のトークン情報...
}
```

### getRefreshToken(accessToken)

アクセストークンを更新します。

**パラメータ:**
- `accessToken` (string): 現在のアクセストークン

**戻り値:**
```javascript
{
  access_token: string,  // 新しいアクセストークン
  token_type: string,    // トークンタイプ
  expires_at: number     // 有効期限（ミリ秒）
}
```

エラー時は`undefined`を返します。

### getUserId(accessToken)

ユーザーIDを取得します。

**パラメータ:**
- `accessToken` (string): アクセストークン

**戻り値:**
- `Promise<string | undefined>`: ユーザーID

### saveAuth(authData, filePath?)

認証情報をファイルに保存します。

**パラメータ:**
- `authData` (object): 認証データ
- `filePath` (string, optional): 保存先パス（デフォルト: `./threads_auth.json`）

### loadAuth(filePath?)

認証情報をファイルから読み込みます。

**パラメータ:**
- `filePath` (string, optional): 読み込み元パス（デフォルト: `./threads_auth.json`）

**戻り値:**
- `Promise<string | undefined>`: アクセストークン

## インスタンスメソッド

### post(text, fileBuffer)

Threadsに投稿します。メディアの有無と数に応じて適切な投稿方法を選択します。

**投稿タイプ:**
1. メディアなし → テキスト投稿
2. メディア1つ → シングルメディア投稿
3. メディア複数 → カルーセル投稿

**パラメータ:**
- `text` (string): 投稿本文
- `fileBuffer` (Array): メディアファイルの配列

**fileBufferの形式:**
```javascript
Array<{
  url: string,      // メディアファイルのURL
  type: string      // MIMEタイプ
}>
```

**注意:** 
- ThreadsはメディアURLを直接指定する必要があります（バッファではなく）
- メディアは公開アクセス可能なURLである必要があります

### createContainer(data)

投稿コンテナを作成します。

**パラメータ例:**
```javascript
// テキストのみ
{ media_type: 'TEXT', text: 'Hello World' }

// 画像
{ media_type: 'IMAGE', image_url: 'https://...', text: 'Caption' }

// 動画
{ media_type: 'VIDEO', video_url: 'https://...', text: 'Caption' }

// カルーセルアイテム
{ is_carousel_item: true, media_type: 'IMAGE', image_url: 'https://...' }

// カルーセル
{ media_type: 'CAROUSEL', children: [id1, id2, ...], text: 'Caption' }
```

**戻り値:**
- `Promise<string>`: コンテナID

### getContainerStatus(id)

コンテナのステータスを確認します。

**パラメータ:**
- `id` (string): コンテナID

**戻り値:**
- `Promise<boolean>`: コンテナが公開可能かどうか（`PUBLISHED`または`FINISHED`）

### publishContainer(containerId)

コンテナを公開（投稿）します。

**パラメータ:**
- `containerId` (string): コンテナID

### startNextRefreshTokenTimer(expires_at_ms)

次回のトークン更新タイマーを開始します。

**機能:**
- 有効期限の30日前にトークンを自動更新
- タイマーの最大値（約24.8日）を超えないように調整
- 更新失敗時は1時間後に再試行

**パラメータ:**
- `expires_at_ms` (number): トークンの有効期限（ミリ秒）

### destroy()

クリーンアップを行います。タイマーをクリアします。

**使用例:**
```javascript
// アプリケーション終了時
threadsClient.destroy();
```

## 投稿の流れ

### テキストのみ

1. `createContainer({ media_type: 'TEXT', text })` → コンテナID取得
2. `getContainerStatus(containerId)` → `true`になるまで待機（1秒間隔）
3. `publishContainer(containerId)` → 投稿

### シングルメディア（画像）

1. `createContainer({ media_type: 'IMAGE', image_url, text })` → コンテナID取得
2. `getContainerStatus(containerId)` → `true`になるまで待機（1秒間隔）
3. `publishContainer(containerId)` → 投稿

### シングルメディア（動画）

1. `createContainer({ media_type: 'VIDEO', video_url, text })` → コンテナID取得
2. `getContainerStatus(containerId)` → `true`になるまで待機（35秒間隔）
   - 動画は処理に時間がかかるため待機時間が長い
3. `publishContainer(containerId)` → 投稿

### カルーセル（複数メディア）

1. 各メディアのコンテナを作成（`is_carousel_item: true`）
2. すべてのアイテムのステータスが`true`になるまで待機（10秒間隔）
3. カルーセルコンテナを作成（`media_type: 'CAROUSEL', children`）
4. カルーセルコンテナのステータスが`true`になるまで待機（5秒間隔）
5. `publishContainer(containerId)` → 投稿

## アクセストークンの自動更新

Threads User Access Tokenは有効期限があるため、自動更新機能が実装されています。

**更新タイミング:**
- トークンの有効期限が30日以内になったとき
- クライアント初期化時にチェック
- バックグラウンドタイマーで定期的にチェック

**永続化:**
- 更新されたトークンは`threads_auth.json`に自動保存
- 次回起動時に保存されたトークンを自動読み込み

**注意事項:**
- タイマーの最大値（約24.8日）を考慮した実装
- 更新失敗時は1時間後に再試行
- アプリケーション終了時は`destroy()`でタイマーをクリア

## Graph APIのバージョン

```javascript
static graphApiVersion = 'v1.0';
static BASE_URL = `https://graph.threads.net/${Threads.graphApiVersion}/`;
```

## 依存関係

- `axios` - HTTP リクエスト
- `fs/promises` - ファイル読み書き（トークン保存）

## 使用例

```javascript
import Threads from './src/Clients/Threads.js';

// 初期化
const threadsClient = await Threads.create(
  process.env.THREADS_ACCESS_TOKEN
);

if (!threadsClient) {
  console.error('Threadsクライアントの初期化に失敗しました');
  process.exit(1);
}

// テキストのみ投稿
await threadsClient.post('こんにちは！', []);

// 画像付き投稿
const mediaFiles = [
  { url: 'https://example.com/image.jpg', type: 'image/jpeg' }
];
await threadsClient.post('画像付き投稿', mediaFiles);

// カルーセル投稿
const carouselFiles = [
  { url: 'https://example.com/image1.jpg', type: 'image/jpeg' },
  { url: 'https://example.com/image2.jpg', type: 'image/jpeg' },
  { url: 'https://example.com/video.mp4', type: 'video/mp4' }
];
await threadsClient.post('カルーセル投稿', carouselFiles);

// アプリケーション終了時
threadsClient.destroy();
```

## エラーハンドリング

- すべてのエラーはコンソールに出力されます
- トークンが無効な場合、`create()`は`false`を返します
- ユーザーIDの取得に失敗した場合、`create()`は`false`を返します
- 投稿に失敗してもエラーをスローせず、ログに記録します

## 注意事項

- Threads User Access Tokenの取得には公開アカウントが必要です
- 発行後に非公開にしても問題ありません
- メディアは公開アクセス可能なURLである必要があります
- 動画の処理には時間がかかります（最大35秒待機）
- カルーセルの処理にも時間がかかります
- センシティブコンテンツのフラグ設定はサポートされていません
- アクセストークンは`threads_auth.json`に保存されます（.gitignoreに追加推奨）
- ThreadsクライアントはIFTTTを使用しません。直接APIを利用します。
  ※IFTTT Proアカウントが必要なのはTwitterクライアントのみです。
