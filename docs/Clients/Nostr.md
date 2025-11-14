# Nostr - Nostrクライアント

## 概要

`Nostr`は、Nostrプロトコルへ投稿するためのクライアントクラスです。`nostr-tools`ライブラリを使用してイベント（ノート）の作成、署名、複数のリレーサーバーへの配信を行います。

## 機能

- ✅ テキストノートの投稿（kind 1イベント）
- ✅ メディアURL付きノートの投稿
- ✅ 複数リレーへの同時配信
- ✅ センシティブコンテンツ警告（content-warningタグ）
- ✅ イベントの署名（finalizeEvent）
- ✅ 配信結果の確認

## 使用方法

```javascript
import Nostr from './src/Clients/Nostr.js';

// 初期化
const nostrClient = new Nostr(
  'wss://relay1.com,wss://relay2.com,wss://relay3.com',
  'nsec1...'  // Nostrプライベートキー（nsec形式）
);

// 投稿
await nostrClient.post(text, fileBuffer);
```

## コンストラクタ

```javascript
new Nostr(relays, privateKey)
```

**パラメータ:**
- `relays` (string): リレーサーバーのURLをカンマ区切りで指定
  - 例: `'wss://relay.damus.io,wss://relay.nostr.band'`
- `privateKey` (string): Nostrプライベートキー（nsec形式）
  - 例: `'nsec1...'`

**処理:**
- プライベートキーを`nip19.decode()`で秘密鍵バイトに変換
- リレーのURLをカンマで分割して配列化

## メソッド

### post(text, fileBuffer)

Nostrにノート（kind 1イベント）を投稿します。

**パラメータ:**
- `text` (string): ノートの本文
- `fileBuffer` (Array): メディアファイルの配列

**fileBufferの形式:**
```javascript
Array<{
  url: string,      // メディアファイルのURL
  flag?: string     // センシティブメディアフラグ（オプション）
}>
```

**投稿内容:**
- 本文テキスト
- メディアURLを本文に追加（改行で区切られる）
- センシティブフラグがある場合、`content-warning`タグを追加

**処理の流れ:**
1. メディアファイルからフラグを収集
2. フラグがある場合、`content-warning`タグを作成
3. 本文にメディアURLを追加
4. イベントテンプレートを作成（kind 1）
5. 秘密鍵でイベントに署名
6. すべてのリレーに同時配信
7. 配信結果を確認

## Nostrイベント

### イベント構造

```javascript
{
  kind: 1,                          // テキストノート
  created_at: Math.floor(Date.now() / 1000),  // Unixタイムスタンプ（秒）
  tags: [
    ["content-warning", "porn,warn"]  // センシティブコンテンツ警告（オプション）
  ],
  content: "本文\nhttps://example.com/image.jpg"  // 本文 + メディアURL
}
```

### イベントの署名

`finalizeEvent()`を使用してイベントに署名します。これにより以下が追加されます：
- `id`: イベントのハッシュID
- `pubkey`: 公開鍵
- `sig`: 署名

## センシティブコンテンツ警告

Nostrでは`content-warning`タグを使用してセンシティブコンテンツを警告します。

**処理:**
1. メディアファイルからフラグを収集（`flag`プロパティ）
2. フラグをカンマ区切りで連結（例: `"porn,warn"`）
3. `["content-warning", flags]`タグをイベントに追加

**注意:**
- フラグが1つでもある場合、投稿全体が警告表示になります
- 個別のメディアに対する警告ではなく、投稿全体への警告です

## リレーへの配信

### SimplePoolの使用

`SimplePool`を使用して複数のリレーに同時配信します。

```javascript
const pool = new SimplePool();
const promises = pool.publish(this.relays, signedEvent);
const results = await Promise.allSettled(promises);
```

### 配信結果

`Promise.allSettled()`を使用して、各リレーへの配信結果を確認します。

**成功時:** `{ status: 'fulfilled', value: ... }`
**失敗時:** `{ status: 'rejected', reason: ... }`

失敗したリレーはコンソールにエラーログが出力されます。

### クリーンアップ

配信後、`pool.destroy()`でリソースを解放します。

## NIPs（Nostr Implementation Possibilities）

このクライアントは以下のNIPsを実装しています：

- **NIP-01**: 基本プロトコル（kind 1イベント）
- **NIP-19**: nsec形式の秘密鍵のエンコード/デコード
- **NIP-36**: センシティブコンテンツ警告（content-warningタグ）

## 依存関係

- `nostr-tools/pure` - イベントの署名
- `nostr-tools/nip19` - nsec形式の秘密鍵デコード
- `nostr-tools/pool` - リレープール

## 使用例

```javascript
import Nostr from './src/Clients/Nostr.js';

// 初期化
const nostrClient = new Nostr(
  process.env.NOSTR_RELAYS,        // 'wss://relay1.com,wss://relay2.com'
  process.env.NOSTR_PRIVATE_KEY    // 'nsec1...'
);

// テキストのみ投稿
await nostrClient.post('こんにちは、Nostr！', []);

// メディア付き投稿
const mediaFiles = [
  { url: 'https://example.com/image.jpg', flag: undefined }
];
await nostrClient.post('画像付き投稿', mediaFiles);

// センシティブコンテンツ付き投稿
const sensitiveFiles = [
  { url: 'https://example.com/image.jpg', flag: 'porn' },
  { url: 'https://example.com/image2.jpg', flag: 'warn' }
];
await nostrClient.post('センシティブな画像', sensitiveFiles);
// → content-warning タグ: "porn,warn"
```

## エラーハンドリング

- リレーへの配信失敗は個別にログ出力されます
- 一部のリレーが失敗しても、他のリレーへの配信は継続されます
- プライベートキーのデコードに失敗した場合、エラーがスローされます

## セキュリティ

- プライベートキー（nsec）は安全に管理してください
- 環境変数（`.env`ファイル）に保存することを推奨します
- `.env`ファイルは`.gitignore`に追加してください

## リレーの選択

### 推奨リレー

```
wss://relay.damus.io
wss://relay.nostr.band
wss://nos.lol
wss://relay.snort.social
wss://nostr.wine
```

### 日本語リレー

```
wss://relay-jp.nostr.wirednet.jp
wss://nostr.holybea.com
```

### リレーの設定例

```env
NOSTR_RELAYS="wss://relay.damus.io,wss://relay.nostr.band,wss://nos.lol"
```

## 注意事項

- Nostrアカウント（keypair）が必要です
- プライベートキーは必ず`nsec`形式で指定してください
- メディアは公開アクセス可能なURLである必要があります
- Nostr自体にはメディアアップロード機能はありません（URLのみ）
- リレーによっては接続できない場合があります
- 複数のリレーを指定することで配信の確実性が向上します
- センシティブコンテンツ警告は投稿全体に適用されます（メディア個別ではない）
- Nostrは分散型プロトコルのため、削除や編集は困難です
