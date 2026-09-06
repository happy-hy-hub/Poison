# ASH（仮称）

書いたものを1枚の白い紙として開き、長押しで燃やして消すメモ。

いやな出来事を頭の中で反芻し続けるのをやめるために、外に書き出す。
そして自分の手で燃やして終わらせる。溜めるためではなく、**消すため**のメモ帳。

- 仕様: [docs/requirements.md](docs/requirements.md)
- 画面モック: `design/*.dc.html`

---

## 配る・使う

### Web（PWA）— 誰でも無料

`master` に push すると GitHub Actions が自動で公開する。

**https://happy-hy-hub.github.io/Poison/**

iPhone なら Safari で開き、共有ボタンから「ホーム画面に追加」。アイコンが並び、
Safari の枠が消えて全画面で起動する。一度開けばオフラインでも動く。

書いた内容は**その端末のブラウザの中だけ**に保存され、どこにも送信されない。

**Web版の制約**

| | |
|---|---|
| 触覚（振動） | **使えない。** iOS Safari は振動APIに対応していない。回避策も無い |
| 暗号化 | 無し。localStorage に平文で入る |
| ロック | 無し（生体認証もセキュアストレージも使えないため設定ごと隠している） |
| 保存の永続性 | ブラウザのサイトデータを消すと内容も消える |

炎と操作は本来のまま動く。**失われるのは指に返る手応えだけ**だが、このアプリでは
それが小さくない。手触りまで含めて見せたいならネイティブ版が要る。

### ネイティブ（iOS / Android）

Expo Go では動かない。`@shopify/react-native-skia`（炎）と SQLCipher（暗号化）が
Expo Go に含まれていないため、**開発ビルド**が要る。

```bash
cd app && eas build --profile development --platform android
```

ビルドはクラウドで走るので Mac は不要。ただし **iOS 実機に入れるには Apple Developer
Program（年額）が要る**。これは Apple の制約で、どのフレームワークでも変わらない。
Android は無料で入れられる。

---

## 開発

```bash
cd app && npm install
```

| コマンド | すること |
|---|---|
| `npm run typecheck` | 型チェック。端末なしで通る。**まずこれ** |
| `npx expo-doctor` | 依存関係の健康診断 |
| `npm run build:web` | PWA を `app/dist/` に組み立てる |
| `npm run icons` | PWA アイコンを生成し直す（依存ライブラリなしの自前PNG生成） |
| `npx expo start` | 開発サーバー。Expo Go では炎と暗号化が動かない |

### 構造

```
docs/                        要件定義
design/                      画面モック（.dc.html）
.github/workflows/           PWA の自動デプロイ
app/
  index.ts                   入口。Web では CanvasKit を読んでから起動する
  App.tsx                    ナビゲーションとロックの門番
  public/                    PWA の素材（manifest・アイコン）
  scripts/
    build-web.mjs            PWA の組み立て（.nojekyll・head・Service Worker）
    make-icons.mjs           アイコン生成
  src/
    theme.ts                 配色・書体・余白（色の直書きはここだけ）
    haptics.ts               触覚。Web では丸ごと無効化する
    db/
      database.native.ts     iOS/Android。expo-sqlite（開発ビルドでは SQLCipher）
      database.web.ts        Web。localStorage
      database.ts            型解決のための入口。実行時には読まれない
    components/
      Paper.tsx              1枚の紙（閲覧と編集で共用）
      ui.tsx                 設定画面の共通部品
    purge/
      types.ts               演出のインターフェースとフェーズ定義
      registry.ts            消し方の登録簿
      PurgeSurface.tsx       消去の骨格（状態遷移・ゲージ・触覚・削除の実行）
      skiaRuntime.ts         Skia の実行時読み込み。無ければ代替表示へ落とす
      effects/burn.tsx       既定の消し方「燃やす」
    screens/                 S-01〜S-07
```

### 消去まわりの約束

消し方は後から足せる。**演出に許すのは描画と文言だけで、消去の実行は渡さない。**

- 削除のコミットは `db/database.*` の `commitPurge` だけが行う。演出からは呼べない
- 演出の `paint()` が例外を投げても削除は成立する。コアが素のフェードに切り替えるだけ
- ゲージ・触覚・所要時間はコアが持つ。新しい演出が操作の可読性を壊せないようにするため
- 設定に保存するのは演出の**id（文字列）**。知らないidなら既定で動かし、保存値は書き換えない

演出を1つ足す手順:

1. `app/src/purge/effects/` に `PurgeEffect` の実装を1ファイル追加する
2. `app/src/purge/registry.ts` の `ALL` に1行足す

これだけでよい。削除処理・画面・設定画面・DBには触れない。

### プラットフォーム分岐の作法

Metro は `.native.ts` / `.web.ts` を優先して解決する。**TypeScript はこれを解決できない**
ので、型のためだけに `database.ts` を置いている（実行時には読まれない）。
両実装のインターフェースは必ず一致させること。片方だけに関数を足すと、型は通るのに
片方のプラットフォームで落ちる。

---

## まだ無いもの

- **PINの設定フロー。** 照合はするが登録画面が無い。PIN未登録の端末では生体認証のみ
- 一覧からのスワイプ消去
- 一括消去
- 効果音（設定のトグルはあるが鳴らす実装が無い）
- テスト一式
- 「燃やす」以外の消し方（溶かす／破る／流す）
- 同梱フォント。いまは端末の既定書体（`google_fonts` 相当の動的読み込みは
  通信しない方針に反するので使わない）

## Web 固有の対処

- **iOS の長押しメニュー。** Safari は長押しでテキスト選択と「コピー」の吹き出しを出すため、
  中心の操作である長押しと衝突する。`src/webStyles.ts` でアプリ全体の選択と callout を
  切っている（入力欄だけ例外）。ネイティブ版にこの問題は無い

## 確認できていないこと

- **触覚以外の Web 動作は公開URLで確認済み**（起動・CanvasKit の読み込み・
  Service Worker の登録とキャッシュ生成）。オフライン起動は iPhone を機内モードにして要確認
- **触覚の効き方。** チャージ中は 90ms → 24ms と間隔を詰めるが、iOS は短間隔の連続
  impact を間引く。狙った感触にならない場合は Core Haptics を使うネイティブモジュールが要る
- **炎のフレームレート。** いまは JS スレッドの `requestAnimationFrame` で駆動している。
  落ちるようなら worklet 化して UI スレッドへ移す（`burn.tsx` の `paint` は純粋関数なので移せる）
