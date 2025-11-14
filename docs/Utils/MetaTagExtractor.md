# MetaTagExtractor - OGP / Twitter Card / メタ情報抽出

## 概要

`MetaTagExtractor`は、`open-graph-scraper`の制限を克服するために作成された、より堅牢なメタ情報抽出クラスです。
axios と cheerio を使用して、任意のWebページからメタデータを抽出します。

## 機能

- ✅ Open Graph（`og:*`）の抽出
- ✅ Twitter Card（`twitter:*`）の抽出
- ✅ `<title>` タグの抽出
- ✅ `<meta name="description">` / `<meta name="keywords">` の抽出
- ✅ 画像URLを配列で取得（`og:image`, `twitter:image` など）
- ✅ 画像URLの重複除去
- ✅ カスタマイズ可能な HTTP オプション（timeout、headers など）

## 使用方法

```javascript
import MetaTagExtractor from './src/Utils/MetaTagExtractor.js';

const extractor = new MetaTagExtractor();

// 基本的な使用法
const meta = await extractor.extractMeta('https://example.com');
console.log(meta.title);        // ページタイトル
console.log(meta.description);  // 説明文
console.log(meta.og.image);     // OGP画像URL
console.log(meta.images);       // すべての画像URLの配列

// カスタムオプション付き
const metaWithOptions = await extractor.extractMeta('https://example.com', {
  timeout: 15000,
  headers: {
    'User-Agent': 'MyCustomBot/1.0'
  }
});
```

## 出力形式

```javascript
{
  title: "ページタイトル",
  description: "ページの説明",
  keywords: "キーワード1, キーワード2",
  og: {
    title: "OGPタイトル",
    description: "OGP説明",
    image: "https://example.com/image.jpg",
    url: "https://example.com",
    // ... その他のOGPプロパティ
  },
  twitter: {
    card: "summary_large_image",
    image: "https://example.com/twitter-image.jpg",
    // ... その他のTwitter Cardプロパティ
  },
  images: [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ]
}
```

## OgImage.js との統合

`OgImage.js` は内部で `MetaTagExtractor` を使用するように更新されました。
既存のAPIはすべて互換性を保っているため、変更は透過的です。

### 主な変更点

- `open-graph-scraper` から `MetaTagExtractor` への移行
- Amazon URL の特別処理を維持
- エラーハンドリングの改善（失敗時は Google Favicon API にフォールバック）

## 依存関係

- `axios` - HTTP リクエスト
- `cheerio` - HTML パース（新規追加）

## 注意事項

- Node.js 環境でのみ動作します（ブラウザ環境では CORS により取得不可）
- 一部のサイトは User-Agent やその他のヘッダーをチェックする場合があります
- ネットワークエラーやタイムアウトに対する適切なエラーハンドリングが実装されています
