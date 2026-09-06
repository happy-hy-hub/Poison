import { Platform } from "react-native";

/**
 * Web（PWA）でだけ必要な CSS を差し込む。
 *
 * iOS Safari は長押しでテキスト選択と「コピー / 調べる」のメニューを出す。
 * このアプリの中心の操作が長押しなので、そのままだと**消す操作のたびに
 * コピーメニューが割り込む**。アプリ全体で選択と callout を切って回避する。
 *
 * 入力欄だけは例外にする。書いた本文を選んだり直したりできなくなると困るため。
 *
 * ネイティブ版にはこの問題が無いので、何もしない。
 */
const CSS = `
  html, body, #root {
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
    overscroll-behavior: none;
  }

  /* 長押しの拡大鏡とドラッグでの画像保存も抑える */
  #root * {
    -webkit-touch-callout: none;
  }

  /* 入力中の本文だけは選べるようにする */
  input, textarea, [contenteditable="true"] {
    -webkit-user-select: text;
    user-select: text;
    -webkit-touch-callout: default;
  }

  /* ダブルタップの拡大を止める。長押し判定が安定する */
  #root {
    touch-action: manipulation;
  }
`;

export const installWebStyles = (): void => {
  if (Platform.OS !== "web") return;
  if (typeof document === "undefined") return;
  if (document.getElementById("ash-web-styles")) return;

  const style = document.createElement("style");
  style.id = "ash-web-styles";
  style.textContent = CSS;
  document.head.appendChild(style);
};
