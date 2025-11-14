# Media - メディアファイル処理ユーティリティ

## 概要

`Media`は、画像や動画ファイルをダウンロードし、各SNSプラットフォームの要件に合わせて処理するためのクラスです。画像のリサイズ・圧縮、動画の解析、アスペクト比の計算などを行います。

## 機能

- ✅ 画像・動画ファイルのダウンロード
- ✅ 画像の自動リサイズと最適化（最大2048px幅）
- ✅ 画像の圧縮（976KB以下に調整）
- ✅ 動画の解像度取得（MP4Box使用）
- ✅ アスペクト比の計算
- ✅ センシティブメディアフラグの保持
- ✅ 複数ファイルの並列処理

## 使用方法

```javascript
import Media from './src/Utils/Media.js';

const media = new Media();

// メディアファイルの情報配列
const files = [
  { url: 'https://example.com/image.jpg', type: 'image', flag: undefined },
  { url: 'https://example.com/video.mp4', type: 'video', flag: 'warn' }
];

// ダウンロードと処理
const processedMedia = await media.downloader(files);
```

## メソッド

### downloader(files)

メディアファイルをダウンロードし、処理します。

**パラメータ:**
```javascript
Array<{
  url: string,      // メディアファイルのURL
  type: string,     // "image" または "video"
  flag?: string     // センシティブメディアフラグ（オプション）
}>
```

**戻り値:**
```javascript
Array<{
  url: string,           // 元のURL
  buffer: Buffer,        // ファイルのバッファ
  uint8Array: Uint8Array,// Uint8Array形式のデータ
  type: string,          // MIMEタイプ（"image/jpeg" または "video/mp4"）
  flag?: string,         // センシティブメディアフラグ
  aspectRatio: {         // アスペクト比
    width: number,
    height: number
  }
}>
```

### resize(arrayBuffer)

画像をリサイズし、ファイルサイズを976KB以下に圧縮します。

**処理内容:**
- 最大幅: 2048px
- ファイルサイズ: 976KB以下
- 形式: JPEG
- クロマサブサンプリング: 4:4:4
- EXIF情報: 保持

**パラメータ:**
- `arrayBuffer` (ArrayBuffer): 画像データ

**戻り値:**
```javascript
{
  img: Buffer,           // 処理後の画像バッファ
  aspectRatio: {         // アスペクト比
    width: number,
    height: number
  }
}
```

### getVideoResolution(arrayBuffer)

動画ファイルから解像度（幅と高さ）を取得します。

**対応コーデック:**
- H.264 (avc)
- H.265/HEVC (hev, hvc1)
- MPEG-4 Visual (mp4v)

**パラメータ:**
- `arrayBuffer` (ArrayBuffer): 動画データ

**戻り値:**
```javascript
Promise<{
  width: number,   // 動画の幅（ピクセル）
  height: number   // 動画の高さ（ピクセル）
}>
```

エラー時や解像度が取得できない場合は`{ width: 0, height: 0 }`を返します。

### getAspectRatio(width, height)

幅と高さからアスペクト比を計算します（最大公約数で約分）。

**パラメータ:**
- `width` (number): 幅
- `height` (number): 高さ

**戻り値:**
```javascript
{
  width: number,   // アスペクト比の幅
  height: number   // アスペクト比の高さ
}
```

無効な値（0やundefined）の場合は`{ width: 1, height: 1 }`を返します。

## 画像処理の詳細

### リサイズアルゴリズム

1. 画像を最大幅2048pxにリサイズ
2. 品質100%でJPEG変換
3. ファイルサイズが976KB以上の場合、品質を5%ずつ下げて再変換
4. 976KB以下になるまで繰り返し

### 画像形式

- 出力形式: JPEG
- クロマサブサンプリング: 4:4:4（最高品質）
- EXIF情報: 保持

## 動画処理の詳細

### MP4Boxによる解析

MP4Boxライブラリを使用して動画ファイルのメタデータを解析し、解像度を取得します。

### エラーハンドリング

- 動画トラックが見つからない場合: `{ width: 0, height: 0 }`
- エラー発生時: `{ width: 0, height: 0 }`
- ログにエラー内容を出力

## 依存関係

- `sharp` - 画像処理
- `mp4box` - 動画メタデータ解析

## 使用例

```javascript
const media = new Media();

// 画像とビデオを含むメディアファイル
const files = [
  {
    url: 'https://example.com/photo.jpg',
    type: 'image',
    flag: undefined
  },
  {
    url: 'https://example.com/video.mp4',
    type: 'video',
    flag: 'warn'
  }
];

const processedMedia = await media.downloader(files);

// 処理後のデータを使用
processedMedia.forEach(media => {
  console.log(`URL: ${media.url}`);
  console.log(`Type: ${media.type}`);
  console.log(`Aspect Ratio: ${media.aspectRatio.width}:${media.aspectRatio.height}`);
  console.log(`Buffer Size: ${media.buffer.length} bytes`);
});
```

## 注意事項

- 大きな画像ファイルの処理には時間がかかる場合があります
- 動画ファイルは解像度の取得のみで、変換は行いません
- ファイルサイズ制限（976KB）はTwitterのAPI制限に基づいています
- 無効な画像/動画ファイルはエラーをスローします
