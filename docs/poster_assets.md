# Coffee Poster Assets

このディレクトリには、研究室コーヒー販売ポスターの **GitHub 公開向け素材** を配置しています。公開版では、支払い用の PayPay QR コードは公開せず、**ダミー表示** に置き換えています。

| 項目 | 内容 |
| --- | --- |
| 公開版ポスター画像 | `poster_public_github_safe.png` |
| 公開版ポスターPDF | `poster_public_github_safe.pdf` |
| 生成スクリプト | `../scripts/generate_coffee_poster.py` |
| 実利用版ポスター | リポジトリ外で生成・保管 |

実利用版ポスターには、研究室掲示向けの実際の PayPay QR コードを配置します。ただし、秘匿情報を含むため、このリポジトリには含めません。

## 再生成方法

リポジトリのルートで次のコマンドを実行してください。

```bash
python3.11 scripts/generate_coffee_poster.py
```

このスクリプトは、GitHub公開版のポスターを `docs/` に生成し、実利用版のポスターをリポジトリ外のローカル出力先に生成します。
