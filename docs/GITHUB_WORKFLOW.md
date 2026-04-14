# GitHub Workflow & Automation Guide

このドキュメントは、Lab Coffee Ticket Appの開発フローとGitHub自動化スクリプトの使用方法を説明します。

## 開発フロー

本プロジェクトでは、以下のワークフローに従って開発を進めます：

```
Issue作成 → ブランチ作成 → 実装・テスト → PR作成 → レビュー・マージ
```

### ステップ1: Issue作成

新しい機能やバグ修正を開始する際は、まずGitHub Issueを作成します。

```bash
./scripts/github-automation.sh issue "機能名" "詳細な説明" "ラベル"
```

**例：**
```bash
./scripts/github-automation.sh issue "ユーザー認証機能の追加" "OAuth認証フローを実装する" "feature"
```

### ステップ2: ブランチ作成

Issue番号を含むブランチを自動作成します。ブランチ名の形式は `feature/issue-XXX-機能名` です。

```bash
./scripts/github-automation.sh branch <issue_number> "機能名"
```

**例：**
```bash
./scripts/github-automation.sh branch 42 "ユーザー認証機能"
```

このコマンドは以下の処理を自動実行します：
- ローカルブランチを作成
- リモートリポジトリにプッシュ
- 新しいブランチにチェックアウト

### ステップ3: 実装・テスト

ブランチ上で機能を実装し、テストを追加します。

```bash
# 機能を実装
# テストを追加
pnpm test

# 変更をコミット
git commit -m "Implement feature for issue #42"

# 変更をプッシュ
git push
```

### ステップ4: PR作成

実装が完了したら、Pull Requestを作成します。

```bash
./scripts/github-automation.sh pr "feature/issue-42-ユーザー認証機能" 42
```

PRは自動的にIssueにリンクされ、マージ時にIssueが自動的にクローズされます。

### ステップ5: レビュー・マージ

- チームメンバーがPRをレビュー
- 必要に応じて変更を加える
- 承認後、mainブランチにマージ

## スクリプト使用方法

### 完全なワークフロー（推奨）

Issue作成からPR作成までの一連の処理を自動実行します：

```bash
./scripts/github-automation.sh workflow "機能名" "詳細な説明" "ラベル"
```

**例：**
```bash
./scripts/github-automation.sh workflow "QRコードスキャン機能" "QRコードを使用したチケット利用機能を実装する" "feature"
```

このコマンドは以下を自動実行します：
1. Issueを作成
2. Issue番号を取得
3. 次のステップを表示

### 個別コマンド

各ステップを個別に実行することも可能です：

#### Issue作成
```bash
./scripts/github-automation.sh issue "タイトル" "説明" [ラベル]
```

#### ブランチ作成
```bash
./scripts/github-automation.sh branch <issue_number> "機能名"
```

#### PR作成
```bash
./scripts/github-automation.sh pr "ブランチ名" <issue_number>
```

#### ヘルプ表示
```bash
./scripts/github-automation.sh help
```

## ブランチ命名規則

ブランチ名は以下の形式に従います：

```
feature/issue-<issue_number>-<feature_name>
```

- `<issue_number>`: GitHub IssueのID（例：42）
- `<feature_name>`: 機能名（小文字、ハイフン区切り、例：user-authentication）

**例：**
- `feature/issue-42-user-authentication`
- `feature/issue-5-qr-code-scanning`
- `feature/issue-10-database-migration`

## コミットメッセージ規則

コミットメッセージは以下の形式に従います：

```
Implement feature for issue #<issue_number>
```

または、より詳細な場合：

```
Implement feature for issue #<issue_number>

- 変更内容1
- 変更内容2
- テストを追加
```

## PR説明テンプレート

PRの説明には以下の情報を含めてください：

```markdown
## 概要
この変更の概要を記述

## 関連Issue
Closes #<issue_number>

## 変更内容
- 変更1
- 変更2

## テスト
- テスト1
- テスト2

## チェックリスト
- [ ] テストが全て合格している
- [ ] ドキュメントを更新した
- [ ] コードレビューを受けた
```

## GitHub CLIのセットアップ

このスクリプトを使用するには、GitHub CLIがインストールされている必要があります。

### インストール

```bash
# macOS
brew install gh

# Ubuntu/Debian
sudo apt-get install gh

# その他のOSについては以下を参照
https://cli.github.com
```

### 認証

```bash
gh auth login
```

対話的なプロンプトに従って、GitHubアカウントで認証してください。

## トラブルシューティング

### エラー: "gh" コマンドが見つからない

GitHub CLIがインストールされていません。上記のインストール手順を参照してください。

### エラー: "Not in a git repository"

スクリプトをプロジェクトのルートディレクトリから実行してください。

### エラー: "Failed to create issue"

GitHub CLIの認証を確認してください：

```bash
gh auth status
```

### エラー: "Failed to create branch"

既に同じ名前のブランチが存在する可能性があります。別の名前を試してください。

## ベストプラクティス

1. **Issue作成時に詳細を記述** - 実装者が理解しやすいように、詳細な説明を記述してください
2. **小さな単位でIssueを分割** - 大きな機能は複数のIssueに分割してください
3. **テストを先に書く** - TDD（Test-Driven Development）を実践してください
4. **定期的にPRをレビュー** - コードの品質を保つため、定期的にレビューしてください
5. **コミットメッセージを明確に** - 変更内容が分かりやすいコミットメッセージを記述してください

## 参考資料

- [GitHub CLI Documentation](https://cli.github.com/manual)
- [GitHub Flow](https://guides.github.com/introduction/flow/)
- [Conventional Commits](https://www.conventionalcommits.org/)
