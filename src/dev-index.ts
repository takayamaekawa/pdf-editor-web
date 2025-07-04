import { Hono } from "hono";
import { cors } from "hono/cors";
import { PDFDocument, degrees } from "pdf-lib";

const app = new Hono();

// CORS設定
app.use(
	"*",
	cors({
		origin: "*",
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
	}),
);

// メモリ内ストレージ（ローカル開発用）
interface FileStorage {
	[uploadId: string]: {
		pdfDoc: PDFDocument;
		metadata: {
			filename: string;
			pageCount: number;
			uploadTime: string;
			size: number;
		};
	};
}

const storage: FileStorage = {};

// メインページ
app.get("/", (c) => {
	return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PDF Editor - Local Dev Version</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
            }
            .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; color: white; margin-bottom: 40px; }
            .header h1 { font-size: 2.5rem; margin-bottom: 10px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
            .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 5px 15px; border-radius: 20px; font-size: 0.9rem; margin: 5px; }
            .main-content { background: white; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); padding: 30px; }
            .upload-area {
                border: 3px dashed #667eea;
                border-radius: 10px;
                padding: 40px;
                text-align: center;
                margin-bottom: 30px;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            .upload-area:hover { background: #f0f3ff; border-color: #5a6fd8; }
            .btn {
                background: #28a745;
                color: white;
                border: none;
                padding: 12px 25px;
                border-radius: 8px;
                cursor: pointer;
                margin: 10px 5px;
                font-size: 1rem;
                transition: all 0.3s ease;
            }
            .btn:hover { background: #218838; transform: translateY(-2px); }
            .btn:disabled { background: #6c757d; cursor: not-allowed; transform: none; }
            .form-control {
                width: 100%;
                padding: 12px 15px;
                border: 2px solid #e9ecef;
                border-radius: 8px;
                margin: 10px 0;
                font-size: 1rem;
            }
            .form-control:focus { outline: none; border-color: #667eea; }
            .result { margin: 20px 0; padding: 15px; border-radius: 8px; }
            .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
            .info { background: #e7f3ff; color: #0c5460; border: 1px solid #b6d7ff; }
            .file-input { display: none; }
            .form-group { margin: 20px 0; }
            .form-group label { display: block; margin-bottom: 8px; font-weight: 500; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📄 PDF Editor</h1>
                <p>ローカル開発版 - Honoで動作</p>
                <div>
                    <span class="badge">🚀 Dev Mode</span>
                    <span class="badge">💾 Memory Storage</span>
                    <span class="badge">⚡ Hono</span>
                </div>
            </div>
            <div class="main-content">
                <div class="upload-area" onclick="document.getElementById('fileInput').click()">
                    <h3>📎 PDFファイルをアップロード</h3>
                    <p>クリックしてファイルを選択してください（最大50MB）</p>
                    <input type="file" id="fileInput" class="file-input" accept=".pdf" />
                </div>

                <div id="fileInfo" style="display: none;">
                    <h3>📋 ファイル情報</h3>
                    <p id="fileName"></p>
                    <p id="pageCount"></p>

                    <div class="form-group">
                        <label for="extractPages">抽出するページ番号:</label>
                        <input type="text" id="extractPages" class="form-control" placeholder="例: 1,3,5-7,10" />
                        <div style="font-size: 0.9rem; color: #6c757d; margin-top: 5px;">
                            例: 1,3,5-7,10 (1ページ目、3ページ目、5-7ページ目、10ページ目を抽出)
                        </div>
                        <button class="btn" onclick="extractPages()">ページ抽出</button>
                    </div>

                    <div class="form-group">
                        <label for="rotatePages">回転設定 (JSON形式):</label>
                        <input type="text" id="rotatePages" class="form-control" placeholder='{"1":90,"2":180,"3":270}' />
                        <div style="font-size: 0.9rem; color: #6c757d; margin-top: 5px;">
                            例: {"1":90,"2":180} (1ページ目を90度、2ページ目を180度回転)
                        </div>
                        <button class="btn" onclick="rotatePages()">ページ回転</button>
                    </div>
                </div>

                <div id="result"></div>
            </div>
        </div>

        <script>
            let currentUploadId = '';

            document.getElementById('fileInput').addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file || file.type !== 'application/pdf') {
                    showResult('PDFファイルを選択してください', 'error');
                    return;
                }

                if (file.size > 50 * 1024 * 1024) {
                    showResult('ファイルサイズが大きすぎます（最大50MB）', 'error');
                    return;
                }

                const formData = new FormData();
                formData.append('pdfFile', file);

                try {
                    showResult('アップロード中...', 'info');
                    const response = await fetch('/upload', {
                        method: 'POST',
                        body: formData
                    });

                    const result = await response.json();
                    if (result.success) {
                        currentUploadId = result.uploadId;
                        document.getElementById('fileName').textContent = 'ファイル名: ' + result.filename;
                        document.getElementById('pageCount').textContent = 'ページ数: ' + result.pageCount;
                        document.getElementById('fileInfo').style.display = 'block';
                        showResult('ファイルが正常にアップロードされました', 'success');
                    } else {
                        showResult(result.error, 'error');
                    }
                } catch (error) {
                    showResult('ファイル処理中にエラーが発生しました: ' + error.message, 'error');
                }
            });

            async function extractPages() {
                const pages = document.getElementById('extractPages').value;
                if (!pages || !currentUploadId) {
                    showResult('ページ番号を入力してください', 'error');
                    return;
                }

                try {
                    showResult('ページ抽出中...', 'info');
                    const response = await fetch('/extract', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ uploadId: currentUploadId, pages })
                    });

                    if (response.ok) {
                        const blob = await response.blob();
                        downloadPdf(blob, 'extracted_pages.pdf');
                        showResult('ページが抽出されました', 'success');
                    } else {
                        const error = await response.json();
                        showResult(error.error, 'error');
                    }
                } catch (error) {
                    showResult('ページ抽出中にエラーが発生しました: ' + error.message, 'error');
                }
            }

            async function rotatePages() {
                const rotateInput = document.getElementById('rotatePages').value;
                if (!rotateInput || !currentUploadId) {
                    showResult('回転設定を入力してください', 'error');
                    return;
                }

                try {
                    const rotations = JSON.parse(rotateInput);
                    showResult('ページ回転中...', 'info');

                    const response = await fetch('/rotate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ uploadId: currentUploadId, rotations })
                    });

                    if (response.ok) {
                        const blob = await response.blob();
                        downloadPdf(blob, 'rotated_pages.pdf');
                        showResult('ページが回転されました', 'success');
                    } else {
                        const error = await response.json();
                        showResult(error.error, 'error');
                    }
                } catch (error) {
                    showResult('ページ回転中にエラーが発生しました: ' + error.message, 'error');
                }
            }

            function downloadPdf(blob, filename) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }

            function showResult(message, type) {
                const resultDiv = document.getElementById('result');
                resultDiv.innerHTML = '<div class="result ' + type + '">' + message + '</div>';
            }
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
		version: "dev-memory",
		storage: Object.keys(storage).length + " files in memory",
	});
});

