/**
 * ==============================================================================
 * Kokushi Maker - content.js
 * 
 * 機能:
 * 1. Geminiプロンプトの不可視化 (既存機能)
 * 2. インタラクティブな問題Viewerの起動 (新規機能・改10)
 * ==============================================================================
 */

// --- 設定項目 ---
const INPUT_AREA_SELECTOR = 'rich-textarea';
const USER_HISTORY_SELECTOR = '.query-text-line';
const MODEL_RESPONSE_SELECTOR = '.model-response-text'; // Geminiの回答コンテナ


// --- 機能1: プロンプト不可視化 (既存機能) ---

const hideElementText = (element) => {
  if (element.dataset.isTextHidden === 'true') return;
  element.style.webkitTextSecurity = 'disc';
  element.dataset.isTextHidden = 'true';
};

const hideAllHistoryPrompts = () => {
  document.querySelectorAll(USER_HISTORY_SELECTOR).forEach(hideElementText);
};

const setupInputAreaListener = () => {
  const inputArea = document.querySelector(INPUT_AREA_SELECTOR);
  if (inputArea && !inputArea.dataset.listenerAttached) {
    inputArea.addEventListener('input', (event) => hideElementText(event.target));
    inputArea.dataset.listenerAttached = 'true';
  }
};


/**
 * ==============================================================================
 * 機能2: インタラクティブ問題Viewer (改10)
 * ==============================================================================
 */

const PROCESSED_MARKER = 'data-interactive-quiz-processed';

// テキストを解析して問題データを抽出する関数
function parseQuizText(text) {
  try {
    const normalizedText = text.replace(/\r\n|\r/g, '\n');
    const parts = normalizedText.split(/解答[・と]解説/);
    if (parts.length < 2) {
        console.error('[Quiz Parser] Failed to split by "解答・解説".');
        return null;
    }

    const problemPart = parts[0];
    const solutionPart = parts[1];

    const casePresentation = problemPart.split(/\n?\s*問1/)[0].trim();

    const problemSplits = problemPart.split(/\n?\s*問[1-9][0-9]?/).slice(1);
    const solutionSplits = solutionPart.split(/\n?\s*問[1-9][0-9]?/).slice(1);

    if (problemSplits.length === 0) {
        console.error('[Quiz Parser] No problem blocks found after splitting by "問X".');
        return null;
    }
    if (solutionSplits.length === 0 || problemSplits.length !== solutionSplits.length) {
        console.error('[Quiz Parser] Mismatch between problem and solution block counts.', {problems: problemSplits.length, solutions: solutionSplits.length});
        return null;
    }

    const problems = problemSplits.map((problemBlock, index) => {
        if (!problemBlock) return null;
        const questionNumber = index + 1;
        
        const lines = problemBlock.trim().split('\n');
        const questionText = lines[0].trim();
        const choicesText = lines.slice(1).join(' '); // 全てを一行に結合

        const choices = {};
        // ★修正点: ラベルを区切り文字として、後続のテキストを抽出する方式に変更
        const choiceRegex = /([a-eａ-ｅ])\s*[.．]?\s*(.*?)(?=\s*[a-eａ-ｅ]\s*[.．]?\s*|$)/g;
        const matches = choicesText.matchAll(choiceRegex);

        for (const match of matches) {
            const label = match[1].normalize('NFKC').toLowerCase().replace(/[ａ-ｅ]/, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
            choices[label] = match[2].trim();
        }

        const solutionBlock = solutionSplits[index];
        if (!solutionBlock) return null;

        const correctRegex = /(?:解答|正解)[:：]\s*([a-eａ-ｅ])/;
        const explanationRegex = /解説[:：]?\s*\n?([\s\S]+)/;
        
        const correctMatch = solutionBlock.match(correctRegex);
        const explanationMatch = solutionBlock.match(explanationRegex);

        if (Object.keys(choices).length === 0) {
            console.error(`[Quiz Parser - 問${questionNumber}] No choices found. Text was:`, `'${choicesText}'`);
            return null;
        }
        if (!correctMatch) {
            console.error(`[Quiz Parser - 問${questionNumber}] Correct answer not found.`);
            return null;
        }

        const correctAnswerLabel = correctMatch[1].normalize('NFKC').toLowerCase().replace(/[ａ-ｅ]/, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));

        return {
            questionNumber,
            questionText,
            choices,
            correctAnswer: correctAnswerLabel,
            explanation: explanationMatch ? explanationMatch[1].trim() : ''
        };
    }).filter(p => p !== null);

    if (problems.length === 0) {
        console.error('[Quiz Parser] No valid problems could be parsed.');
        return null;
    }

    return { casePresentation, problems };

  } catch (error) {
    console.error('[Quiz Parser] An unexpected error occurred:', error);
    return null;
  }
}

