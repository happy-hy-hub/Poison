/**
 * 型解決のための入口。
 *
 * 実体はプラットフォームごとに分かれている。
 *
 *   database.native.ts … iOS / Android。expo-sqlite（開発ビルドでは SQLCipher）
 *   database.web.ts    … Web（PWA）。localStorage
 *
 * Metro は `.native.ts` / `.web.ts` を優先して解決するため、**このファイルが
 * 実行時に読み込まれることはない**。TypeScript がプラットフォーム拡張子を
 * 解決できないので、型のためだけに置いている。
 *
 * 両実装のインターフェースは完全に一致させること。片方だけに関数を足すと、
 * ここでは通っても片方のプラットフォームで落ちる。
 */
export * from "./database.native";
