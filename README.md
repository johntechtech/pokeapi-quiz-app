# PokeAPI ポケモンクイズ

PokeAPIを使った日本語のポケモンクイズアプリです。キッズ、大人、博士、トレーナー、シルエットTAの5種類のルートで遊べます。

## 機能

- ルート別のポケモン当てクイズ
- 難易度・レベル別の初期表示とヒント
- 文字入力による回答
- ヒント数に応じたスコア計算
- シルエットTAのタイム計測とペナルティ
- ブラウザ内ランキング保存
- 結果シェア画像の生成
- PokeAPIレスポンスのブラウザキャッシュ
- GitHub Pages向けのActionsデプロイ設定

## 開発

```bash
npm.cmd install
npm.cmd run dev
```

開発サーバーは `http://localhost:5182/` で起動します。

## ビルド

```bash
npm.cmd run build
```

## 公開

GitHubのリポジトリ設定で Pages の Source を `GitHub Actions` に変更すると、`main` ブランチへのpushで `.github/workflows/deploy.yml` が `dist` を公開します。

## データ

ポケモンのデータは [PokeAPI](https://pokeapi.co/docs/v2) を利用しています。PokeAPIのFair Use Policyに合わせ、取得したJSONはブラウザのlocalStorageにキャッシュします。

## モバイル受け入れ条件

- iPhone SE系（例: 375x667）で、クイズ回答中に縦スクロールなしでシルエット画像全体が表示されること。
- 390x844系（例: iPhone 12/13/14）で、クイズ回答中に縦スクロールなしでシルエット画像全体が表示されること。
