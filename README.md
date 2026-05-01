# PokeAPI ポケモンクイズ

PokeAPIを使った日本語のポケモンクイズアプリです。キッズ、大人、博士、トレーナーの4種類の難易度で遊べます。

## 機能

- 8問制のポケモン当てクイズ
- 難易度別の初期表示とヒント
- 文字入力による回答
- ヒント数に応じたスコア計算
- ブラウザ内ランキング保存
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
