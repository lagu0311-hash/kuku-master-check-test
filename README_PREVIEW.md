# 九九マスターチェック：v1.4 水彩ご褒美・実機確認用サイト

**状態：本番公開ではありません。** 元のv1.3 GitHub Pagesには手を加えません。

## このパックの用途

- 新しい公開GitHubリポジトリに `docs/` を配置し、Settings → Pages → Deploy from a branch → `main` → `/docs` に設定する。
- 公開された `https://<owner>.github.io/<repo>/review.html` をiPhone/Android Chromeで開き、作品1〜4／開放1〜4マス／演出3段階を確認する。
- `https://<owner>.github.io/<repo>/` で、実際の九九アプリv1.4開発版を確認する。

## 保存領域の安全対策

GitHub Pagesの別リポジトリでも `https://<owner>.github.io` の同一originに保存領域が共有されるため、プレビュー用アプリの保存キーを `kuku-master-check-preview:v4` に変更し、旧保存キーの削除対象を空にした。元の `kuku-master-check:v4` およびv1〜v3は一切操作しない。

`review.html` の人工テストデータの投入先も同じプレビュー専用キー。元の学習データをプレビューから自動取得しない。

## 出所と変更多寡

基準GitHubコミット：`b17223d30d540dbd242d1f755695a7edf0990897`（2026-11-09、開発・未公開）。
基準ファイル `docs/` に対して、変更は `docs/app.js`（プレビュー用storageキー、旧キー削除対象の無効化、レビュー直リンク）と `docs/index.html`（開発中の見分けがつく表示）の2件。追加は `docs/review.html` と `docs/review-fixtures.js` の2件。原画4枚・本体の報酬ロジックは無変更。

## 公開上の注意

GitHub PagesのURLと静的ファイルは一般公開される。写真4枚・人工データ・公開ソース以外の個人情報や学習実績を置かない。実機確認に成功しても本番v1.4の公開承認を意味しない。