// PDFファイルのアップロード
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

		if (file.size > 50 * 1024 * 1024) {
			return c.json({ error: "ファイルサイズが大きすぎます（最大50MB）" }, 400);
		}

		const fileBuffer = await file.arrayBuffer();
		const uploadId = generateUploadId();

		// PDF解析してページ数取得
		let pdfDoc: PDFDocument;
		try {
			pdfDoc = await PDFDocument.load(fileBuffer);
		} catch (error) {
			return c.json({ error: "無効なPDFファイルです" }, 400);
		}

		const pageCount = pdfDoc.getPageCount();

		// メモリに保存
		storage[uploadId] = {
			pdfDoc,
			metadata: {
				filename: file.name,
				pageCount,
				uploadTime: new Date().toISOString(),
				size: file.size,
			},
		};

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

		const stored = storage[uploadId];
		if (!stored) {
			return c.json({ error: "ファイルが見つかりません" }, 404);
		}

		const { pdfDoc } = stored;
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

		return new Response(newPdfBytes, {
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": 'attachment; filename="extracted_pages.pdf"',
			},
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

		const stored = storage[uploadId];
		if (!stored) {
			return c.json({ error: "ファイルが見つかりません" }, 404);
		}

		const { pdfDoc } = stored;
		const pages = pdfDoc.getPages();

		// 回転適用
		for (const [pageNum, rotation] of Object.entries(rotations)) {
			const pageIndex = parseInt(pageNum) - 1;
			if (pages[pageIndex] && typeof rotation === "number") {
				pages[pageIndex].setRotation(degrees(rotation));
			}
		}

		const newPdfBytes = await pdfDoc.save();

		return new Response(newPdfBytes, {
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": 'attachment; filename="rotated_pages.pdf"',
			},
		});
	} catch (error) {
		console.error("Rotate error:", error);
		return c.json({ error: "ページ回転中にエラーが発生しました" }, 500);
	}
});

// ファイル一覧
app.get("/files", (c) => {
	const files = Object.entries(storage).map(([uploadId, data]) => ({
		uploadId,
		metadata: data.metadata,
	}));

	return c.json({ files });
});

// ファイル削除
app.delete("/file/:uploadId", (c) => {
	const uploadId = c.req.param("uploadId");

	if (storage[uploadId]) {
		delete storage[uploadId];
		return c.json({ success: true, message: "ファイルが削除されました" });
	} else {
		return c.json({ error: "ファイルが見つかりません" }, 404);
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
