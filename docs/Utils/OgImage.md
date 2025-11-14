# OgImage - OGP画像取得ユーティリティ

## 概要

`OgImage`は、WebページからOGP（Open Graph Protocol）画像を取得し、各SNSプラットフォームで使用できる形式に処理するための静的クラスです。Concrntのhyperproxy summaryサービスや`MetaTagExtractor`を使用してメタ情報を取得し、特定のサービス（Amazon等）に対する特別な処理も実装しています。

## 機能

- ✅ OGP画像の取得と最適化
- ✅ Concrnt hyperproxy summaryサービスとの統合
- ✅ `MetaTagExtractor`によるフォールバック
- ✅ Amazon URLの特別処理（商品画像の最適化）
- ✅ Google Favicon APIによるフォールバック
- ✅ 画像のリサイズと圧縮（最大800px幅）
- ✅ ページタイトルと説明文の取得

## 使用方法

```javascript
import OgImage from './src/Utils/OgImage.js';

// 基本的な使用法
const ogData = await OgImage.getOgImage('https://example.com');

// Concrntクライアントと連携
const ogData = await OgImage.getOgImage('https://example.com', ccClient);
```

## メソッド

### getOgImage(url, ccClient?)

URLからOGP画像とメタ情報を取得します。

**パラメータ:**
- `url` (string): 対象のURL
- `ccClient` (optional): Concrntクライアントインスタンス

**戻り値:**
```javascript
{
  imageUrl: string,        // 画像のURL
  type: "image/jpeg",      // MIMEタイプ
  url: string,             // 元のURL
  description: string,     // ページの説明
  title: string,           // ページのタイトル
  uint8Array: Uint8Array   // 画像データ
}
```

エラー時は`undefined`を返します。

### getImage(ogImageUrl)

OGP画像をダウンロードして最適化します。

**処理内容:**
- 最大幅: 800px
- 縦横比を維持
- 拡大しない（元画像より小さい場合はそのまま）
- JPEG形式に変換
- 品質: 80%
- プログレッシブJPEG

**パラメータ:**
- `ogImageUrl` (string): 画像のURL

**戻り値:**
- `Promise<Buffer>`: 処理後の画像バッファ

エラー時は`undefined`を返します。

### getOgp(url, ccClient?)

URLからOGP情報を取得します。複数のソースを試行します。

**取得優先順位:**
1. Concrnt hyperproxy summaryサービス（ccClientが提供されている場合）
2. `MetaTagExtractor`によるメタ情報取得
3. Google Favicon API（フォールバック）

**パラメータ:**
- `url` (string): 対象のURL
- `ccClient` (optional): Concrntクライアントインスタンス

**戻り値:**
```javascript
{
  ogImageUrl: string,   // OGP画像のURL
  title: string,        // ページタイトル
  description: string   // ページの説明
}
```

## Amazon URL特別処理

### containsAmazonShortURL(text)

テキストにAmazonの短縮URLが含まれているかチェックします。

**対応ドメイン:**
- a.co
- amzn.to
- amzn.asia
- amzn.eu
- amazon.co.jp

### isAmazonPrimeVideoURL(text)

Amazon Prime VideoのURLかどうかをチェックします。

### findTargetAmazonImageFromMeta(meta)

Amazonの商品ページから最適な商品画像URLを生成します。

**処理内容:**
1. `https://m.media-amazon.com/images/I/`で始まる画像を検索
2. `_SX`または`_SY`パラメータを含む画像を選択
3. 画像IDを抽出
4. 最適化されたURL形式に変換（900x850サイズ）

**例:**
```javascript
// 元のURL
https://m.media-amazon.com/images/I/51Di4bc19jL.__AC_SX300_SY300_QL70_ML2_.jpg

// 変換後のURL
https://m.media-amazon.com/images/I/51Di4bc19jL.jpg_BO30,255,255,255_UF900,850_SR1910,1000,0,AmazonEmber,50,4,0,0_QL100_.jpg
```

## Concrnt hyperproxy summaryサービスとの統合

Concrntクライアントが提供され、`world.concrnt.hyperproxy.summary`サービスが利用可能な場合、そのサービスを使用してOGP情報を取得します。

**動作:**
1. サムネイル画像があれば使用
2. faviconが.ico形式の場合、Google Favicon APIを使用
3. それ以外の場合、iconを使用

## Google Favicon API

他の方法でOGP画像を取得できなかった場合、Google Favicon APIを使用してfaviconを取得します。

```javascript
const GOOGLE_FAVICON_URL = "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=256&url="
```

## 依存関係

- `sharp` - 画像処理
- `axios` - HTTP リクエスト
- `MetaTagExtractor` - メタ情報抽出

## 使用例

```javascript
// Blueskyへの投稿でOGP画像を使用
const urls = ['https://example.com/article'];
const ogImage = await OgImage.getOgImage(urls[0], ccClient);

if (ogImage) {
  // OGP画像をBlueskyにアップロード
  const uploadedImage = await bskyClient.uploadBlob(
    ogImage.uint8Array,
    ogImage.type
  );
  
  // 投稿に埋め込み
  record.embed = {
    $type: 'app.bsky.embed.external',
    external: {
      uri: ogImage.url,
      title: ogImage.title,
      description: ogImage.description,
      thumb: uploadedImage.data.blob
    }
  };
}
```

## エラーハンドリング

- すべてのメソッドはエラーをコンソールに出力
- `getOgImage`と`getImage`はエラー時に`undefined`を返す
- `getOgp`は失敗時にGoogle Favicon APIにフォールバック
- ネットワークエラーやタイムアウトに対応

## 注意事項

- 画像のダウンロードに時間がかかる場合があります
- Amazon URLの特別処理は日本のAmazon (amazon.co.jp) を想定しています
- Google Favicon APIは公開APIですが、利用規約を確認してください
- 一部のWebサイトはUser-Agentやクローラーをブロックする場合があります