// 抽出したデータからUIを構築する関数
function buildQuizUI(quizData, originalContainer) {
    const originalContent = originalContainer.innerHTML;
    const quizContainer = document.createElement('div');
    quizContainer.className = 'interactive-quiz-container';

    const stopViewerBtn = document.createElement('button');
    stopViewerBtn.textContent = 'Viewerを停止';
    stopViewerBtn.className = 'stop-viewer-btn';
    stopViewerBtn.onclick = () => {
        originalContainer.innerHTML = originalContent;
        originalContainer.removeAttribute(PROCESSED_MARKER);
    };
    quizContainer.appendChild(stopViewerBtn);

    if (quizData.casePresentation) {
        const caseElem = document.createElement('div');
        caseElem.className = 'quiz-case-presentation';
        caseElem.innerHTML = quizData.casePresentation.replace(/\n/g, '<br>');
        quizContainer.appendChild(caseElem);
    }

    quizData.problems.forEach(problem => {
        const problemContainer = document.createElement('div');
        problemContainer.className = 'problem-container';

        const qText = document.createElement('h3');
        qText.textContent = `問${problem.questionNumber} ${problem.questionText}`;
        problemContainer.appendChild(qText);

        const choicesContainer = document.createElement('div');
        choicesContainer.className = 'choices-container';

        Object.entries(problem.choices).forEach(([label, text]) => {
            const button = document.createElement('button');
            button.className = 'choice-button';
            button.innerHTML = `<span class="choice-label">${label}</span> ${text}`;
            button.dataset.label = label;

            button.addEventListener('click', (e) => {
                const clickedButton = e.currentTarget;
                const isCorrect = clickedButton.dataset.label === problem.correctAnswer;

                if (isCorrect) {
                    clickedButton.classList.add('correct');
                } else {
                    clickedButton.classList.add('incorrect');
                    const correctButton = choicesContainer.querySelector(`[data-label="${problem.correctAnswer}"]`);
                    if (correctButton) {
                        correctButton.classList.add('correct');
                    }
                }

                choicesContainer.querySelectorAll('.choice-button').forEach(btn => {
                    btn.disabled = true;
                });

                explanationElem.style.display = 'block';
            });
            choicesContainer.appendChild(button);
        });
        problemContainer.appendChild(choicesContainer);

        const memoTextarea = document.createElement('textarea');
        memoTextarea.placeholder = '解答の根拠やメモを記録...';
        memoTextarea.className = 'memo-textarea';
        problemContainer.appendChild(memoTextarea);

        const explanationElem = document.createElement('div');
        explanationElem.className = 'explanation-container';
        explanationElem.style.display = 'none';
        explanationElem.innerHTML = `<h4>解説</h4><p>${problem.explanation.replace(/\n/g, '<br>')}</p>`;
        problemContainer.appendChild(explanationElem);

        quizContainer.appendChild(problemContainer);
    });

    originalContainer.innerHTML = '';
    originalContainer.appendChild(quizContainer);
}

