/**
 * ==============================================================================
 * Geminiプロンプト不可視化スクリプト (content.js) - 完成版
 * * 機能:
 * 1. プロンプト入力欄への入力をリアルタイムで不可視化します。
 * 2. ページ上のチャット履歴に含まれる、ユーザーが送信したプロンプトも不可視化します。
 * ==============================================================================
 */

// --- 設定項目 ---
// GeminiのUI要素のセレクタを定義します。
// 将来、Geminiのウェブサイトがアップデートされると、これらのセレクタは変更される可能性があります。

// [1] プロンプト入力欄のセレクタ
const INPUT_AREA_SELECTOR = 'rich-textarea';

// [2] 履歴内の、ユーザーが送信した各プロンプトのテキスト行のセレクタ
// ★ユーザー様からご提供いただいた最終的な情報に基づいて、この行を更新しました。
const USER_HISTORY_SELECTOR = '.query-text-line';


// --- メイン処理 ---

/**
 * 指定された要素のテキストを不可視化する関数
 * @param {HTMLElement} element 対象のHTML要素
 */
const hideElementText = (element) => {
  // すでに処理済みの場合は何もしない
  if (element.dataset.isTextHidden === 'true') {
    return;
  }
  // テキストを●で隠すスタイルを適用
  element.style.webkitTextSecurity = 'disc';
  // 処理済みであることを示す目印を付けて、二重処理を防ぐ
  element.dataset.isTextHidden = 'true';
};

/**
 * ページ上のすべてのユーザー履歴を検索し、不可視化する関数
 */
const hideAllHistoryPrompts = () => {
  const historyElements = document.querySelectorAll(USER_HISTORY_SELECTOR);
  historyElements.forEach(hideElementText);
};

/**
 * プロンプト入力欄を検索し、入力時にリアルタイムで不可視化するリスナーを設定する関数
 */
const setupInputAreaListener = () => {
  const inputArea = document.querySelector(INPUT_AREA_SELECTOR);
  // 入力欄が存在し、まだリスナーが設定されていない場合
  if (inputArea && !inputArea.dataset.listenerAttached) {
    // ユーザーが何かを入力した時に、内容を不可視化する
    inputArea.addEventListener('input', (event) => {
      hideElementText(event.target);
    });
    // リスナーを設定したことを示す目印を付ける
    inputArea.dataset.listenerAttached = 'true';
  }
};


// --- 実行 ---

// ページ上の要素は動的に読み込まれるため、MutationObserverを使ってDOMの変更を監視します。
// これにより、新しいチャット履歴が追加された場合や、ページ遷移した場合にも対応できます。
const observer = new MutationObserver(() => {
  // DOM（ページの構造）に変更があるたびに、両方の不可視化処理を実行
  setupInputAreaListener();
  hideAllHistoryPrompts();
});

// body要素全体とその子孫要素の変更を監視開始
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// ページが最初に読み込まれた時点でも、念のため一度実行
setupInputAreaListener();
hideAllHistoryPrompts();