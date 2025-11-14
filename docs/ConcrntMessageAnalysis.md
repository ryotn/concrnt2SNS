# ConcrntMessageAnalysis - Concrntメッセージ解析ユーティリティ

## 概要

`ConcrntMessageAnalysis`は、Concrntのメッセージ（Markdown形式）を解析し、プレーンテキスト、URL、メディアファイルなどを抽出するためのクラスです。Concrntから他のSNSへ投稿する際に必要な情報を取得します。

## 機能

- ✅ Markdown形式のテキストをプレーンテキストに変換
- ✅ カスタム絵文字を標準的な絵文字に置換
- ✅ URLの抽出
- ✅ 画像・動画ファイルの抽出
- ✅ センシティブメディアフラグの検出（`<details>`タグ）
- ✅ 特殊文字の処理（@マークの無効化など）

## 使用方法

```javascript
import CCMsgAnalysis from './src/Utils/ConcrntMessageAnalysis.js';

const ccMsgAnalysis = new CCMsgAnalysis();

// Markdownからプレーンテキストを取得
const plainText = ccMsgAnalysis.getPlaneText(messageBody);

// URLを抽出
const urls = ccMsgAnalysis.getURLs(messageBody);

// メディアファイルを抽出
const mediaFiles = ccMsgAnalysis.getMediaFiles(messageBody);
```

## メソッド

### getPlaneText(body)

Markdown形式のテキストをプレーンテキストに変換します。

- Markdownの装飾を削除
- カスタム絵文字を標準絵文字に変換
- @マークを[@]に変換してリプライを無効化

**パラメータ:**
- `body` (string): Markdown形式のメッセージ本文

**戻り値:**
- `string`: プレーンテキスト

### getURLs(body)

メッセージ本文からURLを抽出します。

**パラメータ:**
- `body` (string): メッセージ本文

**戻り値:**
- `Array<string>`: 抽出されたURLの配列

### getMediaFiles(body)

メッセージ本文から画像・動画ファイルの情報を抽出します。

**パラメータ:**
- `body` (string): メッセージ本文

**戻り値:**
```javascript
Array<{
  url: string,      // メディアファイルのURL
  type: string,     // "image" または "video"
  flag?: string     // センシティブメディアフラグ（porn, hard, nude, warn など）
}>
```

## センシティブメディアの処理

Concrntでは`<details>`タグでメディアをラップすることでセンシティブメディアとしてマークできます。`<summary>`タグのテキストがフラグとして使用されます。

```markdown
<details>
<summary>porn</summary>
![画像](https://example.com/image.jpg)
</details>
```

上記の例では、画像に`flag: "porn"`が付与されます。

## String拡張機能

このクラスは`String.prototype`を拡張して以下のメソッドを追加します：

### removeMarkdown()

Markdown形式のテキストからMarkdown記法を削除します。

### replaceEmojis()

カスタム絵文字（`:emoji_name:`形式）を標準絵文字に変換します。変換マップは`emojiMap.json`で定義されています。

### replaceSpecialCharacter()

@マークを[@]に変換して、Twitterなどでのリプライを無効化します。

## 正規表現パターン

- `CC_IMG_PATTERN`: Markdown画像記法にマッチ
- `CC_VIDEO_PATTERN`: HTMLビデオタグにマッチ
- `CC_DETAILS_PATTERN`: HTMLのdetailsタグにマッチ
- `CC_SUMMARY_PATTERN`: HTMLのsummaryタグにマッチ
- `CC_URL_PATTERN`: URLにマッチ

## 依存関係

- `fs/promises` - emojiMap.jsonの読み込み

## 注意事項

- `emojiMap.json`ファイルが必要です
- String.prototypeを拡張するため、他のコードに影響を与える可能性があります
- センシティブメディアフラグは自由記入形式です（porn, hard, nude, warn など）
