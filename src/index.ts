import { Hono } from "hono";
import { cors } from "hono/cors";
import { PDFDocument, degrees } from "pdf-lib";

// 型定義（Cloudflare Workers標準の型を使用）
type Bindings = {
	pdf_editor_files: R2Bucket; // ログの表示名に合わせる
	PDF_METADATA: KVNamespace;
};

type Variables = {
	uploadId: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// CORS設定
app.use(
	"*",
	cors({
		origin: "*",
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
	}),
);

// 静的ファイル配信（フロントエンド）
app.get("/", (c) => {
	return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PDF Editor Pro - Cloudflare Edition</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2877828132102103"
          crossorigin="anonymous"
        ></script>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
            }

            .container {
                max-width: 1400px;
                margin: 0 auto;
                padding: 20px;
            }

            .header {
                text-align: center;
                color: white;
                margin-bottom: 40px;
            }

            .header h1 {
                font-size: 3rem;
                margin-bottom: 15px;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                background: linear-gradient(45deg, #fff, #f0f8ff);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }

            .header p {
                font-size: 1.3rem;
                opacity: 0.95;
                margin-bottom: 20px;
            }

            .badge {
                display: inline-block;
                background: rgba(255,255,255,0.25);
                padding: 8px 20px;
                border-radius: 25px;
                font-size: 0.95rem;
                margin: 8px;
                backdrop-filter: blur(15px);
                border: 1px solid rgba(255,255,255,0.2);
                transition: all 0.3s ease;
            }

            .badge:hover {
                background: rgba(255,255,255,0.35);
                transform: translateY(-2px);
            }

            .main-content {
                background: white;
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.15);
                overflow: hidden;
                backdrop-filter: blur(10px);
            }

            .tab-container {
                display: flex;
                background: linear-gradient(135deg, #f8f9fa, #e9ecef);
                border-bottom: 1px solid #dee2e6;
            }

            .tab {
                flex: 1;
                padding: 20px;
                background: none;
                border: none;
                cursor: pointer;
                font-size: 1.1rem;
                font-weight: 600;
                transition: all 0.3s ease;
                color: #6c757d;
                position: relative;
            }

            .tab.active {
                background: white;
                color: #495057;
                border-bottom: 4px solid #667eea;
                box-shadow: 0 -2px 10px rgba(102, 126, 234, 0.1);
            }

            .tab:hover:not(.active) {
                background: rgba(102, 126, 234, 0.1);
                color: #495057;
            }

            .tab:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .tab-content {
                padding: 40px;
                display: none;
                min-height: 600px;
            }

            .tab-content.active {
                display: block;
            }

            .upload-area {
                border: 3px dashed #667eea;
                border-radius: 15px;
                padding: 60px;
                text-align: center;
                margin-bottom: 30px;
                transition: all 0.4s ease;
                background: linear-gradient(135deg, #f8f9ff, #e7f3ff);
                position: relative;
                overflow: hidden;
            }

            .upload-area::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: radial-gradient(circle, rgba(102, 126, 234, 0.05) 0%, transparent 70%);
                transform: scale(0);
                transition: transform 0.6s ease;
            }

            .upload-area:hover::before {
                transform: scale(1);
            }

            .upload-area:hover {
                border-color: #5a6fd8;
                background: linear-gradient(135deg, #f0f3ff, #dae8ff);
                transform: translateY(-5px);
                box-shadow: 0 15px 40px rgba(102, 126, 234, 0.2);
            }

            .upload-area.dragover {
                border-color: #4c63d2;
                background: linear-gradient(135deg, #e8f0ff, #d1e7ff);
                transform: scale(1.05);
                box-shadow: 0 20px 50px rgba(102, 126, 234, 0.3);
            }

            .upload-icon {
                font-size: 4rem;
                color: #667eea;
                margin-bottom: 20px;
                animation: float 3s ease-in-out infinite;
            }

            @keyframes float {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-10px); }
            }

            .file-input {
                display: none;
            }

            .upload-btn {
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                border: none;
                padding: 15px 40px;
                border-radius: 30px;
                cursor: pointer;
                font-size: 1.1rem;
                font-weight: 600;
                transition: all 0.3s ease;
                margin: 15px;
                box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
            }

            .upload-btn:hover {
                background: linear-gradient(135deg, #5a6fd8, #6a4c93);
                transform: translateY(-3px);
                box-shadow: 0 12px 35px rgba(102, 126, 234, 0.4);
            }

            .form-group {
                margin-bottom: 25px;
            }

            .form-group label {
                display: block;
                margin-bottom: 10px;
                font-weight: 600;
                color: #495057;
                font-size: 1.1rem;
            }

            .form-control {
                width: 100%;
                padding: 15px 20px;
                border: 2px solid #e9ecef;
                border-radius: 12px;
                font-size: 1rem;
                transition: all 0.3s ease;
                background: #fff;
            }

            .form-control:focus {
                outline: none;
                border-color: #667eea;
                box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
                background: #f8f9ff;
            }

            .btn {
                background: linear-gradient(135deg, #28a745, #20c997);
                color: white;
                border: none;
                padding: 15px 30px;
                border-radius: 10px;
                cursor: pointer;
                font-size: 1rem;
                font-weight: 600;
                transition: all 0.3s ease;
                margin-right: 15px;
                box-shadow: 0 6px 20px rgba(40, 167, 69, 0.3);
            }

            .btn:hover {
                background: linear-gradient(135deg, #218838, #1ea080);
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(40, 167, 69, 0.4);
            }

            .btn:disabled {
                background: #6c757d;
                cursor: not-allowed;
                transform: none;
                box-shadow: none;
                opacity: 0.6;
            }

            .info-box {
                background: linear-gradient(135deg, #e7f3ff, #f0f8ff);
                border: 2px solid #b6d7ff;
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 25px;
                color: #0c5460;
                border-left: 6px solid #17a2b8;
            }

            .success-box {
                background: linear-gradient(135deg, #d4edda, #e8f5e8);
                border: 2px solid #c3e6cb;
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 25px;
                color: #155724;
                border-left: 6px solid #28a745;
            }

            .error-box {
                background: linear-gradient(135deg, #f8d7da, #fce4e6);
                border: 2px solid #f5c6cb;
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 25px;
                color: #721c24;
                border-left: 6px solid #dc3545;
            }

            .pdf-preview-container {
                display: grid;
                grid-template-columns: 1fr 300px;
                gap: 30px;
                margin: 30px 0;
            }

            .pdf-viewer {
                background: #f8f9fa;
                border-radius: 12px;
                padding: 20px;
                min-height: 500px;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 2px dashed #dee2e6;
            }

            .page-controls {
                background: white;
                border-radius: 12px;
                padding: 20px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            }

            .page-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                gap: 20px;
                margin: 25px 0;
            }

            .page-item {
                border: 3px solid #e9ecef;
                border-radius: 12px;
                padding: 20px;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s ease;
                background: linear-gradient(135deg, #fff, #f8f9fa);
                position: relative;
                overflow: hidden;
            }

            .page-item::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
                opacity: 0;
                transition: opacity 0.3s ease;
            }

            .page-item:hover::before {
                opacity: 1;
            }

            .page-item:hover {
                border-color: #667eea;
                background: #f8f9ff;
                transform: translateY(-5px);
                box-shadow: 0 10px 30px rgba(102, 126, 234, 0.2);
            }

            .page-item.selected {
                border-color: #667eea;
                background: linear-gradient(135deg, #e7f3ff, #f0f8ff);
                box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
            }

            .page-item.rotated {
                background: linear-gradient(135deg, #fff3cd, #fef7e0);
                border-color: #ffc107;
            }

            .page-number {
                font-weight: 700;
                margin-bottom: 15px;
                font-size: 1.2rem;
                color: #495057;
                position: relative;
                z-index: 1;
            }

            .page-preview {
                width: 80px;
                height: 100px;
                background: #fff;
                border: 1px solid #dee2e6;
                border-radius: 6px;
                margin: 0 auto 15px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 2rem;
                color: #6c757d;
                transition: transform 0.3s ease;
                position: relative;
                z-index: 1;
            }

            .rotation-controls {
                display: flex;
                justify-content: center;
                gap: 10px;
                margin-top: 15px;
                position: relative;
                z-index: 1;
            }

            .rotation-btn {
                background: linear-gradient(135deg, #6c757d, #495057);
                color: white;
                border: none;
                padding: 10px 15px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 1rem;
                font-weight: 600;
                transition: all 0.2s ease;
                box-shadow: 0 3px 10px rgba(108, 117, 125, 0.3);
            }

            .rotation-btn:hover {
                background: linear-gradient(135deg, #5a6268, #343a40);
                transform: scale(1.1);
                box-shadow: 0 5px 15px rgba(108, 117, 125, 0.4);
            }

            .rotation-indicator {
                font-size: 0.9rem;
                margin-top: 8px;
                font-weight: 600;
                color: #667eea;
                position: relative;
                z-index: 1;
            }

            .download-link {
                display: inline-block;
                background: linear-gradient(135deg, #17a2b8, #20c997);
                color: white;
                text-decoration: none;
                padding: 15px 30px;
                border-radius: 10px;
                font-weight: 600;
                transition: all 0.3s ease;
                margin-top: 20px;
                box-shadow: 0 6px 20px rgba(23, 162, 184, 0.3);
            }

            .download-link:hover {
                background: linear-gradient(135deg, #138496, #1ea080);
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(23, 162, 184, 0.4);
                color: white;
                text-decoration: none;
            }

            .loading {
                display: none;
                text-align: center;
                padding: 30px;
            }

            .loading.show {
                display: block;
            }

            .spinner {
                border: 4px solid #f3f3f3;
                border-top: 4px solid #667eea;
                border-radius: 50%;
                width: 50px;
                height: 50px;
                animation: spin 1s linear infinite;
                margin: 0 auto 20px;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            .help-text {
                font-size: 0.95rem;
                color: #6c757d;
                margin-top: 8px;
                line-height: 1.5;
            }

            .status-indicator {
                position: fixed;
                top: 30px;
                right: 30px;
                padding: 15px 25px;
                border-radius: 12px;
                color: white;
                font-weight: 600;
                z-index: 1000;
                opacity: 0;
                transition: all 0.4s ease;
                box-shadow: 0 8px 25px rgba(0,0,0,0.2);
            }

            .status-indicator.show {
                opacity: 1;
                transform: translateY(0);
            }

            .status-indicator.success {
                background: linear-gradient(135deg, #28a745, #20c997);
            }

            .status-indicator.error {
                background: linear-gradient(135deg, #dc3545, #e74c3c);
            }

            .progress-bar {
                width: 100%;
                height: 8px;
                background: #e9ecef;
                border-radius: 10px;
                overflow: hidden;
                margin: 20px 0;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
            }

            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #667eea, #764ba2);
                border-radius: 10px;
                transition: width 0.4s ease;
                width: 0%;
                box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
            }

            /* キーボードナビゲーション */
            .page-item:focus {
                outline: 3px solid #667eea;
                outline-offset: 2px;
            }

            /* レスポンシブ */
            @media (max-width: 768px) {
                .pdf-preview-container {
                    grid-template-columns: 1fr;
                }

                .page-grid {
                    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                    gap: 15px;
                }

                .container {
                    padding: 15px;
                }

                .header h1 {
                    font-size: 2.5rem;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📄 PDF Editor Pro</h1>
                <p>Cloudflare Workers × Honoで動作する次世代PDFエディタ</p>
                <div>
                    <span class="badge">⚡ Edge Computing</span>
                    <span class="badge">🔒 Enterprise Security</span>
                    <span class="badge">🌍 Global CDN</span>
                    <span class="badge">🚀 Ultra Fast</span>
                </div>
            </div>

            <div class="main-content">
                <div class="tab-container">
                    <button class="tab active" onclick="switchTab('upload')">📁 アップロード</button>
                    <button class="tab" onclick="switchTab('extract')" id="extractTab" disabled>✂ ページ抽出</button>
                    <button class="tab" onclick="switchTab('rotate')" id="rotateTab" disabled>🔄 ページ回転</button>
                </div>

                <!-- アップロードタブ -->
                <div id="upload-tab" class="tab-content active">
                    <div class="upload-area" id="uploadArea">
                        <div class="upload-icon">☁</div>
                        <h3>PDFファイルをアップロード</h3>
                        <p>ファイルをドラッグ&ドロップするか、クリックして選択してください</p>
                        <button class="upload-btn" onclick="openFileDialog()">
                            📎 ファイルを選択
                        </button>
                        <input type="file" id="fileInput" class="file-input" accept=".pdf" />
                        <div class="help-text">
                            最大ファイルサイズ: 50MB | Cloudflare R2に安全に保存<br>
                            対応形式: PDF | エンタープライズグレードのセキュリティ
                        </div>
                    </div>

                    <div class="progress-bar" id="uploadProgress" style="display: none;">
                        <div class="progress-fill" id="uploadProgressFill"></div>
                    </div>

                    <div id="uploadResult"></div>
                </div>

                <!-- ページ抽出タブ -->
                <div id="extract-tab" class="tab-content">
                    <div class="info-box">
                        <strong>🎯 ページ抽出機能:</strong> 必要なページだけを新しいPDFとして保存<br>
                        <small>🚀 Cloudflare Workers上で高速処理 | 📊 複雑な範囲指定も対応</small>
                    </div>

                    <div class="form-group">
                        <label for="extractPages">📋 抽出するページ番号:</label>
                        <input type="text" id="extractPages" class="form-control"
                               placeholder="例: 1,3,5-7,10-15,20" />
                        <div class="help-text">
                            <strong>入力例:</strong><br>
                            • <code>1,3,5</code> → 1, 3, 5ページ目を抽出<br>
                            • <code>1-5</code> → 1〜5ページ目を抽出<br>
                            • <code>1,3,5-7,10</code> → 1, 3, 5-7, 10ページ目を抽出
                        </div>
                    </div>

                    <button class="btn" onclick="extractPages()" id="extractBtn" disabled>
                        ✂ ページを抽出
                    </button>

                    <div class="loading" id="extractLoading">
                        <div class="spinner"></div>
                        <p>ページを抽出中...</p>
                    </div>

                    <div id="extractResult"></div>
                </div>

                <!-- ページ回転タブ -->
                <div id="rotate-tab" class="tab-content">
                    <div class="info-box">
                        <strong>🔄 ページ回転機能:</strong> 個別のページを90°, 180°, 270°回転<br>
                        <small>⚡ エッジで瞬時に処理 | 🎨 リアルタイムプレビュー付き</small>
                    </div>

                    <div class="pdf-preview-container">
                        <div class="pdf-viewer" id="pdfViewer">
                            <div style="text-align: center; color: #6c757d;">
                                <div style="font-size: 3rem; margin-bottom: 15px;">📄</div>
                                <p>PDFをアップロードするとプレビューが表示されます</p>
                            </div>
                        </div>

                        <div class="page-controls">
                            <h4 style="margin-bottom: 20px; color: #495057;">📋 ページ操作</h4>
                            <div id="pagePreview"></div>
                        </div>
                    </div>

                    <div style="text-align: center; margin-top: 30px;">
                        <button class="btn" onclick="applyRotations()" id="rotateBtn" disabled>
                            🔄 回転を適用
                        </button>
                        <button class="btn" onclick="resetRotations()" style="background: linear-gradient(135deg, #6c757d, #495057);">
                            🔄 リセット
                        </button>
                    </div>

                    <div class="loading" id="rotateLoading">
                        <div class="spinner"></div>
                        <p>ページを回転中...</p>
                    </div>

                    <div id="rotateResult"></div>
                </div>
            </div>
        </div>

        <script>
            let currentUploadId = '';
            let pageCount = 0;
            let rotations = {};
            let selectedPage = null;
            let currentPdfDoc = null;

            // PDF.js初期化
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

            // デバッグ用ファイル選択関数
            function openFileDialog() {
                console.log('openFileDialog called');
                const fileInput = document.getElementById('fileInput');
                console.log('fileInput element:', fileInput);
                if (fileInput) {
                    fileInput.click();
                    console.log('fileInput.click() executed');
                } else {
                    console.error('fileInput element not found');
                }
            }

            // PDFプレビュー生成関数
            async function generatePageThumbnail(pdfDoc, pageNumber, canvasId) {
                try {
                    const page = await pdfDoc.getPage(pageNumber);
                    const viewport = page.getViewport({ scale: 0.3 });

                    const canvas = document.getElementById(canvasId);
                    if (!canvas) return;

                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    const renderContext = {
                        canvasContext: context,
                        viewport: viewport
                    };

                    await page.render(renderContext).promise;
                } catch (error) {
                    console.error('Thumbnail generation failed:', error);
                }
            }

            // タブ切り替え
            function switchTab(tabName) {
                document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

                const tabIndex = tabName === 'upload' ? 1 : tabName === 'extract' ? 2 : 3;
                document.querySelector('.tab:nth-child(' + tabIndex + ')').classList.add('active');
                document.getElementById(tabName + '-tab').classList.add('active');
            }

            // ドラッグ&ドロップ
            const uploadArea = document.getElementById('uploadArea');
            const fileInput = document.getElementById('fileInput');

            // upload-areaクリックでファイル選択を開く
            uploadArea.addEventListener('click', function(e) {
                console.log('uploadArea clicked, target:', e.target.tagName);
                if (e.target.tagName !== 'BUTTON') {
                    openFileDialog();
                }
            });

            // ボタンクリックのデバッグ
            document.addEventListener('DOMContentLoaded', function() {
                const uploadBtn = document.querySelector('.upload-btn');
                if (uploadBtn) {
                    uploadBtn.addEventListener('click', function(e) {
                        console.log('Upload button clicked via event listener');
                        e.preventDefault();
                        openFileDialog();
                    });
                }
            });

            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });

            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    handleFileUpload(files[0]);
                }
            });

            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    handleFileUpload(e.target.files[0]);
                }
            });

            // ファイルアップロード処理
            async function handleFileUpload(file) {
                if (file.type !== 'application/pdf') {
                    showMessage('error', 'PDFファイルを選択してください');
                    return;
                }

                if (file.size > 50 * 1024 * 1024) {
                    showMessage('error', 'ファイルサイズが50MBを超えています');
                    return;
                }

                // PDF.jsでPDFを読み込み
                try {
                    const arrayBuffer = await file.arrayBuffer();
                    currentPdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    console.log('PDF loaded with', currentPdfDoc.numPages, 'pages');
                } catch (error) {
                    console.error('PDF loading failed:', error);
                    showMessage('error', 'PDFファイルの読み込みに失敗しました');
                    return;
                }

                const formData = new FormData();
                formData.append('pdfFile', file);

                try {
                    showProgressBar(true);
                    const response = await fetch('/upload', {
                        method: 'POST',
                        body: formData
                    });

                    const result = await response.json();

                    if (result.success) {
                        currentUploadId = result.uploadId;
                        pageCount = result.pageCount;

                        document.getElementById('uploadResult').innerHTML =
                            '<div class="success-box">' +
                                '<strong>🎉 アップロード成功!</strong><br>' +
                                '<strong>ファイル名:</strong> ' + result.filename + '<br>' +
                                '<strong>総ページ数:</strong> ' + result.pageCount + '<br>' +
                                '<strong>ファイルサイズ:</strong> ' + (file.size / 1024 / 1024).toFixed(2) + ' MB' +
                            '</div>';

                        // タブを有効化
                        document.getElementById('extractTab').disabled = false;
                        document.getElementById('rotateTab').disabled = false;
                        document.getElementById('extractBtn').disabled = false;
                        document.getElementById('rotateBtn').disabled = false;

                        await generatePagePreview();
                        showStatusIndicator('success', '🎉 アップロード完了!');
                    } else {
                        showMessage('error', result.error);
                    }
                } catch (error) {
                    showMessage('error', 'アップロードに失敗しました: ' + error.message);
                } finally {
                    showProgressBar(false);
                }
            }

            // ページプレビュー生成
            async function generatePagePreview() {
                const preview = document.getElementById('pagePreview');
                if (!preview) return;

                let html = '<div class="page-grid">';
                for (let i = 1; i <= pageCount; i++) {
                    html += '<div class="page-item" id="page-' + i + '" tabindex="0"' +
                             ' onclick="selectPage(' + i + ')"' +
                             ' onkeydown="handlePageKeydown(event, ' + i + ')">' +
                            '<div class="page-number">Page ' + i + '</div>' +
                            '<div class="page-preview">' +
                                '<canvas id="canvas-' + i + '" style="max-width: 80px; max-height: 100px; border: 1px solid #dee2e6; border-radius: 6px;"></canvas>' +
                            '</div>' +
                            '<div class="rotation-controls">' +
                                '<button class="rotation-btn" onclick="rotatePage(' + i + ', 90); event.stopPropagation();" title="90°右回転">↻</button>' +
                                '<button class="rotation-btn" onclick="rotatePage(' + i + ', 180); event.stopPropagation();" title="180°回転">↕</button>' +
                                '<button class="rotation-btn" onclick="rotatePage(' + i + ', 270); event.stopPropagation();" title="270°右回転">↺</button>' +
                            '</div>' +
                            '<div class="rotation-indicator" id="rotation-' + i + '">0°</div>' +
                        '</div>';
                }
                html += '</div>';
                preview.innerHTML = html;

                // PDFサムネイル生成
                if (currentPdfDoc) {
                    for (let i = 1; i <= pageCount; i++) {
                        await generatePageThumbnail(currentPdfDoc, i, 'canvas-' + i);
                    }
                }

                // プレビューエリア更新
                updatePDFViewer();
            }

            // ページ選択
            function selectPage(pageNum) {
                // 既存の選択を解除
                document.querySelectorAll('.page-item').forEach(item => {
                    item.classList.remove('selected');
                });

                // 新しい選択
                document.getElementById('page-' + pageNum).classList.add('selected');
                selectedPage = pageNum;

                // プレビュー更新
                updatePDFViewer(pageNum);
            }

            // キーボードナビゲーション
            function handlePageKeydown(event, pageNum) {
                switch(event.key) {
                    case 'ArrowLeft':
                        event.preventDefault();
                        rotatePage(pageNum, 270);
                        break;
                    case 'ArrowRight':
                        event.preventDefault();
                        rotatePage(pageNum, 90);
                        break;
                    case 'ArrowUp':
                        event.preventDefault();
                        rotatePage(pageNum, 180);
                        break;
                    case 'Enter':
                    case ' ':
                        event.preventDefault();
                        selectPage(pageNum);
                        break;
                }
            }

            // ページ回転
            function rotatePage(pageNum, angle) {
                rotations[pageNum] = angle;
                const rotationElement = document.getElementById('rotation-' + pageNum);
                const pageElement = document.getElementById('page-' + pageNum);
                const previewElement = pageElement.querySelector('.page-preview');

                if (rotationElement) {
                    rotationElement.textContent = angle + '°';
                }

                // ビジュアル回転効果
                if (previewElement) {
                    previewElement.style.transform = 'rotate(' + angle + 'deg)';
                }

                // ページアイテムの状態更新
                pageElement.classList.add('rotated');
                pageElement.style.background = 'linear-gradient(135deg, #fff3cd, #fef7e0)';
                pageElement.style.borderColor = '#ffc107';

                // プレビュー更新
                if (selectedPage === pageNum) {
                    updatePDFViewer(pageNum);
                }
            }

            // 回転リセット
            function resetRotations() {
                rotations = {};
                document.querySelectorAll('.page-item').forEach((item, index) => {
                    const pageNum = index + 1;
                    const rotationElement = document.getElementById('rotation-' + pageNum);
                    const previewElement = item.querySelector('.page-preview');

                    if (rotationElement) {
                        rotationElement.textContent = '0°';
                    }

                    if (previewElement) {
                        previewElement.style.transform = 'rotate(0deg)';
                    }

                    item.classList.remove('rotated');
                    item.style.background = '';
                    item.style.borderColor = '';
                });

                updatePDFViewer(selectedPage);
                showStatusIndicator('success', '回転設定をリセットしました');
            }

            // PDFビューア更新
            async function updatePDFViewer(pageNum = null) {
                const viewer = document.getElementById('pdfViewer');
                if (!viewer) return;

                if (pageNum && currentPdfDoc) {
                    const rotation = rotations[pageNum] || 0;
                    viewer.innerHTML =
                        '<div style="text-align: center;">' +
                            '<canvas id="main-canvas" style="max-width: 100%; max-height: 400px; border: 2px solid #dee2e6; border-radius: 12px; transform: rotate(' + rotation + 'deg); transition: transform 0.3s ease;"></canvas>' +
                            '<h3 style="color: #495057; margin: 20px 0 10px;">Page ' + pageNum + '</h3>' +
                            '<p style="color: #6c757d;">回転角度: ' + rotation + '°</p>' +
                            '<div style="margin-top: 20px; padding: 15px; background: rgba(102, 126, 234, 0.1); border-radius: 8px;">' +
                                '<small style="color: #667eea;">' +
                                    '💡 キーボードショートカット:<br>' +
                                    '← 左回転 | → 右回転 | ↑ 180°回転' +
                                '</small>' +
                            '</div>' +
                        '</div>';

                    // メインキャンバスにページを描画
                    await generateMainPagePreview(currentPdfDoc, pageNum, 'main-canvas');
                } else {
                    viewer.innerHTML =
                        '<div style="text-align: center; color: #6c757d;">' +
                            '<div style="font-size: 3rem; margin-bottom: 15px;">📄</div>' +
                            '<p>ページを選択するとプレビューが表示されます</p>' +
                        '</div>';
                }
            }

            // メインプレビュー生成関数
            async function generateMainPagePreview(pdfDoc, pageNumber, canvasId) {
                try {
                    const page = await pdfDoc.getPage(pageNumber);
                    const viewport = page.getViewport({ scale: 1.5 });

                    const canvas = document.getElementById(canvasId);
                    if (!canvas) return;

                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    const renderContext = {
                        canvasContext: context,
                        viewport: viewport
                    };

                    await page.render(renderContext).promise;
                } catch (error) {
                    console.error('Main preview generation failed:', error);
                }
            }

            // ページ抽出
            async function extractPages() {
                if (!currentUploadId) {
                    showMessage('error', 'まずPDFファイルをアップロードしてください');
                    return;
                }

                const pages = document.getElementById('extractPages').value.trim();
                if (!pages) {
                    showMessage('error', '抽出するページ番号を入力してください');
                    return;
                }

                document.getElementById('extractLoading').classList.add('show');

                try {
                    const response = await fetch('/extract', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ uploadId: currentUploadId, pages })
                    });

                    const result = await response.json();

                    if (result.success) {
                        document.getElementById('extractResult').innerHTML =
                            '<div class="success-box">' +
                                '<strong>🎉 抽出完了!</strong><br>' +
                                result.message + '<br>' +
                                '抽出されたページ: ' + (result.extractedPages?.join(', ') || 'N/A') +
                                '<br>' +
                                '<a href="' + result.downloadUrl + '" class="download-link" download>' +
                                    '📥 ダウンロード' +
                                '</a>' +
                            '</div>';
                        showStatusIndicator('success', '✂ ページ抽出完了!');
                    } else {
                        showMessage('error', result.error);
                    }
                } catch (error) {
                    showMessage('error', 'ページ抽出に失敗しました: ' + error.message);
                } finally {
                    document.getElementById('extractLoading').classList.remove('show');
                }
            }

            // 回転適用
            async function applyRotations() {
                if (!currentUploadId) {
                    showMessage('error', 'まずPDFファイルをアップロードしてください');
                    return;
                }

                if (Object.keys(rotations).length === 0) {
                    showMessage('error', '回転するページを選択してください');
                    return;
                }

                document.getElementById('rotateLoading').classList.add('show');

                try {
                    const response = await fetch('/rotate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ uploadId: currentUploadId, rotations })
                    });

                    const result = await response.json();

                    if (result.success) {
                        document.getElementById('rotateResult').innerHTML =
                            '<div class="success-box">' +
                                '<strong>🎉 回転完了!</strong><br>' +
                                result.message + '<br>' +
                                '適用された回転: ' + JSON.stringify(result.appliedRotations) +
                                '<br>' +
                                '<a href="' + result.downloadUrl + '" class="download-link" download>' +
                                    '📥 ダウンロード' +
                                '</a>' +
                            '</div>';
                        showStatusIndicator('success', '🔄 ページ回転完了!');
                    } else {
                        showMessage('error', result.error);
                    }
                } catch (error) {
                    showMessage('error', 'ページ回転に失敗しました: ' + error.message);
                } finally {
                    document.getElementById('rotateLoading').classList.remove('show');
                }
            }

            // ユーティリティ関数
            function showMessage(type, message) {
                const className = type === 'error' ? 'error-box' : 'success-box';
                const element = document.getElementById('uploadResult');
                element.innerHTML = '<div class="' + className + '">' + message + '</div>';
            }

            function showProgressBar(show) {
                const progressBar = document.getElementById('uploadProgress');
                const progressFill = document.getElementById('uploadProgressFill');

                if (show) {
                    progressBar.style.display = 'block';
                    progressFill.style.width = '100%';
                } else {
                    setTimeout(() => {
                        progressBar.style.display = 'none';
                        progressFill.style.width = '0%';
                    }, 500);
                }
            }

            function showStatusIndicator(type, message) {
                const indicator = document.createElement('div');
                indicator.className = 'status-indicator ' + type;
                indicator.textContent = message;
                document.body.appendChild(indicator);

                setTimeout(() => indicator.classList.add('show'), 100);
                setTimeout(() => {
                    indicator.classList.remove('show');
                    setTimeout(() => document.body.removeChild(indicator), 400);
                }, 3000);
            }

            // キーボードショートカット（グローバル）
            document.addEventListener('keydown', (event) => {
                if (selectedPage && ['ArrowLeft', 'ArrowRight', 'ArrowUp'].includes(event.key)) {
                    handlePageKeydown(event, selectedPage);
                }
            });
        </script>
    </body>
    </html>
  `);
});

// ヘルスチェック
app.get("/health", (c) => {
	return c.json({
		status: "OK",
		timestamp: new Date().toISOString(),
		worker: "Hono PDF Editor",
	});
});

// ファイルアップロード
app.post("/upload", async (c) => {
	try {
		const formData = await c.req.formData();
		const file = formData.get("pdfFile") as File;

		if (!file) {
			return c.json({ error: "ファイルがアップロードされていません" }, 400);
		}

		if (file.type !== "application/pdf") {
			return c.json({ error: "PDFファイルのみアップロード可能です" }, 400);
		}

		// ファイルサイズチェック（50MB）
		if (file.size > 50 * 1024 * 1024) {
			return c.json({ error: "ファイルサイズが大きすぎます（最大50MB）" }, 400);
		}

		const fileBuffer = await file.arrayBuffer();
		const uploadId = generateUploadId();

		// PDF解析してページ数取得
		let pageCount = 0;
		try {
			const pdfDoc = await PDFDocument.load(fileBuffer);
			pageCount = pdfDoc.getPageCount();
		} catch (error) {
			return c.json({ error: "無効なPDFファイルです" }, 400);
		}

		// R2にファイル保存
		const bucket = c.env.pdf_editor_files;
		await bucket.put(`uploads/${uploadId}.pdf`, fileBuffer, {
			httpMetadata: {
				contentType: "application/pdf",
			},
			customMetadata: {
				originalName: file.name,
				pageCount: pageCount.toString(),
				uploadTime: new Date().toISOString(),
			},
		});

		// メタデータをKVに保存
		const metadata = {
			filename: file.name,
			pageCount,
			uploadTime: new Date().toISOString(),
			size: file.size,
		};

		await c.env.PDF_METADATA.put(uploadId, JSON.stringify(metadata), {
			expirationTtl: 24 * 60 * 60, // 24時間後に削除
		});

		return c.json({
			success: true,
			uploadId,
			filename: file.name,
			pageCount,
			message: `PDFが正常にアップロードされました。総ページ数: ${pageCount}`,
		});
	} catch (error) {
		console.error("Upload error:", error);
		return c.json({ error: "ファイルの処理中にエラーが発生しました" }, 500);
	}
});

// ページ抽出
app.post("/extract", async (c) => {
	try {
		const { uploadId, pages } = await c.req.json();

		if (!uploadId || !pages) {
			return c.json({ error: "アップロードIDとページ番号が必要です" }, 400);
		}

		// R2からファイル取得
		const bucket = c.env.pdf_editor_files;
		const object = await bucket.get(`uploads/${uploadId}.pdf`);

		if (!object) {
			return c.json({ error: "ファイルが見つかりません" }, 404);
		}

		const pdfBytes = await object.arrayBuffer();
		const pdfDoc = await PDFDocument.load(pdfBytes);
		const totalPages = pdfDoc.getPageCount();

		// ページ番号を解析
		const pageNumbers = parsePageNumbers(pages, totalPages);

		if (pageNumbers.length === 0) {
			return c.json({ error: "有効なページ番号を指定してください" }, 400);
		}

		// 新しいPDFを作成
		const newPdfDoc = await PDFDocument.create();

		for (const pageNum of pageNumbers) {
			const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageNum - 1]);
			newPdfDoc.addPage(copiedPage);
		}

		const newPdfBytes = await newPdfDoc.save();
		const outputId = generateUploadId();

		// 抽出結果をR2に保存
		await bucket.put(`outputs/${outputId}.pdf`, newPdfBytes, {
			httpMetadata: {
				contentType: "application/pdf",
			},
			customMetadata: {
				type: "extracted",
				originalUploadId: uploadId,
				extractedPages: pageNumbers.join(","),
				createdTime: new Date().toISOString(),
			},
		});

		return c.json({
			success: true,
			outputId,
			downloadUrl: `/download/${outputId}`,
			message: `${pageNumbers.length}ページが抽出されました`,
			extractedPages: pageNumbers,
		});
	} catch (error) {
		console.error("Extract error:", error);
		return c.json({ error: "ページ抽出中にエラーが発生しました" }, 500);
	}
});

// ページ回転
app.post("/rotate", async (c) => {
	try {
		const { uploadId, rotations } = await c.req.json();

		if (!uploadId || !rotations) {
			return c.json({ error: "アップロードIDと回転情報が必要です" }, 400);
		}

		// R2からファイル取得
		const bucket = c.env.pdf_editor_files;
		const object = await bucket.get(`uploads/${uploadId}.pdf`);

		if (!object) {
			return c.json({ error: "ファイルが見つかりません" }, 404);
		}

		const pdfBytes = await object.arrayBuffer();
		const pdfDoc = await PDFDocument.load(pdfBytes);
		const pages = pdfDoc.getPages();

		// 回転適用
		for (const [pageNum, rotation] of Object.entries(rotations)) {
			const pageIndex = parseInt(pageNum) - 1;
			if (pages[pageIndex] && typeof rotation === "number") {
				pages[pageIndex].setRotation(degrees(rotation));
			}
		}

		const newPdfBytes = await pdfDoc.save();
		const outputId = generateUploadId();

		// 回転結果をR2に保存
		await bucket.put(`outputs/${outputId}.pdf`, newPdfBytes, {
			httpMetadata: {
				contentType: "application/pdf",
			},
			customMetadata: {
				type: "rotated",
				originalUploadId: uploadId,
				rotations: JSON.stringify(rotations),
				createdTime: new Date().toISOString(),
			},
		});

		return c.json({
			success: true,
			outputId,
			downloadUrl: `/download/${outputId}`,
			message: "ページの回転が完了しました",
			appliedRotations: rotations,
		});
	} catch (error) {
		console.error("Rotate error:", error);
		return c.json({ error: "ページ回転中にエラーが発生しました" }, 500);
	}
});

// ファイルダウンロード
app.get("/download/:outputId", async (c) => {
	try {
		const outputId = c.req.param("outputId");
		const bucket = c.env.pdf_editor_files;

		const object = await bucket.get(`outputs/${outputId}.pdf`);

		if (!object) {
			return c.json({ error: "ファイルが見つかりません" }, 404);
		}

		const headers = new Headers();
		headers.set("Content-Type", "application/pdf");
		headers.set(
			"Content-Disposition",
			`attachment; filename="processed_${outputId}.pdf"`,
		);
		headers.set("Cache-Control", "public, max-age=3600");

		return new Response(object.body, { headers });
	} catch (error) {
		console.error("Download error:", error);
		return c.json({ error: "ダウンロード中にエラーが発生しました" }, 500);
	}
});

// アップロードされたファイル一覧
app.get("/files", async (c) => {
	try {
		const bucket = c.env.pdf_editor_files;
		const objects = await bucket.list({ prefix: "uploads/" });

		const files = await Promise.all(
			objects.objects.map(async (obj) => {
				const uploadId = obj.key.replace("uploads/", "").replace(".pdf", "");
				const metadata = await c.env.PDF_METADATA.get(uploadId);

				return {
					uploadId,
					key: obj.key,
					size: obj.size,
					uploaded: obj.uploaded,
					metadata: metadata ? JSON.parse(metadata) : null,
				};
			}),
		);

		return c.json({ files });
	} catch (error) {
		console.error("Files list error:", error);
		return c.json({ error: "ファイル一覧の取得に失敗しました" }, 500);
	}
});

// ファイル削除
app.delete("/file/:uploadId", async (c) => {
	try {
		const uploadId = c.req.param("uploadId");
		const bucket = c.env.pdf_editor_files;

		// アップロードファイルを削除
		await bucket.delete(`uploads/${uploadId}.pdf`);

		// メタデータを削除
		await c.env.PDF_METADATA.delete(uploadId);

		// 関連する出力ファイルも削除
		const outputs = await bucket.list({ prefix: "outputs/" });
		for (const obj of outputs.objects) {
			if (obj.customMetadata?.originalUploadId === uploadId) {
				await bucket.delete(obj.key);
			}
		}

		return c.json({
			success: true,
			message: "ファイルが削除されました",
		});
	} catch (error) {
		console.error("Delete error:", error);
		return c.json({ error: "ファイル削除に失敗しました" }, 500);
	}
});

// ユーティリティ関数
function generateUploadId(): string {
	return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function parsePageNumbers(pagesString: string, totalPages: number): number[] {
	const pages: number[] = [];
	const parts = pagesString.split(",");

	for (const part of parts) {
		const trimmed = part.trim();

		if (trimmed.indexOf("-") !== -1) {
			// 範囲指定 (例: "5-7")
			const [start, end] = trimmed.split("-").map((n) => parseInt(n.trim()));
			if (!isNaN(start) && !isNaN(end)) {
				for (let i = start; i <= Math.min(end, totalPages); i++) {
					if (i >= 1) pages.push(i);
				}
			}
		} else {
			// 単一ページ
			const pageNum = parseInt(trimmed);
			if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
				pages.push(pageNum);
			}
		}
	}

	// 重複を除去してソート
	const uniquePages = Array.from(new Set(pages));
	return uniquePages.sort((a, b) => a - b);
}

export default app;