// UIのスタイルをページに注入する関数
function injectStyles() {
    const styleId = 'interactive-quiz-styles';
    if (document.getElementById(styleId)) return;

    const checkIconSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2328a745' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'%3E%3C/polyline%3E%3C/svg%3E")`;
    const xIconSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23dc3545' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cline x1='18' y1='6' x2='6' y2='18'%3E%3C/line%3E%3Cline x1='6' y1='6' x2='18' y2='18'%3E%3C/line%3E%3C/svg%3E")`;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
    :root {
        --card-bg: #ffffff;
        --body-bg: #f4f6f8;
        --text-color: #212529;
        --subtle-text: #6c757d;
        --border-color: #dee2e6;
        --accent-color: #007bff;
        --correct-bg: #f0fff0;
        --correct-border: #28a745;
        --incorrect-bg: #fff0f0;
        --incorrect-border: #dc3545;
    }
    .interactive-quiz-container { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans JP', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
        color: var(--text-color);
        background-color: var(--body-bg);
        padding: 24px;
        border-radius: 12px;
    }
    .stop-viewer-btn {
        background-color: #6c757d;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 20px;
        cursor: pointer;
        margin-bottom: 24px;
        font-weight: 500;
        transition: background-color 0.2s ease;
    }
    .stop-viewer-btn:hover { background-color: #5a6268; }
    .quiz-case-presentation, .problem-container {
        background: var(--card-bg);
        border-radius: 12px;
        padding: 24px;
        margin-bottom: 24px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        border: 1px solid var(--border-color);
    }
    .problem-container h3 {
        font-size: 1.2em;
        margin-top: 0;
        margin-bottom: 20px;
        line-height: 1.5;
    }
    .choices-container { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
    .choice-button {
        display: flex; align-items: center; width: 100%; padding: 12px 16px;
        font-size: 1em; text-align: left; color: var(--text-color);
        background-color: var(--card-bg);
        border: 1px solid var(--border-color);
        border-radius: 8px; cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
    }
    .choice-button:hover:not(:disabled) { 
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        border-color: var(--accent-color);
    }
    .choice-button:disabled { cursor: not-allowed; opacity: 0.9; }
    .choice-label { 
        flex-shrink: 0; font-weight: bold; margin-right: 16px; 
        width: 28px; height: 28px; display: grid; place-items: center;
        background-color: var(--body-bg); border-radius: 50%;
    }
    .choice-button.correct, .choice-button.incorrect {
        position: relative;
        padding-right: 40px;
    }
    .choice-button.correct::after, .choice-button.incorrect::after {
        content: '';
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        width: 24px;
        height: 24px;
        background-size: contain;
    }
    .choice-button.correct { background-color: var(--correct-bg); border-color: var(--correct-border); }
    .choice-button.correct::after { background-image: ${checkIconSvg}; }
    .choice-button.incorrect { background-color: var(--incorrect-bg); border-color: var(--incorrect-border); }
    .choice-button.incorrect::after { background-image: ${xIconSvg}; }
    .memo-textarea { 
        width: 100%; box-sizing: border-box; min-height: 70px; padding: 12px;
        border: 1px solid var(--border-color); border-radius: 8px; 
        font-family: inherit; font-size: 0.95em; line-height: 1.6;
        margin-bottom: 20px; 
    }
    .explanation-container {
        background-color: #f5f7fa; 
        border-left: 4px solid var(--accent-color);
        border-radius: 0 8px 8px 0;
        padding: 20px;
        line-height: 1.7;
    }
    .explanation-container h4 { margin-top: 0; color: var(--accent-color); }
  `;
    document.head.appendChild(style);
}

// Viewerを起動するメイン関数
function activateViewer() {
    const responseElements = document.querySelectorAll(MODEL_RESPONSE_SELECTOR);
    if (responseElements.length === 0) {
        return { status: "error", message: "回答が見つかりません。" };
    }

    const latestResponseElement = responseElements[responseElements.length - 1];

    if (latestResponseElement.hasAttribute(PROCESSED_MARKER)) {
        return { status: "error", message: "既にViewer化されています。" };
    }

    const quizData = parseQuizText(latestResponseElement.innerText);

    if (quizData) {
        buildQuizUI(quizData, latestResponseElement);
        latestResponseElement.setAttribute(PROCESSED_MARKER, 'true');
        return { status: "success" };
    } else {
        return { status: "error", message: "クイズ形式の回答ではありません。" };
    }
}


// --- 実行 & イベント待受 ---

injectStyles();

const observer = new MutationObserver(() => {
  setupInputAreaListener();
  hideAllHistoryPrompts();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "activateViewer") {
        const result = activateViewer();
        sendResponse(result);
    }
    return true;
});

setupInputAreaListener();
hideAllHistoryPrompts();