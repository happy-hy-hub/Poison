# ASH（仮称）

書いたものを1枚の白い紙として開き、長押しで燃やして消すオフラインのメモアプリ。

- 仕様: [docs/requirements.md](docs/requirements.md)
- 画面モック: `design/`（デザインキャンバスとして公開済み）
- アプリ本体: `app/`（React Native + Expo SDK 57）

Flutter で書いた版は git の `bc00abc` と `_backup/` に残してある。Windows から iPhone 実機を
触れないという制約のため、React Native + Expo へ移した。

---

## 構造

```
docs/                      要件定義
design/                    画面モック（.dc.html）
app/
  App.tsx                  入口。ナビゲーションとロックの門番
  src/
    theme.ts               配色・書体・余白（色の直書きはここだけ）
    navigation.ts          画面の型
    db/
      database.ts          expo-sqlite。entries / purge_stats / settings
    components/
      Paper.tsx            1枚の紙（閲覧と編集で共用）
      ui.tsx               設定画面の行など共通部品
    purge/
      types.ts             演出のインターフェースとフェーズ定義
      registry.ts          消し方の登録簿
      PurgeSurface.tsx     消去の骨格（状態遷移・ゲージ・触覚・削除の実行）
      effects/
        burn.tsx           既定の消し方「燃やす」（Skia）
    screens/               S-01〜S-07
```

### 消去まわりの約束

消し方は後から足せる。**演出に許すのは描画と文言だけで、消去の実行は渡さない。**

- 削除のコミットは `db/database.ts` の `commitPurge` だけが行う。演出からは呼べない
- 演出の `paint()` が例外を投げても削除は成立する。コアが素のフェードに切り替えるだけ
- ゲージ・触覚・所要時間はコアが持つ。新しい演出が操作の可読性を壊せないようにするため
- 設定に保存するのは演出の**id（文字列）**。知らないidなら既定で動かし、保存値は書き換えない

演出を1つ足す手順:

1. `app/src/purge/effects/` に `PurgeEffect` の実装を1ファイル追加する
2. `app/src/purge/registry.ts` の `ALL` に1行足す

これだけでよい。削除処理・画面・設定画面・DBには触れない。

---

## 動かす

```bash
cd app
npm install
```

### 型チェックと健康診断

```bash
npx tsc --noEmit
```

```bash
npx expo-doctor
```

この2つは端末なしで通る。**実機で動かす前に必ずここを通すこと。**

### 実機で動かす

**Expo Go だけでは動かない。** このアプリは Expo Go に同梱されていないネイティブモジュールを
2つ使っている。

| モジュール | 用途 | Expo Go |
|---|---|---|
| `@shopify/react-native-skia` | 燃焼演出の描画 | 含まれない |
| `expo-sqlite` の SQLCipher | 保存内容の暗号化 | 含まれない（暗号化なしなら動く） |

したがって **開発ビルド（development build）** が要る。ビルドは EAS のクラウドで行うので
**Mac は不要**だが、iOS 実機に入れるには **Apple Developer Program（年約1.5万円）** が要る。
これは Apple 側の制約で、Flutter でも React Native でも変わらない。

```bash
npm install -g eas-cli
```

```bash
eas login
```

```bash
eas build --profile development --platform ios
```

ビルドが終わると QR が出るので、iPhone で読み取ってインストールする。以降は

```bash
npx expo start --dev-client
```

で JS の変更がホットリロードされる。**ネイティブ依存を足したときだけビルドし直せばよい。**

### Android で確認する場合

Android は無料で実機に入れられる（Apple のような登録が要らない）。手元に Android 端末が
あるなら、演出の詰めはそちらのほうが安上がりで速い。

```bash
eas build --profile development --platform android
```

---

## まだ無いもの

- **PINの設定フロー。** `LockScreen` はPINの照合はするが、登録する画面がまだ無い。
  PIN未登録の端末では生体認証のみで解除される
- 一覧からのスワイプ消去
- 一括消去
- 効果音（設定のトグルはあるが鳴らす実装が無い）
- テスト一式
- 「燃やす」以外の消し方（溶かす／破る／流す）
- 同梱フォント。いまは端末の既定書体。モックと同じにするなら expo-font で
  Zen Kaku Gothic New / IBM Plex Mono を同梱する（Google Fonts の動的読み込みは
  通信しない要件に反するので使わない）

## 既知の注意点

- **触覚**: チャージ中は 90ms → 24ms と間隔を詰めて振動を打つが、iOS は短間隔の連続 impact を
  間引く。狙った感触にならない場合は Core Haptics を使うネイティブモジュールが必要になる。
  実機で確認するまで判断できない
- **描画のスレッド**: 燃焼演出はいま JS スレッドの `requestAnimationFrame` で駆動している。
  フレーム落ちするようなら worklet 化して UI スレッドへ移す（`burn.tsx` の `paint` は
  純粋関数なので移せる作りにしてある）
- **Expo Go で起動した場合**、`db/database.ts` の `isExpoGo` が真になり暗号化を行わない。
  設定画面に警告を出している。**この状態で配布しないこと**
